import express from "express";

import {
  registerUser,
  loginUser,
  registerCompany,
  loginCompany,
  loginAccount,
  verifyAdminAccess,
} from "../controllers/authController.js";

const router = express.Router();

// Users
router.post("/users/register", registerUser);
router.post("/users/login", loginUser);

// Companies
router.post("/companies/register", registerCompany);
router.post("/companies/login", loginCompany);
router.post("/login", loginAccount);
router.post("/admin/verify", verifyAdminAccess);

export default router;
