import express from "express";

import {
  createComment,
  createPost,
  createReport,
  deletePost,
  getPostById,
  getPosts,
  getReports,
  toggleCommentLike,
  togglePostLike,
  updateCommentStatus,
  updatePost,
  updatePostStatus,
  updateReportStatus,
} from "../controllers/communityController.js";

const router = express.Router();

router.get("/posts", getPosts);
router.post("/posts", createPost);
router.get("/posts/:id", getPostById);
router.put("/posts/:id", updatePost);
router.delete("/posts/:id", deletePost);
router.post("/posts/:id/comments", createComment);
router.post("/posts/:id/like", togglePostLike);
router.post("/comments/:commentId/like", toggleCommentLike);
router.put("/posts/:id/status", updatePostStatus);
router.put("/comments/:commentId/status", updateCommentStatus);

router.get("/reports", getReports);
router.post("/reports", createReport);
router.put("/reports/:id/status", updateReportStatus);

export default router;
