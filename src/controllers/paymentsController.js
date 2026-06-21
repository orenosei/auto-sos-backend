import {
  findLatestPaymentByRequest,
  findPaymentRequest,
  findPaymentTransactionByRef,
  insertPaymentTransaction,
  setRequestPaymentState,
  updatePaymentTransaction,
} from "../repositories/paymentRepository.js";
import { createNotification } from "../services/notificationService.js";
import {
  buildVnPayPaymentUrl,
  formatVnPayDate,
  verifyVnPaySignature,
} from "../services/vnpayService.js";

const config = () => ({
  tmnCode: process.env.VNPAY_TMN_CODE?.trim(),
  secret: process.env.VNPAY_HASH_SECRET?.trim(),
  paymentUrl:
    process.env.VNPAY_PAYMENT_URL?.trim() ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl:
    process.env.VNPAY_RETURN_URL?.trim() ||
    "http://localhost:5001/api/payments/vnpay-return",
  frontendReturnUrl:
    process.env.VNPAY_FRONTEND_RETURN_URL?.trim() ||
    "http://localhost:5173/payment-result",
});

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return String(value || req.socket?.remoteAddress || "127.0.0.1").replace("::ffff:", "");
};

const paymentValidationError = (request) => {
  if (!request) return "Request not found";
  if (request.request_status !== "completed") {
    return "Chỉ có thể thanh toán sau khi dịch vụ hoàn tất";
  }
  if (!Number.isFinite(Number(request.final_price)) || Number(request.final_price) <= 0) {
    return "Yêu cầu chưa có chi phí cuối cùng hợp lệ";
  }
  if (request.payment_status === "paid") return "Yêu cầu đã được thanh toán";
  return null;
};

