import express from "express";

import {
  createComment,
  createPost,
  createReport,
  getPostById,
  getPosts,
  getReports,
  toggleCommentLike,
  togglePostLike,
  updateCommentStatus,
  updatePostStatus,
  updateReportStatus,
} from "../controllers/communityController.js";

const router = express.Router();

router.get("/posts", getPosts);
router.post("/posts", createPost);
router.get("/posts/:id", getPostById);
router.post("/posts/:id/comments", createComment);
router.post("/posts/:id/like", togglePostLike);
router.post("/comments/:commentId/like", toggleCommentLike);
router.put("/posts/:id/status", updatePostStatus);
router.put("/comments/:commentId/status", updateCommentStatus);

router.get("/reports", getReports);
router.post("/reports", createReport);
router.put("/reports/:id/status", updateReportStatus);

export default router;
