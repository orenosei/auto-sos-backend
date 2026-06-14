import express from "express";

import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserPassword,
  deleteUser,
} from "../controllers/usersController.js";

const router = express.Router();

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id/password", changeUserPassword);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
