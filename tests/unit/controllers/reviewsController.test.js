import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const entityRepository = vi.hoisted(() => ({
  getRequestSummary: vi.fn(),
}));

const reviewRepository = vi.hoisted(() => ({
  deleteReviewByRequestId: vi.fn(),
  findRequestReview: vi.fn(),
  findCompanyReviews: vi.fn(),
  getCompanyRatingSummary: vi.fn(),
  insertReview: vi.fn(),
  updateReviewByRequestId: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createNotification: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/reviewRepository.js", () => reviewRepository);
vi.mock("../../../src/services/notificationService.js", () => notificationService);

const {
  addReview,
  deleteReview,
  getCompanyRating,
  getCompanyReviews,
  getRequestReview,
  updateReview,
} = await import("../../../src/controllers/reviewsController.js");

describe("reviewsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates review rating and completed request status", async () => {
    const invalidRes = createMockResponse();
    await addReview({ params: { id: "10" }, body: { review_rating: "5" } }, invalidRes);

    entityRepository.getRequestSummary.mockResolvedValue({
      request_id: 10,
      company_id: 2,
      request_status: "pending",
    });
    const pendingRes = createMockResponse();
    await addReview({ params: { id: "10" }, body: { review_rating: 5 } }, pendingRes);

    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(pendingRes.status).toHaveBeenCalledWith(400);
    expect(pendingRes.json).toHaveBeenCalledWith({
      error: "Can only review after request is completed",
    });
  });

  it("creates review and notifies company", async () => {
    const created = { review_id: 1 };
    entityRepository.getRequestSummary.mockResolvedValue({
      request_id: 10,
      company_id: 2,
      request_status: "completed",
    });
    reviewRepository.insertReview.mockResolvedValue(created);
    const res = createMockResponse();

    await addReview(
      { params: { id: "10" }, body: { review_rating: 5, review_comment: "Good" } },
      res
    );

    expect(reviewRepository.insertReview).toHaveBeenCalledWith("10", {
      review_rating: 5,
      review_comment: "Good",
    });
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientType: "company",
        recipientId: 2,
        requestId: "10",
        type: "review_created",
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
  });

  it("returns 409 when request already has a review", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    entityRepository.getRequestSummary.mockResolvedValue({
      request_id: 10,
      company_id: 2,
      request_status: "completed",
    });
    reviewRepository.insertReview.mockRejectedValue({ code: "23505" });
    const res = createMockResponse();

    await addReview({ params: { id: "10" }, body: { review_rating: 5 } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("returns company reviews and rating summaries", async () => {
    const reviews = [{ review_id: 1 }];
    const rating = { average_rating: 4.5, review_count: 2 };
    reviewRepository.findCompanyReviews.mockResolvedValue(reviews);
    reviewRepository.getCompanyRatingSummary.mockResolvedValue(rating);

    const reviewsRes = createMockResponse();
    await getCompanyReviews({ params: { id: "2" } }, reviewsRes);

    const ratingRes = createMockResponse();
    await getCompanyRating({ params: { id: "2" } }, ratingRes);

    expect(reviewsRes.json).toHaveBeenCalledWith({ success: true, data: reviews });
    expect(ratingRes.json).toHaveBeenCalledWith({ success: true, data: rating });
  });

  it("gets, updates, and deletes a request review", async () => {
    const review = { review_id: 1, request_id: 10, review_rating: 4 };
    reviewRepository.findRequestReview.mockResolvedValue(review);
    reviewRepository.updateReviewByRequestId.mockResolvedValue({
      ...review,
      review_rating: 5,
    });
    reviewRepository.deleteReviewByRequestId.mockResolvedValue(review);

    const getRes = createMockResponse();
    await getRequestReview({ params: { id: "10" } }, getRes);
    expect(getRes.status).toHaveBeenCalledWith(200);

    const updateRes = createMockResponse();
    await updateReview(
      {
        params: { id: "10" },
        body: { review_rating: 5, review_comment: "Rất tốt" },
      },
      updateRes
    );
    expect(reviewRepository.updateReviewByRequestId).toHaveBeenCalledWith("10", {
      review_rating: 5,
      review_comment: "Rất tốt",
    });
    expect(updateRes.status).toHaveBeenCalledWith(200);

    const deleteRes = createMockResponse();
    await deleteReview({ params: { id: "10" } }, deleteRes);
    expect(reviewRepository.deleteReviewByRequestId).toHaveBeenCalledWith("10");
    expect(deleteRes.status).toHaveBeenCalledWith(200);
  });
});
