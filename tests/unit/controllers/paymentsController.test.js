import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const paymentRepository = vi.hoisted(() => ({
  findLatestPaymentByRequest: vi.fn(),
  findPaymentRequest: vi.fn(),
  findPaymentTransactionByRef: vi.fn(),
  insertPaymentTransaction: vi.fn(),
  setRequestPaymentState: vi.fn(),
  updatePaymentTransaction: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createNotification: vi.fn(),
}));

vi.mock("../../../src/repositories/paymentRepository.js", () => paymentRepository);
vi.mock("../../../src/services/notificationService.js", () => notificationService);

const {
  confirmCashPayment,
  createCashPayment,
  createVnPayPayment,
  getRequestPayment,
} = await import("../../../src/controllers/paymentsController.js");

describe("paymentsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VNPAY_TMN_CODE = "TESTCODE";
    process.env.VNPAY_HASH_SECRET = "sandbox-secret";
    process.env.VNPAY_RETURN_URL =
      "http://localhost:5001/api/payments/vnpay-return";
  });

  it("returns request payment details", async () => {
    paymentRepository.findPaymentRequest.mockResolvedValue({
      request_id: 10,
      payment_method: "vnpay",
      payment_status: "paid",
      paid_at: "2026-06-21T10:00:00.000Z",
    });
    paymentRepository.findLatestPaymentByRequest.mockResolvedValue({
      transaction_ref: "RS10",
    });
    const res = createMockResponse();

    await getRequestPayment({ params: { requestId: "10" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "paid" }),
      })
    );
  });

  it("selects and confirms cash payments", async () => {
    paymentRepository.findPaymentRequest
      .mockResolvedValueOnce({
        request_id: 10,
        user_id: 5,
        company_id: 2,
        request_status: "completed",
        final_price: 250000,
        payment_status: "unpaid",
      })
      .mockResolvedValueOnce({
        request_id: 10,
        user_id: 5,
        company_id: 2,
        final_price: 250000,
        payment_method: "cash",
        payment_status: "pending",
      });
    paymentRepository.setRequestPaymentState.mockResolvedValue({
      request_id: 10,
    });

    const cashRes = createMockResponse();
    await createCashPayment(
      { params: { requestId: "10" }, body: { user_id: 5 } },
      cashRes
    );
    expect(paymentRepository.setRequestPaymentState).toHaveBeenCalledWith({
      requestId: 10,
      method: "cash",
      status: "pending",
    });
    expect(cashRes.status).toHaveBeenCalledWith(200);

    const confirmRes = createMockResponse();
    await confirmCashPayment(
      { params: { requestId: "10" }, body: { company_id: 2 } },
      confirmRes
    );
    expect(paymentRepository.setRequestPaymentState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestId: 10,
        method: "cash",
        status: "paid",
      })
    );
    expect(confirmRes.status).toHaveBeenCalledWith(200);
  });

  it("creates a signed VNPay payment URL for a completed request", async () => {
    paymentRepository.findPaymentRequest.mockResolvedValue({
      request_id: 10,
      user_id: 5,
      company_id: 2,
      request_status: "completed",
      final_price: 250000,
      payment_status: "unpaid",
    });
    paymentRepository.insertPaymentTransaction.mockResolvedValue({
      transaction_id: 1,
    });
    const res = createMockResponse();

    await createVnPayPayment(
      {
        params: { requestId: "10" },
        body: { user_id: 5 },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      },
      res
    );

    expect(paymentRepository.insertPaymentTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 10,
        provider: "vnpay",
        amount: 250000,
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_url: expect.stringContaining("vnp_SecureHash="),
        }),
      })
    );
  });
});
