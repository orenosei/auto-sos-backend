import express from "express";

import {
  getRequests,
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
} from "../controllers/requestsController.js";

import {
  getRequestServices,
  addRequestService,
  updateRequestService,
  deleteRequestService,
} from "../controllers/requestServicesController.js";

import {
  getRequestImages,
  addRequestImage,
  deleteRequestImage,
  getCloudinarySignature,
} from "../controllers/requestImagesController.js";

import {
  getRequestMessages,
  addRequestMessage,
  markMessageSeen,
} from "../controllers/requestMessagesController.js";
import {
  addReview,
  deleteReview,
  getRequestReview,
  updateReview,
} from "../controllers/reviewsController.js";

const router = express.Router();

// GET /requests?user_id=..., ?company_id=..., or ?all=true (&request_status=...)
router.get("/", getRequests);

// GET /requests/:id
router.get("/:id", getRequestById);

// Request services (request_services)
router.get("/:id/services", getRequestServices);
router.post("/:id/services", addRequestService);
router.put("/:id/services/:service_id", updateRequestService);
router.delete("/:id/services/:service_id", deleteRequestService);

// Request images (request_images)
router.post("/cloudinary/signature", getCloudinarySignature);
router.get("/:id/images", getRequestImages);
router.post("/:id/images", addRequestImage);
router.delete("/:id/images/:image_id", deleteRequestImage);

// Request messages (messages)
router.get("/:id/messages", getRequestMessages);
router.post("/:id/messages", addRequestMessage);
router.put("/:id/messages/:message_id/seen", markMessageSeen);

// Request review
router.post('/:id/review', addReview);
router.get('/:id/review', getRequestReview);
router.put('/:id/review', updateReview);
router.delete('/:id/review', deleteReview);

// POST /requests
router.post("/", createRequest);

// PUT /requests/:id
router.put("/:id", updateRequest);

// DELETE /requests/:id
router.delete("/:id", deleteRequest);

export default router;
