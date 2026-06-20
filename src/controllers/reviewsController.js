import { getRequestSummary } from "../repositories/entityRepository.js";
import {
  deleteReviewByRequestId,
  findRequestReview,
  findCompanyReviews,
  getCompanyRatingSummary,
  insertReview,
  updateReviewByRequestId,
} from "../repositories/reviewRepository.js";
import { createNotification } from "../services/notificationService.js";
import { isUniqueViolation } from "../utils/dbErrors.js";

export const addReview = async (req, res) => {
  const { id } = req.params; // request id
  const { review_rating, review_comment } = req.body;

  if (review_rating == null || typeof review_rating !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid field: review_rating' });
  }

  try {
    const requestRow = await getRequestSummary(id);
    if (!requestRow) return res.status(404).json({ error: 'Request not found' });

    // Optionally enforce that review only after completed
    if (requestRow.request_status !== 'completed') {
      return res.status(400).json({ error: 'Can only review after request is completed' });
    }

    // Insert review (DB has UNIQUE(request_id) so handle conflict)
    const created = await insertReview(id, { review_rating, review_comment });

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

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error(`Error adding review for request ${id}:`, error);
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Review for this request already exists' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const isValidRating = (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

export const getRequestReview = async (req, res) => {
  try {
    const review = await findRequestReview(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error(`Error fetching review for request ${req.params.id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateReview = async (req, res) => {
  const { review_rating, review_comment } = req.body;
  if (!isValidRating(review_rating)) {
    return res.status(400).json({ error: "review_rating must be an integer from 1 to 5" });
  }

  try {
    const updated = await updateReviewByRequestId(req.params.id, {
      review_rating,
      review_comment,
    });
    if (!updated) return res.status(404).json({ error: "Review not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error updating review for request ${req.params.id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const deleted = await deleteReviewByRequestId(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Review not found" });
    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(`Error deleting review for request ${req.params.id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompanyReviews = async (req, res) => {
  const { id } = req.params; // company id

  try {
    const rows = await findCompanyReviews(id);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching reviews for company ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getCompanyRating = async (req, res) => {
  const { id } = req.params; // company id

  try {
    const rating = await getCompanyRatingSummary(id);

    res.status(200).json({ success: true, data: rating });
  } catch (error) {
    console.error(`Error fetching rating for company ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
