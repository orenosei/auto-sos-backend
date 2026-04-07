import express from "express";

import { getAllServices } from "../controllers/servicesController.js";

const router = express.Router();

router.get("/", getAllServices);

export default router;
