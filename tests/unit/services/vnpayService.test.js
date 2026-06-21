import { describe, expect, it } from "vitest";

import {
  buildVnPayPaymentUrl,
  formatVnPayDate,
  signVnPayParams,
  verifyVnPaySignature,
} from "../../../src/services/vnpayService.js";

describe("vnpayService", () => {
  it("formats dates in the VNPay timezone format", () => {
    expect(formatVnPayDate(new Date("2026-06-21T06:30:45.000Z"))).toBe(
      "20260621133045"
    );
  });

  it("builds and verifies HMAC-SHA512 signed parameters", () => {
    const secret = "sandbox-secret";
    const params = {
      vnp_Amount: 25000000,
      vnp_Command: "pay",
      vnp_OrderInfo: "Thanh toan yeu cau 10",
      vnp_TmnCode: "TESTCODE",
      vnp_TxnRef: "RS10",
      vnp_Version: "2.1.0",
    };
    const url = buildVnPayPaymentUrl({
      baseUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      secret,
      params,
    });
    const parsed = new URL(url);
    const query = Object.fromEntries(parsed.searchParams.entries());

    expect(url).toContain("vnp_OrderInfo=Thanh+toan+yeu+cau+10");
    expect(url).not.toContain("Thanh%20toan");
    expect(query.vnp_SecureHash).toBe(signVnPayParams(params, secret));
    expect(verifyVnPaySignature(query, secret)).toBe(true);
    expect(
      verifyVnPaySignature({ ...query, vnp_Amount: "100" }, secret)
    ).toBe(false);
  });
});
