import {
  countCommentLikes,
  countPostLikes,
  findCommentByIdForPayload,
  findContentReports,
  findPosts,
  findPublishedCommentsByPostId,
  findPublishedPostById,
  findPostOwner,
  insertComment,
  insertContentReport,
  insertPost,
  insertPostImage,
  linkPostTag,
  replacePostImages,
  replacePostTags,
  toggleCommentLikeByUser,
  togglePostLikeByUser,
  updateCommentStatusById,
  updateContentReportStatus,
  updatePostByOwner,
  updatePostStatusById,
  upsertTag,
} from "../repositories/communityRepository.js";
import {
  commentExists,
  postExists,
  userExists,
} from "../repositories/entityRepository.js";
import { createAdminNotifications } from "../services/notificationService.js";
import { findSensitiveWords } from "../services/sensitiveWordService.js";
import { normalizeText, toArray, toJsonArray } from "../utils/text.js";

const toPostPayload = (row) => ({
  id: String(row.post_id),
  post_id: row.post_id,
  userId: String(row.user_id),
  user_id: row.user_id,
  userName: row.full_name || row.user_name || "Người dùng",
  userAvatarUrl: row.avatar_url ?? "",
  title: row.post_title,
  content: row.post_content,
  status: row.post_status,
  category: row.category ?? "Kinh nghiệm",
  createdAt: row.created_at,
  images: toJsonArray(row.images),
  tags: toJsonArray(row.tags),
  likes: Number(row.likes_count ?? 0),
  comments: Number(row.comments_count ?? 0),
  liked: !!row.liked_by_user,
});

const toCommentPayload = (row) => ({
  id: String(row.comment_id),
  comment_id: row.comment_id,
  postId: String(row.post_id),
  userId: String(row.user_id),
  userName: row.full_name || row.user_name || "Người dùng",
  userAvatarUrl: row.avatar_url ?? "",
  content: row.comment_content,
  status: row.comment_status,
  createdAt: row.created_at,
  likes: Number(row.likes_count ?? 0),
  liked: !!row.liked_by_user,
});

