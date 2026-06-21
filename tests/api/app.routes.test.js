import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authRepository = vi.hoisted(() => ({
  findCompanyAuthByIdentifier: vi.fn(),
  findExistingCompanyRegistration: vi.fn(),
  findExistingUserRegistration: vi.fn(),
  findUserAuthByIdentifier: vi.fn(),
  insertRegisteredCompany: vi.fn(),
  insertRegisteredUser: vi.fn(),
}));

const companyRepository = vi.hoisted(() => ({
  deleteCompanyById: vi.fn(),
  findAllCompanies: vi.fn(),
  findCompanyById: vi.fn(),
  findCompanyReports: vi.fn(),
  findCompanyRatingsByIds: vi.fn(),
  findNearbyCompanies: vi.fn(),
  insertCompany: vi.fn(),
  insertCompanyReport: vi.fn(),
  updateCompanyById: vi.fn(),
  updateCompanyReportStatusById: vi.fn(),
}));

const companyServiceRepository = vi.hoisted(() => ({
  deleteCompanyServiceById: vi.fn(),
  findCompanyServices: vi.fn(),
  updateCompanyServicePrice: vi.fn(),
  upsertCompanyService: vi.fn(),
}));

const communityRepository = vi.hoisted(() => ({
  countCommentLikes: vi.fn(),
  countPostLikes: vi.fn(),
  findCommentByIdForPayload: vi.fn(),
  findContentReports: vi.fn(),
  findPosts: vi.fn(),
  findPublishedCommentsByPostId: vi.fn(),
  findPublishedPostById: vi.fn(),
  insertComment: vi.fn(),
  insertContentReport: vi.fn(),
  insertPost: vi.fn(),
  insertPostImage: vi.fn(),
  linkPostTag: vi.fn(),
  toggleCommentLikeByUser: vi.fn(),
  togglePostLikeByUser: vi.fn(),
  updateCommentStatusById: vi.fn(),
  updateContentReportStatus: vi.fn(),
  updatePostStatusById: vi.fn(),
  upsertTag: vi.fn(),
}));

const entityRepository = vi.hoisted(() => ({
  commentExists: vi.fn(),
  companyExists: vi.fn(),
  getRequestSummary: vi.fn(),
  postExists: vi.fn(),
  requestExists: vi.fn(),
  serviceExists: vi.fn(),
  userExists: vi.fn(),
  vehicleBelongsToCompany: vi.fn(),
  vehicleExists: vi.fn(),
}));

const notificationRepository = vi.hoisted(() => ({
  findActiveAdminUserIds: vi.fn(),
  findNotifications: vi.fn(),
  insertNotification: vi.fn(),
  markNotificationReadById: vi.fn(),
}));

const paymentRepository = vi.hoisted(() => ({
  findLatestPaymentByRequest: vi.fn(),
  findPaymentRequest: vi.fn(),
  findPaymentTransactionByRef: vi.fn(),
  insertPaymentTransaction: vi.fn(),
  setRequestPaymentState: vi.fn(),
  updatePaymentTransaction: vi.fn(),
}));

const requestImageRepository = vi.hoisted(() => ({
  deleteRequestImageById: vi.fn(),
  findRequestImages: vi.fn(),
  insertRequestImage: vi.fn(),
}));

const requestMessageRepository = vi.hoisted(() => ({
  findRequestMessages: vi.fn(),
  insertRequestMessage: vi.fn(),
  updateMessageSeen: vi.fn(),
}));

const requestServiceRepository = vi.hoisted(() => ({
  deleteRequestServiceById: vi.fn(),
  findRequestServices: vi.fn(),
  updateRequestServiceById: vi.fn(),
  upsertRequestService: vi.fn(),
}));

const reviewRepository = vi.hoisted(() => ({
  findCompanyReviews: vi.fn(),
  getCompanyRatingSummary: vi.fn(),
  insertReview: vi.fn(),
}));

const serviceRepository = vi.hoisted(() => ({
  findAllServices: vi.fn(),
}));

const sensitiveWordService = vi.hoisted(() => ({
  findSensitiveWords: vi.fn(),
}));

const vehicleRepository = vi.hoisted(() => ({
  deleteVehicleById: vi.fn(),
  findVehiclesByCompany: vi.fn(),
  insertVehicle: vi.fn(),
  updateVehicleById: vi.fn(),
}));

