import { sql } from "../config/db.js";

const ensureRequestExists = async (requestId) => {
  const rows = await sql.query(
    "SELECT request_id, company_id, request_status FROM requests WHERE request_id = $1 LIMIT 1",
    [requestId]
  );
  return rows[0] ?? null;
};

const createNotification = async ({ recipientType, recipientId, requestId, title, message, type }) => {
  if (!recipientType || recipientId == null || !title || !message) return;
  try {
    await sql.query(
      `
        INSERT INTO notifications (
          recipient_type,
          recipient_id,
          request_id,
          title,
          message,
          notification_type
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [recipientType, recipientId, requestId ?? null, title, message, type ?? null]
    );
  } catch (error) {
    console.error("Error creating notification (reviews):", error);
  }
};

export const addReview = async (req, res) => {
  const { id } = req.params; // request id
  const { review_rating, review_comment } = req.body;

  if (review_rating == null || typeof review_rating !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid field: review_rating' });
  }

  try {
    const requestRow = await ensureRequestExists(id);
    if (!requestRow) return res.status(404).json({ error: 'Request not found' });

    // Optionally enforce that review only after completed
    if (requestRow.request_status !== 'completed') {
      return res.status(400).json({ error: 'Can only review after request is completed' });
    }

    // Insert review (DB has UNIQUE(request_id) so handle conflict)
    const created = await sql.query(
      `
        INSERT INTO reviews (request_id, review_rating, review_comment)
        VALUES ($1, $2, $3)
        RETURNING review_id, request_id, review_rating, review_comment, reviewed_at
      `,
      [id, review_rating, review_comment ?? null]
    );

    // Notify company if available
    if (requestRow.company_id != null) {
      await createNotification({
        recipientType: 'company',
        recipientId: requestRow.company_id,
        requestId: id,
        title: 'Bạn vừa nhận được đánh giá mới',
        message: 'Khách hàng đã gửi đánh giá cho dịch vụ cứu hộ.',
        type: 'review_created',
      });
    }

    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error(`Error adding review for request ${id}:`, error);
    if (error && error.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Review for this request already exists' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getCompanyReviews = async (req, res) => {
  const { id } = req.params; // company id

  try {
    const rows = await sql.query(
      `
        SELECT r.review_id, r.request_id, r.review_rating, r.review_comment, r.reviewed_at,
               req.user_id
        FROM reviews r
        JOIN requests req ON req.request_id = r.request_id
        WHERE req.company_id = $1
        ORDER BY r.reviewed_at DESC
      `,
      [id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching reviews for company ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getCompanyRating = async (req, res) => {
  const { id } = req.params; // company id

  try {
    const rows = await sql.query(
      `
        SELECT COUNT(*)::int AS review_count, COALESCE(ROUND(AVG(r.review_rating)::numeric,2),0) AS average_rating
        FROM reviews r
        JOIN requests req ON req.request_id = r.request_id
        WHERE req.company_id = $1
      `,
      [id]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(`Error fetching rating for company ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
