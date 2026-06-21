import express from "express";
import {
  confirmCashPayment,
  createCashPayment,
  createVnPayPayment,
  getRequestPayment,
  handleVnPayIpn,
  handleVnPayReturn,
} from "../controllers/paymentsController.js";

const router = express.Router();

router.get("/vnpay-ipn", handleVnPayIpn);
router.get("/vnpay-return", handleVnPayReturn);
router.get("/requests/:requestId", getRequestPayment);
router.post("/requests/:requestId/cash", createCashPayment);
router.post("/requests/:requestId/cash/confirm", confirmCashPayment);
router.post("/requests/:requestId/vnpay", createVnPayPayment);

export default router;
