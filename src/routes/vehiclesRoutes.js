import express from "express";

import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../controllers/rescueVehiclesController.js";

const router = express.Router();

router.get("/", getVehicles);
router.post("/", createVehicle);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;
