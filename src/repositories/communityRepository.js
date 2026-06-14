import { sql } from "../config/db.js";

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

export const findPosts = async ({ category, q, userId, authorUserId }) => {
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

  if (authorUserId) {
    values.push(authorUserId);
    where.push(`p.user_id = $${values.length}`);
  }

  values.push(userId ?? null);
  const likedParam = values.length;

  return sql.query(
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
};

export const findPublishedPostById = async (postId, userId) => {
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
    [postId, userId ?? null]
  );
  return rows[0] ?? null;
};

export const findPublishedCommentsByPostId = async (postId, userId) => {
  return sql.query(
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
    [postId, userId ?? null]
  );
};

export const insertPost = async ({ userId, title, content, category }) => {
  const rows = await sql.query(
    `
      INSERT INTO posts (user_id, post_title, post_content, category)
      VALUES ($1, $2, $3, $4)
      RETURNING post_id
    `,
    [userId, title, content, category]
  );
  return rows[0].post_id;
};

export const insertPostImage = async (postId, imageUrl) => {
  await sql.query("INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)", [postId, imageUrl]);
};

export const replacePostImages = async (postId, imageUrls) => {
  await sql.query("DELETE FROM post_images WHERE post_id = $1", [postId]);
  await Promise.all(imageUrls.map((imageUrl) => insertPostImage(postId, imageUrl)));
};

export const upsertTag = async (tag) => {
  const rows = await sql.query(
    `
      INSERT INTO tags (tag_name)
      VALUES ($1)
      ON CONFLICT (tag_name) DO UPDATE SET tag_name = EXCLUDED.tag_name
      RETURNING tag_id
    `,
    [tag]
  );
  return rows[0].tag_id;
};

export const linkPostTag = async (postId, tagId) => {
  await sql.query(
    `
      INSERT INTO post_tags (post_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [postId, tagId]
  );
};

export const replacePostTags = async (postId, tags) => {
  await sql.query("DELETE FROM post_tags WHERE post_id = $1", [postId]);
  for (const tag of tags) {
    const tagId = await upsertTag(tag);
    await linkPostTag(postId, tagId);
  }
};

export const findPostOwner = async (postId) => {
  const rows = await sql.query("SELECT post_id, user_id, post_status FROM posts WHERE post_id = $1", [postId]);
  return rows[0] ?? null;
};

export const updatePostByOwner = async ({ postId, userId, title, content, category }) => {
  const rows = await sql.query(
    `
      UPDATE posts
      SET post_title = $3,
          post_content = $4,
          category = $5
      WHERE post_id = $1 AND user_id = $2 AND post_status = 'published'
      RETURNING post_id
    `,
    [postId, userId, title, content, category]
  );
  return rows[0] ?? null;
};

export const insertComment = async ({ postId, userId, content }) => {
  const rows = await sql.query(
    `
      INSERT INTO comments (post_id, user_id, comment_content)
      VALUES ($1, $2, $3)
      RETURNING comment_id
    `,
    [postId, userId, content]
  );
  return rows[0].comment_id;
};

export const findCommentByIdForPayload = async (commentId) => {
  const rows = await sql.query(
    `
      SELECT ${COMMENT_SELECT}, false AS liked_by_user
      FROM comments c
      JOIN users u ON u.user_id = c.user_id
      WHERE c.comment_id = $1
    `,
    [commentId]
  );
  return rows[0] ?? null;
};

export const togglePostLikeByUser = async (postId, userId) => {
  const deleted = await sql.query(
    "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2 RETURNING post_id",
    [postId, userId]
  );
  const liked = deleted.length === 0;
  if (liked) {
    await sql.query(
      "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [postId, userId]
    );
  }
  return liked;
};

export const countPostLikes = async (postId) => {
  const rows = await sql.query("SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1", [postId]);
  return Number(rows[0].count ?? 0);
};

export const toggleCommentLikeByUser = async (commentId, userId) => {
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
  return liked;
};

export const countCommentLikes = async (commentId) => {
  const rows = await sql.query(
    "SELECT COUNT(*)::int AS count FROM comment_likes WHERE comment_id = $1",
    [commentId]
  );
  return Number(rows[0].count ?? 0);
};

export const insertContentReport = async ({ reporterUserId, targetType, targetId, reason }) => {
  const rows = await sql.query(
    `
      INSERT INTO content_reports (reporter_user_id, target_type, target_id, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [reporterUserId, targetType, targetId, reason]
  );
  return rows[0];
};

export const findContentReports = async ({ status }) => {
  const values = [];
  const where = [];

  if (status) {
    values.push(status);
    where.push(`cr.status = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return sql.query(
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
};

export const updateContentReportStatus = async (reportId, status) => {
  const rows = await sql.query(
    "UPDATE content_reports SET status = $1 WHERE report_id = $2 RETURNING *",
    [status, reportId]
  );
  return rows[0] ?? null;
};

export const updatePostStatusById = async (postId, status) => {
  const rows = await sql.query(
    "UPDATE posts SET post_status = $1 WHERE post_id = $2 RETURNING *",
    [status, postId]
  );
  return rows[0] ?? null;
};

export const updateCommentStatusById = async (commentId, status) => {
  const rows = await sql.query(
    "UPDATE comments SET comment_status = $1 WHERE comment_id = $2 RETURNING *",
    [status, commentId]
  );
  return rows[0] ?? null;
};