vi.mock("../../src/repositories/authRepository.js", () => authRepository);
vi.mock("../../src/repositories/companyRepository.js", () => companyRepository);
vi.mock("../../src/repositories/companyServiceRepository.js", () => companyServiceRepository);
vi.mock("../../src/repositories/communityRepository.js", () => communityRepository);
vi.mock("../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../src/repositories/notificationRepository.js", () => notificationRepository);
vi.mock("../../src/repositories/paymentRepository.js", () => paymentRepository);
vi.mock("../../src/repositories/requestImageRepository.js", () => requestImageRepository);
vi.mock("../../src/repositories/requestMessageRepository.js", () => requestMessageRepository);
vi.mock("../../src/repositories/requestServiceRepository.js", () => requestServiceRepository);
vi.mock("../../src/repositories/reviewRepository.js", () => reviewRepository);
vi.mock("../../src/repositories/serviceRepository.js", () => serviceRepository);
vi.mock("../../src/repositories/vehicleRepository.js", () => vehicleRepository);
vi.mock("../../src/services/sensitiveWordService.js", () => sensitiveWordService);

const { default: app } = await import("../../src/app.js");

describe("API routes", () => {
  const cloudinaryEnv = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.companyExists.mockResolvedValue(true);
    entityRepository.commentExists.mockResolvedValue(true);
    entityRepository.getRequestSummary.mockResolvedValue({
      request_id: 10,
      company_id: 2,
      request_status: "completed",
    });
    entityRepository.postExists.mockResolvedValue(true);
    entityRepository.requestExists.mockResolvedValue(true);
    entityRepository.serviceExists.mockResolvedValue(true);
    entityRepository.userExists.mockResolvedValue(true);
    notificationRepository.findActiveAdminUserIds.mockResolvedValue([]);
    sensitiveWordService.findSensitiveWords.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = cloudinaryEnv.cloudName;
    process.env.CLOUDINARY_API_KEY = cloudinaryEnv.apiKey;
    process.env.CLOUDINARY_API_SECRET = cloudinaryEnv.apiSecret;
  });

  it("returns app-level JSON 404 responses", async () => {
    const response = await request(app).get("/api/does-not-exist").expect(404);

    expect(response.body).toEqual({
      error: "Route not found",
      path: "/api/does-not-exist",
    });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("logs in users through the auth route", async () => {
    const passwordHash = await bcrypt.hash("secret", 4);
    authRepository.findUserAuthByIdentifier.mockResolvedValue({
      user_id: 1,
      user_name: "john",
      full_name: "John",
      user_phone: "090",
      user_email: "john@example.test",
      avatar_url: null,
      user_role: "user",
      is_active: true,
      registered_at: "2026-01-01",
      password_hash: passwordHash,
    });

    const response = await request(app)
      .post("/api/auth/users/login")
      .send({ identifier: "john", password: "secret" })
      .expect(200);

    expect(authRepository.findUserAuthByIdentifier).toHaveBeenCalledWith("john");
    expect(response.body).toEqual({
      success: true,
      role: "user",
      data: expect.not.objectContaining({ password_hash: expect.anything() }),
    });
    expect(response.body.data).toMatchObject({
      user_id: 1,
      user_name: "john",
      user_phone: "090",
    });
  });

  it("returns services through the services route", async () => {
    const rows = [{ service_id: 1, service_name: "Towing", service_description: "Tow car" }];
    serviceRepository.findAllServices.mockResolvedValue(rows);

    const response = await request(app).get("/api/services").expect(200);

    expect(response.body).toEqual({ success: true, data: rows });
  });

  it("creates vehicles through the vehicles route", async () => {
    const created = {
      vehicle_id: 7,
      company_id: 2,
      vehicle_license: "30A-12345",
      vehicle_type: "Tow",
      vehicle_status: "available",
    };
    vehicleRepository.insertVehicle.mockResolvedValue(created);

    const response = await request(app)
      .post("/api/vehicles")
      .send({
        company_id: 2,
        vehicle_license: "30A-12345",
        vehicle_type: "Tow",
        current_location: { lat: 21, lng: 105 },
      })
      .expect(201);

    expect(vehicleRepository.insertVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 2,
        vehicle_license: "30A-12345",
        geogText: "SRID=4326;POINT(105 21)",
      })
    );
    expect(response.body).toEqual({ success: true, data: created });
  });

  it("creates request messages through nested request routes", async () => {
    const created = {
      message_id: 3,
      request_id: 10,
      message_sender: "user",
      message_content: "Help",
      is_seen: false,
    };
    requestMessageRepository.insertRequestMessage.mockResolvedValue(created);

    const response = await request(app)
      .post("/api/requests/10/messages")
      .send({ message_sender: "user", message_content: "Help" })
      .expect(201);

    expect(entityRepository.requestExists).toHaveBeenCalledWith("10");
    expect(requestMessageRepository.insertRequestMessage).toHaveBeenCalledWith("10", {
      message_sender: "user",
      message_content: "Help",
      is_seen: undefined,
    });
    expect(response.body).toEqual({ success: true, data: created });
  });

  it("returns Cloudinary signatures through request utility route", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-13T10:00:00.000Z"));

    const response = await request(app)
      .post("/api/requests/cloudinary/signature")
      .send({ folder: "rescuesos/community" })
      .expect(200);

    const timestamp = Math.floor(new Date("2026-06-13T10:00:00.000Z").getTime() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`folder=rescuesos/community&timestamp=${timestamp}secret`)
      .digest("hex");

    expect(response.body).toEqual({
      success: true,
      data: {
        cloudName: "demo",
        apiKey: "key",
        timestamp,
        folder: "rescuesos/community",
        signature,
      },
    });

    vi.useRealTimers();
  });

  it("searches nearby companies and returns batch ratings", async () => {
    companyRepository.findNearbyCompanies.mockResolvedValue([{ company_id: 2 }]);
    companyRepository.findCompanyRatingsByIds.mockResolvedValue([
      { company_id: 2, average_rating: "4.75", review_count: "4" },
    ]);

    const nearbyResponse = await request(app)
      .get("/api/companies/nearby")
      .query({ latitude: "21", longitude: "105", radiusKm: "3" })
      .expect(200);

    const ratingsResponse = await request(app)
      .get("/api/companies/ratings")
      .query({ ids: "2,not-a-number" })
      .expect(200);

    expect(companyRepository.findNearbyCompanies).toHaveBeenCalledWith({
      latitude: 21,
      longitude: 105,
      radiusMeters: 3000,
    });
    expect(nearbyResponse.body).toEqual({
      success: true,
      data: [{ company_id: 2 }],
      userLocation: { latitude: 21, longitude: 105 },
      radiusKm: 3,
    });
    expect(ratingsResponse.body).toEqual({
      success: true,
      data: { 2: { average_rating: 4.75, review_count: 4 } },
    });
  });

  it("manages company services through nested company routes", async () => {
    const row = { company_id: 2, service_id: 4, service_price: 120000 };
    companyServiceRepository.upsertCompanyService.mockResolvedValue(row);
    companyServiceRepository.updateCompanyServicePrice.mockResolvedValue({
      ...row,
      service_price: 150000,
    });

    const addResponse = await request(app)
      .post("/api/companies/2/services")
      .send({ service_id: 4, service_price: 120000 })
      .expect(201);

    const updateResponse = await request(app)
      .put("/api/companies/2/services/4")
      .send({ service_price: 150000 })
      .expect(200);

    expect(companyServiceRepository.upsertCompanyService).toHaveBeenCalledWith(
      "2",
      4,
      120000
    );
    expect(addResponse.body).toEqual({ success: true, data: row });
    expect(updateResponse.body.data.service_price).toBe(150000);
  });

  it("returns company reviews and rating through company routes", async () => {
    reviewRepository.findCompanyReviews.mockResolvedValue([{ review_id: 1 }]);
    reviewRepository.getCompanyRatingSummary.mockResolvedValue({
      review_count: 1,
      average_rating: "5.00",
    });

    const reviewsResponse = await request(app).get("/api/companies/2/reviews").expect(200);
    const ratingResponse = await request(app).get("/api/companies/2/rating").expect(200);

    expect(reviewsResponse.body).toEqual({ success: true, data: [{ review_id: 1 }] });
    expect(ratingResponse.body).toEqual({
      success: true,
      data: { review_count: 1, average_rating: "5.00" },
    });
  });

  it("returns and marks notifications through notification routes", async () => {
    const notification = { notification_id: 1, is_read: false };
    const readNotification = { notification_id: 1, is_read: true };
    notificationRepository.findNotifications.mockResolvedValue([notification]);
    notificationRepository.markNotificationReadById.mockResolvedValue(readNotification);

    const listResponse = await request(app)
      .get("/api/notifications")
      .query({ recipient_type: "user", recipient_id: "5", limit: "10" })
      .expect(200);

    const readResponse = await request(app).put("/api/notifications/1/read").expect(200);

    expect(notificationRepository.findNotifications).toHaveBeenCalledWith({
      recipientType: "user",
      recipientId: "5",
      limit: 10,
    });
    expect(listResponse.body).toEqual({ success: true, data: [notification] });
    expect(readResponse.body).toEqual({ success: true, data: readNotification });
  });

  it("selects cash payment through payment routes", async () => {
    paymentRepository.findPaymentRequest.mockResolvedValue({
      request_id: 10,
      user_id: 5,
      company_id: 2,
      request_status: "completed",
      final_price: 250000,
      payment_status: "unpaid",
    });
    paymentRepository.setRequestPaymentState.mockResolvedValue({
      request_id: 10,
      payment_method: "cash",
      payment_status: "pending",
    });

    const response = await request(app)
      .post("/api/payments/requests/10/cash")
      .send({ user_id: 5 })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        payment_method: "cash",
        payment_status: "pending",
      })
    );
  });

  it("manages request services and images through nested request routes", async () => {
    const serviceLine = { request_id: 10, service_id: 4 };
    const image = { image_id: 1, request_id: 10, image_url: "https://img" };
    requestServiceRepository.upsertRequestService.mockResolvedValue(serviceLine);
    requestImageRepository.insertRequestImage.mockResolvedValue(image);

    const serviceResponse = await request(app)
      .post("/api/requests/10/services")
      .send({ service_id: 4, service_quantity: 1, service_price: 50000 })
      .expect(201);

    const imageResponse = await request(app)
      .post("/api/requests/10/images")
      .send({ image_url: "https://img" })
      .expect(201);

    expect(requestServiceRepository.upsertRequestService).toHaveBeenCalledWith("10", {
      service_id: 4,
      service_quantity: 1,
      service_price: 50000,
    });
    expect(requestImageRepository.insertRequestImage).toHaveBeenCalledWith("10", "https://img");
    expect(serviceResponse.body).toEqual({ success: true, data: serviceLine });
    expect(imageResponse.body).toEqual({ success: true, data: image });
  });

  it("creates reviews through request review route", async () => {
    const created = { review_id: 1, request_id: 10, review_rating: 5 };
    reviewRepository.insertReview.mockResolvedValue(created);

    const response = await request(app)
      .post("/api/requests/10/review")
      .send({ review_rating: 5, review_comment: "Great" })
      .expect(201);

    expect(reviewRepository.insertReview).toHaveBeenCalledWith("10", {
      review_rating: 5,
      review_comment: "Great",
    });
    expect(notificationRepository.insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientType: "company",
        recipientId: 2,
        requestId: "10",
        type: "review_created",
      })
    );
    expect(response.body).toEqual({ success: true, data: created });
  });

  it("handles community post, comment, like, report, and moderation routes", async () => {
    const postRow = {
      post_id: 20,
      user_id: 5,
      full_name: "John",
      user_name: "john",
      avatar_url: null,
      post_title: "Need help",
      post_content: "Content",
      post_status: "published",
      category: "Help",
      created_at: "2026-01-01",
      images: [],
      tags: [],
      likes_count: 0,
      comments_count: 0,
      liked_by_user: false,
    };
    const commentRow = {
      comment_id: 30,
      post_id: 20,
      user_id: 5,
      full_name: "John",
      user_name: "john",
      avatar_url: null,
      comment_content: "Same issue",
      comment_status: "published",
      created_at: "2026-01-01",
      likes_count: 0,
      liked_by_user: false,
    };
    communityRepository.findPosts.mockResolvedValue([postRow]);
    communityRepository.insertComment.mockResolvedValue(30);
    communityRepository.findCommentByIdForPayload.mockResolvedValue(commentRow);
    communityRepository.togglePostLikeByUser.mockResolvedValue(true);
    communityRepository.countPostLikes.mockResolvedValue(1);
    communityRepository.insertContentReport.mockResolvedValue({ report_id: 1 });
    communityRepository.updatePostStatusById.mockResolvedValue({
      post_id: 20,
      post_status: "hidden",
    });

    const postsResponse = await request(app).get("/api/community/posts").expect(200);
    const commentResponse = await request(app)
      .post("/api/community/posts/20/comments")
      .send({ user_id: 5, content: "Same issue" })
      .expect(201);
    const likeResponse = await request(app)
      .post("/api/community/posts/20/like")
      .send({ user_id: 5 })
      .expect(200);
    const reportResponse = await request(app)
      .post("/api/community/reports")
      .send({
        reporter_user_id: 5,
        target_type: "post",
        target_id: 20,
        reason: "Spam",
      })
      .expect(201);
    const statusResponse = await request(app)
      .put("/api/community/posts/20/status")
      .send({ status: "hidden" })
      .expect(200);

    expect(postsResponse.body.data[0]).toMatchObject({ post_id: 20, title: "Need help" });
    expect(commentResponse.body.data).toMatchObject({ comment_id: 30, content: "Same issue" });
    expect(likeResponse.body).toEqual({ success: true, data: { liked: true, likes: 1 } });
    expect(reportResponse.body).toEqual({ success: true, data: { report_id: 1 } });
    expect(statusResponse.body.data).toMatchObject({ post_id: 20, post_status: "hidden" });
  });
});