export const getRequestPayment = async (req, res) => {
  try {
    const request = await findPaymentRequest(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const transaction = await findLatestPaymentByRequest(req.params.requestId);
    res.status(200).json({
      success: true,
      data: {
        method: request.payment_method,
        status: request.payment_status || "unpaid",
        paid_at: request.paid_at,
        transaction,
      },
    });
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCashPayment = async (req, res) => {
  if (req.body?.user_id == null) {
    return res.status(400).json({ error: "Missing required field: user_id" });
  }
  try {
    const request = await findPaymentRequest(req.params.requestId);
    const error = paymentValidationError(request);
    if (error) return res.status(request ? 400 : 404).json({ error });
    if (req.body?.user_id != null && String(req.body.user_id) !== String(request.user_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updated = await setRequestPaymentState({
      requestId: request.request_id,
      method: "cash",
      status: "pending",
    });
    if (request.company_id != null) {
      await createNotification({
        recipientType: "company",
        recipientId: request.company_id,
        requestId: request.request_id,
        title: "Khách hàng chọn thanh toán tiền mặt",
        message: `Yêu cầu #${request.request_id}\nSố tiền: ${Number(request.final_price).toLocaleString("vi-VN")}đ\nVui lòng xác nhận sau khi đã nhận tiền.`,
        type: "payment_cash_selected",
      });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error selecting cash payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const confirmCashPayment = async (req, res) => {
  if (req.body?.company_id == null) {
    return res.status(400).json({ error: "Missing required field: company_id" });
  }
  try {
    const request = await findPaymentRequest(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (
      req.body?.company_id != null &&
      String(req.body.company_id) !== String(request.company_id)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (request.payment_method !== "cash" || request.payment_status !== "pending") {
      return res.status(400).json({ error: "Không có thanh toán tiền mặt đang chờ xác nhận" });
    }

    const updated = await setRequestPaymentState({
      requestId: request.request_id,
      method: "cash",
      status: "paid",
      paidAt: new Date().toISOString(),
    });
    if (request.user_id != null) {
      await createNotification({
        recipientType: "user",
        recipientId: request.user_id,
        requestId: request.request_id,
        title: "Đã xác nhận thanh toán tiền mặt",
        message: `Công ty đã xác nhận nhận đủ ${Number(request.final_price).toLocaleString("vi-VN")}đ cho yêu cầu #${request.request_id}.`,
        type: "payment_cash_confirmed",
      });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error confirming cash payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createVnPayPayment = async (req, res) => {
  const settings = config();
  if (!settings.tmnCode || !settings.secret) {
    return res.status(503).json({ error: "VNPay chưa được cấu hình trên máy chủ" });
  }
  if (req.body?.user_id == null) {
    return res.status(400).json({ error: "Missing required field: user_id" });
  }

  try {
    const request = await findPaymentRequest(req.params.requestId);
    const error = paymentValidationError(request);
    if (error) return res.status(request ? 400 : 404).json({ error });
    if (req.body?.user_id != null && String(req.body.user_id) !== String(request.user_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const now = new Date();
    const transactionRef = `RS${request.request_id}${Date.now()}`;
    await insertPaymentTransaction({
      requestId: request.request_id,
      provider: "vnpay",
      transactionRef,
      amount: Number(request.final_price),
    });
    await setRequestPaymentState({
      requestId: request.request_id,
      method: "vnpay",
      status: "pending",
    });

    const paymentUrl = buildVnPayPaymentUrl({
      baseUrl: settings.paymentUrl,
      secret: settings.secret,
      params: {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: settings.tmnCode,
        vnp_Amount: Math.round(Number(request.final_price) * 100),
        vnp_CurrCode: "VND",
        vnp_TxnRef: transactionRef,
        vnp_OrderInfo: `Thanh toan yeu cau cuu ho ${request.request_id}`,
        vnp_OrderType: "other",
        vnp_Locale: req.body?.locale === "en" ? "en" : "vn",
        vnp_ReturnUrl: settings.returnUrl,
        vnp_IpAddr: getClientIp(req),
        vnp_CreateDate: formatVnPayDate(now),
        vnp_ExpireDate: formatVnPayDate(new Date(now.getTime() + 15 * 60 * 1000)),
        vnp_BankCode: req.body?.bank_code || undefined,
      },
    });

    res.status(201).json({
      success: true,
      data: { payment_url: paymentUrl, transaction_ref: transactionRef },
    });
  } catch (error) {
    console.error("Error creating VNPay payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const processVnPayResult = async (query) => {
  const settings = config();
  if (!settings.secret || !verifyVnPaySignature(query, settings.secret)) {
    return { rspCode: "97", message: "Invalid signature", status: "invalid" };
  }

  const transaction = await findPaymentTransactionByRef(query.vnp_TxnRef);
  if (!transaction) {
    return { rspCode: "01", message: "Order not found", status: "not_found" };
  }
  if (Math.round(Number(transaction.amount) * 100) !== Number(query.vnp_Amount)) {
    return { rspCode: "04", message: "Invalid amount", status: "invalid_amount" };
  }
  if (transaction.status !== "pending") {
    return {
      rspCode: "02",
      message: "Order already confirmed",
      status: transaction.status,
      requestId: transaction.request_id,
    };
  }

  const paid =
    query.vnp_ResponseCode === "00" && query.vnp_TransactionStatus === "00";
  const status = paid ? "paid" : "failed";
  await updatePaymentTransaction({
    transactionRef: query.vnp_TxnRef,
    status,
    providerTransactionNo: query.vnp_TransactionNo,
    responseCode: query.vnp_ResponseCode,
    bankCode: query.vnp_BankCode,
    payload: query,
  });
  const request = await findPaymentRequest(transaction.request_id);
  await setRequestPaymentState({
    requestId: transaction.request_id,
    method: "vnpay",
    status,
    paidAt: paid ? new Date().toISOString() : null,
  });

  if (paid && request?.company_id != null) {
    await createNotification({
      recipientType: "company",
      recipientId: request.company_id,
      requestId: request.request_id,
      title: "Thanh toán VNPay thành công",
      message: `Yêu cầu #${request.request_id} đã thanh toán ${Number(transaction.amount).toLocaleString("vi-VN")}đ qua VNPay.`,
      type: "payment_vnpay_success",
    });
  }
  return {
    rspCode: "00",
    message: "Confirm Success",
    status,
    requestId: transaction.request_id,
  };
};

export const handleVnPayIpn = async (req, res) => {
  try {
    const result = await processVnPayResult(req.query);
    res.status(200).json({ RspCode: result.rspCode, Message: result.message });
  } catch (error) {
    console.error("Error processing VNPay IPN:", error);
    res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

export const handleVnPayReturn = async (req, res) => {
  const settings = config();
  try {
    const result = await processVnPayResult(req.query);
    const url = new URL(settings.frontendReturnUrl);
    url.searchParams.set("status", result.status);
    if (result.requestId) url.searchParams.set("requestId", result.requestId);
    if (req.query.vnp_ResponseCode) {
      url.searchParams.set("responseCode", req.query.vnp_ResponseCode);
    }
    res.redirect(url.toString());
  } catch (error) {
    console.error("Error processing VNPay return:", error);
    const url = new URL(settings.frontendReturnUrl);
    url.searchParams.set("status", "error");
    res.redirect(url.toString());
  }
};
