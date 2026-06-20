import { sql } from "../config/db.js";

export const insertReview = async (requestId, { review_rating, review_comment }) => {
  const rows = await sql.query(
    `
      INSERT INTO reviews (request_id, review_rating, review_comment)
      VALUES ($1, $2, $3)
      RETURNING review_id, request_id, review_rating, review_comment, reviewed_at
    `,
    [requestId, review_rating, review_comment ?? null]
  );
  return rows[0];
};

export const findRequestReview = async (requestId) => {
  const rows = await sql.query(
    `
      SELECT review_id, request_id, review_rating, review_comment, reviewed_at
      FROM reviews
      WHERE request_id = $1
      LIMIT 1
    `,
    [requestId]
  );
  return rows[0] ?? null;
};

export const updateReviewByRequestId = async (
  requestId,
  { review_rating, review_comment }
) => {
  const rows = await sql.query(
    `
      UPDATE reviews
      SET
        review_rating = $2,
        review_comment = $3,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE request_id = $1
      RETURNING review_id, request_id, review_rating, review_comment, reviewed_at
    `,
    [requestId, review_rating, review_comment ?? null]
  );
  return rows[0] ?? null;
};

export const deleteReviewByRequestId = async (requestId) => {
  const rows = await sql.query(
    `
      DELETE FROM reviews
      WHERE request_id = $1
      RETURNING review_id, request_id, review_rating, review_comment, reviewed_at
    `,
    [requestId]
  );
  return rows[0] ?? null;
};

export const findCompanyReviews = async (companyId) => {
  return sql.query(
    `
      SELECT r.review_id, r.request_id, r.review_rating, r.review_comment, r.reviewed_at,
             req.user_id, u.full_name, u.user_name, u.avatar_url
      FROM reviews r
      JOIN requests req ON req.request_id = r.request_id
      LEFT JOIN users u ON u.user_id = req.user_id
      WHERE req.company_id = $1
      ORDER BY r.reviewed_at DESC
    `,
    [companyId]
  );
};

export const getCompanyRatingSummary = async (companyId) => {
  const rows = await sql.query(
    `
      SELECT COUNT(*)::int AS review_count, COALESCE(ROUND(AVG(r.review_rating)::numeric,2),0) AS average_rating
      FROM reviews r
      JOIN requests req ON req.request_id = r.request_id
      WHERE req.company_id = $1
    `,
    [companyId]
  );
  return rows[0];
};