export const getPosts = async (req, res) => {
  const { category, q, user_id, author_user_id } = req.query;

  try {
    const rows = await findPosts({ category, q, userId: user_id, authorUserId: author_user_id });

    res.status(200).json({ success: true, data: rows.map(toPostPayload) });
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const userId = req.body?.user_id;
  const title = normalizeText(req.body?.title ?? req.body?.post_title);
  const content = normalizeText(req.body?.content ?? req.body?.post_content);
  const category = normalizeText(req.body?.category) || "Kinh nghiệm";
  const tags = toArray(req.body?.tags).map((tag) => tag.toLocaleLowerCase("vi-VN")).slice(0, 10);
  const imageUrls = toArray(req.body?.image_urls ?? req.body?.images).slice(0, 6);

  if (!userId || !title || !content) {
    return res.status(400).json({ error: "Missing required fields: user_id, title, content" });
  }

  try {
    const owner = await findPostOwner(id);
    if (!owner || owner.post_status !== "published") return res.status(404).json({ error: "Post not found" });
    if (String(owner.user_id) !== String(userId)) {
      return res.status(403).json({ error: "You can only edit your own post" });
    }

    const blockedWords = await findSensitiveWords(title, content);
    if (blockedWords.length > 0) {
      return res.status(400).json({
        error: "Nội dung chứa từ nhạy cảm. Vui lòng chỉnh sửa trước khi lưu.",
        data: { blockedWords },
      });
    }

    await updatePostByOwner({ postId: id, userId, title, content, category });
    await replacePostImages(id, imageUrls);
    await replacePostTags(id, tags);

    const detailReq = { params: { id }, query: { user_id: userId } };
    return getPostById(detailReq, res);
  } catch (error) {
    console.error(`Error updating community post ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;
  const userId = req.body?.user_id;

  if (!userId) return res.status(400).json({ error: "Missing required field: user_id" });

  try {
    const owner = await findPostOwner(id);
    if (!owner || owner.post_status !== "published") return res.status(404).json({ error: "Post not found" });
    if (String(owner.user_id) !== String(userId)) {
      return res.status(403).json({ error: "You can only delete your own post" });
    }

    const updated = await updatePostStatusById(id, "removed");
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error deleting community post ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  try {
    const post = await findPublishedPostById(id, user_id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comments = await findPublishedCommentsByPostId(id, user_id);

    res.status(200).json({
      success: true,
      data: { ...toPostPayload(post), commentItems: comments.map(toCommentPayload) },
    });
  } catch (error) {
    console.error(`Error fetching community post ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createPost = async (req, res) => {
  const userId = req.body?.user_id;
  const title = normalizeText(req.body?.title ?? req.body?.post_title);
  const content = normalizeText(req.body?.content ?? req.body?.post_content);
  const category = normalizeText(req.body?.category) || "Kinh nghiệm";
  const tags = toArray(req.body?.tags).map((tag) => tag.toLocaleLowerCase("vi-VN")).slice(0, 10);
  const imageUrls = toArray(req.body?.image_urls ?? req.body?.images).slice(0, 6);

  if (!userId || !title || !content) {
    return res.status(400).json({ error: "Missing required fields: user_id, title, content" });
  }

  try {
    if (!(await userExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const blockedWords = await findSensitiveWords(title, content);
    if (blockedWords.length > 0) {
      return res.status(400).json({
        error: "Nội dung chứa từ nhạy cảm. Vui lòng chỉnh sửa trước khi đăng.",
        data: { blockedWords },
      });
    }

    const postId = await insertPost({ userId, title, content, category });

    await Promise.all(imageUrls.map((imageUrl) => insertPostImage(postId, imageUrl)));

    for (const tag of tags) {
      const tagId = await upsertTag(tag);
      await linkPostTag(postId, tagId);
    }

    const detailReq = { params: { id: postId }, query: { user_id: userId } };
    return getPostById(detailReq, res);
  } catch (error) {
    console.error("Error creating community post:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createComment = async (req, res) => {
  const { id } = req.params;
  const userId = req.body?.user_id;
  const content = normalizeText(req.body?.content ?? req.body?.comment_content);

  if (!userId || !content) {
    return res.status(400).json({ error: "Missing required fields: user_id, content" });
  }

  try {
    if (!(await userExists(userId))) return res.status(404).json({ error: "User not found" });
    if (!(await postExists(id))) return res.status(404).json({ error: "Post not found" });

    const blockedWords = await findSensitiveWords(content);
    if (blockedWords.length > 0) {
      return res.status(400).json({
        error: "Bình luận chứa từ nhạy cảm. Vui lòng chỉnh sửa trước khi gửi.",
        data: { blockedWords },
      });
    }

    const commentId = await insertComment({ postId: id, userId, content });
    const comment = await findCommentByIdForPayload(commentId);

    res.status(201).json({ success: true, data: toCommentPayload(comment) });
  } catch (error) {
    console.error(`Error creating comment for post ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const togglePostLike = async (req, res) => {
  const { id } = req.params;
  const { user_id: userId } = req.body;

  if (!userId) return res.status(400).json({ error: "Missing required field: user_id" });

  try {
    if (!(await userExists(userId))) return res.status(404).json({ error: "User not found" });
    if (!(await postExists(id))) return res.status(404).json({ error: "Post not found" });

    const liked = await togglePostLikeByUser(id, userId);
    const likes = await countPostLikes(id);
    res.status(200).json({ success: true, data: { liked, likes } });
  } catch (error) {
    console.error(`Error toggling like for post ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const toggleCommentLike = async (req, res) => {
  const { commentId } = req.params;
  const { user_id: userId } = req.body;

  if (!userId) return res.status(400).json({ error: "Missing required field: user_id" });

  try {
    if (!(await userExists(userId))) return res.status(404).json({ error: "User not found" });
    if (!(await commentExists(commentId))) return res.status(404).json({ error: "Comment not found" });

    const liked = await toggleCommentLikeByUser(commentId, userId);
    const likes = await countCommentLikes(commentId);
    res.status(200).json({ success: true, data: { liked, likes } });
  } catch (error) {
    console.error(`Error toggling like for comment ${commentId}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createReport = async (req, res) => {
  const reporterUserId = req.body?.reporter_user_id ?? req.body?.user_id;
  const targetType = normalizeText(req.body?.target_type);
  const targetId = req.body?.target_id;
  const reason = normalizeText(req.body?.reason);

  if (!reporterUserId || !targetType || !targetId || !reason) {
    return res.status(400).json({
      error: "Missing required fields: reporter_user_id, target_type, target_id, reason",
    });
  }

  if (!["post", "comment"].includes(targetType)) {
    return res.status(400).json({ error: "target_type must be post or comment" });
  }

  try {
    if (!(await userExists(reporterUserId))) return res.status(404).json({ error: "User not found" });
    const targetExists = targetType === "post" ? await postExists(targetId) : await commentExists(targetId);
    if (!targetExists) return res.status(404).json({ error: "Reported content not found" });

    const created = await insertContentReport({ reporterUserId, targetType, targetId, reason });

    await createAdminNotifications({
      title: "Có báo cáo nội dung mới",
      message: `Người dùng báo cáo ${targetType === "post" ? "bài viết" : "bình luận"} #${targetId}.`,
      type: "content_report",
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error creating content report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getReports = async (req, res) => {
  const { status } = req.query;
  try {
    const rows = await findContentReports({ status });

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching content reports:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const status = normalizeText(req.body?.status);

  if (!["pending", "reviewed", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "status must be pending, reviewed, or dismissed" });
  }

  try {
    const updated = await updateContentReportStatus(id, status);
    if (!updated) return res.status(404).json({ error: "Report not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error updating report ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updatePostStatus = async (req, res) => {
  const { id } = req.params;
  const status = normalizeText(req.body?.status);

  if (!["published", "hidden", "removed"].includes(status)) {
    return res.status(400).json({ error: "status must be published, hidden, or removed" });
  }

  try {
    const updated = await updatePostStatusById(id, status);
    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error updating post ${id} status:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCommentStatus = async (req, res) => {
  const { commentId } = req.params;
  const status = normalizeText(req.body?.status);

  if (!["published", "hidden", "removed"].includes(status)) {
    return res.status(400).json({ error: "status must be published, hidden, or removed" });
  }

  try {
    const updated = await updateCommentStatusById(commentId, status);
    if (!updated) return res.status(404).json({ error: "Comment not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error updating comment ${commentId} status:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
