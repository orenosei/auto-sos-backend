import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SENSITIVE_WORDS_FILE = path.resolve(__dirname, "../config/sensitive_words.txt");

const POST_SELECT = `
  p.post_id,
  p.user_id,
  p.post_title,
  p.post_content,
  p.post_status,
  p.category,
  p.created_at,
  u.full_name,
  u.user_name,
  u.avatar_url,
  COALESCE((SELECT json_agg(pi.image_url ORDER BY pi.image_id) FROM post_images pi WHERE pi.post_id = p.post_id), '[]'::json) AS images,
  COALESCE((
    SELECT json_agg(t.tag_name ORDER BY t.tag_name)
    FROM post_tags pt
    JOIN tags t ON t.tag_id = pt.tag_id
    WHERE pt.post_id = p.post_id
  ), '[]'::json) AS tags,
  (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
  (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.post_id AND c.comment_status = 'published') AS comments_count
`;

const COMMENT_SELECT = `
  c.comment_id,
  c.post_id,
  c.user_id,
  c.comment_content,
  c.comment_status,
  c.created_at,
  u.full_name,
  u.user_name,
  u.avatar_url,
  (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.comment_id) AS likes_count
`;

const normalizeText = (value) => String(value ?? "").trim();

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const toJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readSensitiveWords = async () => {
  try {
    const raw = await fs.readFile(SENSITIVE_WORDS_FILE, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const findSensitiveWords = async (...parts) => {
  const words = await readSensitiveWords();
  if (words.length === 0) return [];

  const content = parts.join(" ").toLocaleLowerCase("vi-VN");
  return words.filter((word) => content.includes(word.toLocaleLowerCase("vi-VN")));
};

const ensureUserExists = async (userId) => {
  const rows = await sql.query("SELECT 1 FROM users WHERE user_id = $1 LIMIT 1", [userId]);
  return rows.length > 0;
};

const ensurePostExists = async (postId) => {
  const rows = await sql.query("SELECT 1 FROM posts WHERE post_id = $1 LIMIT 1", [postId]);
  return rows.length > 0;
};

const ensureCommentExists = async (commentId) => {
  const rows = await sql.query("SELECT 1 FROM comments WHERE comment_id = $1 LIMIT 1", [commentId]);
  return rows.length > 0;
};

const createAdminNotifications = async ({ title, message, type }) => {
  try {
    const admins = await sql.query("SELECT user_id FROM users WHERE user_role = 'admin' AND is_active = true");
    await Promise.all(
      admins.map((admin) =>
        sql.query(
          `
            INSERT INTO notifications (recipient_type, recipient_id, title, message, notification_type)
            VALUES ('user', $1, $2, $3, $4)
          `,
          [admin.user_id, title, message, type]
        )
      )
    );
  } catch (error) {
    console.error("Error creating admin community notification:", error);
  }
};

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
  const { category, q, user_id } = req.query;
  const values = [];
  const where = ["p.post_status = 'published'"];

  if (category && category !== "Tất cả") {
    values.push(category);
    where.push(`p.category = $${values.length}`);
  }

  if (q) {
    values.push(`%${q}%`);
    where.push(`(p.post_title ILIKE $${values.length} OR p.post_content ILIKE $${values.length})`);
  }

  values.push(user_id ?? null);
  const likedParam = values.length;

  try {
    const rows = await sql.query(
      `
        SELECT ${POST_SELECT},
          EXISTS (
            SELECT 1 FROM post_likes pl
            WHERE pl.post_id = p.post_id AND pl.user_id = $${likedParam}
          ) AS liked_by_user
        FROM posts p
        JOIN users u ON u.user_id = p.user_id
        WHERE ${where.join(" AND ")}
        ORDER BY p.created_at DESC, p.post_id DESC
      `,
      values
    );

    res.status(200).json({ success: true, data: rows.map(toPostPayload) });
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  try {
    const rows = await sql.query(
      `
        SELECT ${POST_SELECT},
          EXISTS (
            SELECT 1 FROM post_likes pl
            WHERE pl.post_id = p.post_id AND pl.user_id = $2
          ) AS liked_by_user
        FROM posts p
        JOIN users u ON u.user_id = p.user_id
        WHERE p.post_id = $1 AND p.post_status = 'published'
        LIMIT 1
      `,
      [id, user_id ?? null]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comments = await sql.query(
      `
        SELECT ${COMMENT_SELECT},
          EXISTS (
            SELECT 1 FROM comment_likes cl
            WHERE cl.comment_id = c.comment_id AND cl.user_id = $2
          ) AS liked_by_user
        FROM comments c
        JOIN users u ON u.user_id = c.user_id
        WHERE c.post_id = $1 AND c.comment_status = 'published'
        ORDER BY c.created_at ASC, c.comment_id ASC
      `,
      [id, user_id ?? null]
    );

    res.status(200).json({
      success: true,
      data: { ...toPostPayload(rows[0]), commentItems: comments.map(toCommentPayload) },
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
    if (!(await ensureUserExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const blockedWords = await findSensitiveWords(title, content);
    if (blockedWords.length > 0) {
      return res.status(400).json({
        error: "Nội dung chứa từ nhạy cảm. Vui lòng chỉnh sửa trước khi đăng.",
        data: { blockedWords },
      });
    }

    const created = await sql.query(
      `
        INSERT INTO posts (user_id, post_title, post_content, category)
        VALUES ($1, $2, $3, $4)
        RETURNING post_id
      `,
      [userId, title, content, category]
    );
    const postId = created[0].post_id;

    await Promise.all(
      imageUrls.map((imageUrl) =>
        sql.query("INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)", [postId, imageUrl])
      )
    );

    for (const tag of tags) {
      const inserted = await sql.query(
        `
          INSERT INTO tags (tag_name)
          VALUES ($1)
          ON CONFLICT (tag_name) DO UPDATE SET tag_name = EXCLUDED.tag_name
          RETURNING tag_id
        `,
        [tag]
      );
      await sql.query(
        `
          INSERT INTO post_tags (post_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [postId, inserted[0].tag_id]
      );
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
    if (!(await ensureUserExists(userId))) return res.status(404).json({ error: "User not found" });
    if (!(await ensurePostExists(id))) return res.status(404).json({ error: "Post not found" });

    const blockedWords = await findSensitiveWords(content);
    if (blockedWords.length > 0) {
      return res.status(400).json({
        error: "Bình luận chứa từ nhạy cảm. Vui lòng chỉnh sửa trước khi gửi.",
        data: { blockedWords },
      });
    }

    const created = await sql.query(
      `
        INSERT INTO comments (post_id, user_id, comment_content)
        VALUES ($1, $2, $3)
        RETURNING comment_id
      `,
      [id, userId, content]
    );

    const rows = await sql.query(
      `
        SELECT ${COMMENT_SELECT}, false AS liked_by_user
        FROM comments c
        JOIN users u ON u.user_id = c.user_id
        WHERE c.comment_id = $1
      `,
      [created[0].comment_id]
    );

    res.status(201).json({ success: true, data: toCommentPayload(rows[0]) });
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
    if (!(await ensureUserExists(userId))) return res.status(404).json({ error: "User not found" });
    if (!(await ensurePostExists(id))) return res.status(404).json({ error: "Post not found" });

    const deleted = await sql.query(
      "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2 RETURNING post_id",
      [id, userId]
    );
    const liked = deleted.length === 0;
    if (liked) {
      await sql.query(
        "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id, userId]
      );
    }

    const count = await sql.query("SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1", [id]);
    res.status(200).json({ success: true, data: { liked, likes: Number(count[0].count ?? 0) } });
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
    if (!(await ensureUserExists(userId))) return res.status(404).json({ error: "User not found" });
    if (!(await ensureCommentExists(commentId))) return res.status(404).json({ error: "Comment not found" });

    const deleted = await sql.query(
      "DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id",
      [commentId, userId]
    );
    const liked = deleted.length === 0;
    if (liked) {
      await sql.query(
        "INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [commentId, userId]
      );
    }

    const count = await sql.query("SELECT COUNT(*)::int AS count FROM comment_likes WHERE comment_id = $1", [commentId]);
    res.status(200).json({ success: true, data: { liked, likes: Number(count[0].count ?? 0) } });
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
    if (!(await ensureUserExists(reporterUserId))) return res.status(404).json({ error: "User not found" });
    const targetExists = targetType === "post" ? await ensurePostExists(targetId) : await ensureCommentExists(targetId);
    if (!targetExists) return res.status(404).json({ error: "Reported content not found" });

    const created = await sql.query(
      `
        INSERT INTO content_reports (reporter_user_id, target_type, target_id, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [reporterUserId, targetType, targetId, reason]
    );

    await createAdminNotifications({
      title: "Có báo cáo nội dung mới",
      message: `Người dùng báo cáo ${targetType === "post" ? "bài viết" : "bình luận"} #${targetId}.`,
      type: "content_report",
    });

    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error("Error creating content report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getReports = async (req, res) => {
  const { status } = req.query;
  const values = [];
  const where = [];

  if (status) {
    values.push(status);
    where.push(`cr.status = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const rows = await sql.query(
      `
        SELECT
          cr.*,
          reporter.full_name AS reporter_full_name,
          reporter.user_name AS reporter_user_name,
          p.post_title,
          p.post_content,
          p.post_status,
          c.comment_content,
          c.comment_status,
          COALESCE(post_author.full_name, post_author.user_name, comment_author.full_name, comment_author.user_name) AS target_author_name
        FROM content_reports cr
        LEFT JOIN users reporter ON reporter.user_id = cr.reporter_user_id
        LEFT JOIN posts p ON cr.target_type = 'post' AND p.post_id = cr.target_id
        LEFT JOIN users post_author ON post_author.user_id = p.user_id
        LEFT JOIN comments c ON cr.target_type = 'comment' AND c.comment_id = cr.target_id
        LEFT JOIN users comment_author ON comment_author.user_id = c.user_id
        ${whereSql}
        ORDER BY cr.created_at DESC, cr.report_id DESC
      `,
      values
    );

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
    const updated = await sql.query(
      "UPDATE content_reports SET status = $1 WHERE report_id = $2 RETURNING *",
      [status, id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Report not found" });
    res.status(200).json({ success: true, data: updated[0] });
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
    const updated = await sql.query(
      "UPDATE posts SET post_status = $1 WHERE post_id = $2 RETURNING *",
      [status, id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Post not found" });
    res.status(200).json({ success: true, data: updated[0] });
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
    const updated = await sql.query(
      "UPDATE comments SET comment_status = $1 WHERE comment_id = $2 RETURNING *",
      [status, commentId]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Comment not found" });
    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    console.error(`Error updating comment ${commentId} status:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
