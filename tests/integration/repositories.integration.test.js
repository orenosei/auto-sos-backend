import { beforeAll, afterAll, describe, expect, it } from "vitest";

const describeIntegration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIntegration("repository integration tests", () => {
  const suffix = `itest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const marker = `%${suffix}%`;
  const ids = {};

  let sql;
  let authRepository;
  let communityRepository;
  let companyRepository;
  let entityRepository;
  let notificationRepository;
  let requestImageRepository;
  let requestMessageRepository;
  let requestRepository;
  let reviewRepository;
  let serviceRepository;
  let vehicleRepository;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

    [
      { sql },
      authRepository,
      communityRepository,
      companyRepository,
      entityRepository,
      notificationRepository,
      requestImageRepository,
      requestMessageRepository,
      requestRepository,
      reviewRepository,
      serviceRepository,
      vehicleRepository,
    ] = await Promise.all([
      import("../../src/config/db.js"),
      import("../../src/repositories/authRepository.js"),
      import("../../src/repositories/communityRepository.js"),
      import("../../src/repositories/companyRepository.js"),
      import("../../src/repositories/entityRepository.js"),
      import("../../src/repositories/notificationRepository.js"),
      import("../../src/repositories/requestImageRepository.js"),
      import("../../src/repositories/requestMessageRepository.js"),
      import("../../src/repositories/requestRepository.js"),
      import("../../src/repositories/reviewRepository.js"),
      import("../../src/repositories/serviceRepository.js"),
      import("../../src/repositories/vehicleRepository.js"),
    ]);

    const schemaCheck = await sql.query("SELECT to_regclass('public.users') AS users_table");
    if (!schemaCheck[0]?.users_table) {
      throw new Error("Test database schema is missing. Apply src/config/db_init.sql first.");
    }

    const user = await authRepository.insertRegisteredUser({
      user_name: `user_${suffix}`,
      password_hash: "hashed-password",
      full_name: "Integration Test User",
      user_phone: `090${Date.now().toString().slice(-9)}`,
      user_email: `user_${suffix}@example.test`,
      avatar_url: null,
    });
    ids.userId = user.user_id;

    const company = await authRepository.insertRegisteredCompany({
      company_name: `Company ${suffix}`,
      password_hash: "hashed-password",
      relative_address: "Integration address",
      geogText: "SRID=4326;POINT(105 21)",
      company_phone: `091${Date.now().toString().slice(-9)}`,
      avatar_url: null,
      rescue_area: "Integration area",
      company_license: `license_${suffix}`,
      verification_document_urls: [`https://example.test/${suffix}.pdf`],
    });
    ids.companyId = company.company_id;

    const serviceRows = await sql.query(
      `
        INSERT INTO services (service_name, service_description)
        VALUES ($1, $2)
        RETURNING service_id
      `,
      [`Service ${suffix}`, "Integration service"]
    );
    ids.serviceId = serviceRows[0].service_id;

    await sql.query(
      `
        INSERT INTO company_services (company_id, service_id, service_price)
        VALUES ($1, $2, $3)
      `,
      [ids.companyId, ids.serviceId, 123456.78]
    );

    const vehicle = await vehicleRepository.insertVehicle({
      company_id: ids.companyId,
      vehicle_license: `VH-${suffix.slice(-12)}`,
      vehicle_type: "Tow truck",
      vehicle_status: "available",
      equipment_description: "Integration equipment",
      geogText: "SRID=4326;POINT(105.1 21.1)",
    });
    ids.vehicleId = vehicle.vehicle_id;
  });

  afterAll(async () => {
    if (!sql) return;

    await sql.query(
      `
        DELETE FROM content_reports
        WHERE reason LIKE $1
      `,
      [marker]
    );
    await sql.query(
      `
        DELETE FROM notifications
        WHERE title LIKE $1 OR message LIKE $1
      `,
      [marker]
    );
    await sql.query(
      `
        DELETE FROM request_services
        WHERE request_id IN (
          SELECT request_id FROM requests WHERE request_description LIKE $1
        )
      `,
      [marker]
    );
    await sql.query(
      `
        DELETE FROM request_status_history
        WHERE request_id IN (
          SELECT request_id FROM requests WHERE request_description LIKE $1
        )
      `,
      [marker]
    );
    await sql.query(
      `
        DELETE FROM messages
        WHERE request_id IN (
          SELECT request_id FROM requests WHERE request_description LIKE $1
        )
      `,
      [marker]
    );
    await sql.query("DELETE FROM requests WHERE request_description LIKE $1", [marker]);
    await sql.query("DELETE FROM posts WHERE post_title LIKE $1 OR post_content LIKE $1", [marker]);
    await sql.query("DELETE FROM tags WHERE tag_name LIKE $1", [marker]);
    await sql.query("DELETE FROM rescue_vehicles WHERE vehicle_id = $1", [ids.vehicleId]);
    await sql.query("DELETE FROM company_services WHERE service_id = $1", [ids.serviceId]);
    await sql.query("DELETE FROM services WHERE service_id = $1", [ids.serviceId]);
    await sql.query("DELETE FROM companies WHERE company_id = $1", [ids.companyId]);
    await sql.query("DELETE FROM users WHERE user_id = $1", [ids.userId]);
  });

  it("persists auth registrations and finds entities", async () => {
    const existingUser = await authRepository.findExistingUserRegistration({
      user_name: `user_${suffix}`,
      user_phone: "unused",
      user_email: null,
    });
    const authRow = await authRepository.findUserAuthByIdentifier(`user_${suffix}`);
    const existingCompany = await authRepository.findExistingCompanyRegistration({
      company_name: `Company ${suffix}`,
      company_phone: "unused",
    });

    expect(existingUser?.user_id).toBe(ids.userId);
    expect(authRow).toMatchObject({
      user_id: ids.userId,
      user_name: `user_${suffix}`,
      is_active: true,
    });
    expect(authRow.password_hash).toBe("hashed-password");
    expect(existingCompany?.company_id).toBe(ids.companyId);
    await expect(entityRepository.userExists(ids.userId)).resolves.toBe(true);
    await expect(entityRepository.companyExists(ids.companyId)).resolves.toBe(true);
  });

  it("integrates service, company-service, and vehicle repositories", async () => {
    const services = await serviceRepository.findAllServices();
    const price = await requestRepository.findCompanyServicePrice(ids.companyId, ids.serviceId);
    const companyVehicles = await vehicleRepository.findVehiclesByCompany(ids.companyId);
    const updatedVehicle = await vehicleRepository.updateVehicleById(ids.vehicleId, {
      vehicle_license: null,
      vehicle_type: null,
      vehicle_status: "maintenance",
      equipment_description: "Updated integration equipment",
      geogText: "SRID=4326;POINT(105.2 21.2)",
    });

    expect(services.some((service) => service.service_id === ids.serviceId)).toBe(true);
    expect(Number(price)).toBeCloseTo(123456.78);
    expect(companyVehicles.some((vehicle) => vehicle.vehicle_id === ids.vehicleId)).toBe(true);
    expect(updatedVehicle).toMatchObject({
      vehicle_id: ids.vehicleId,
      vehicle_status: "maintenance",
      equipment_description: "Updated integration equipment",
    });
    await expect(entityRepository.vehicleExists(ids.vehicleId)).resolves.toBe(true);
    await expect(
      entityRepository.vehicleBelongsToCompany(ids.vehicleId, ids.companyId)
    ).resolves.toBe(true);
  });

  it("integrates request, message, notification, and vehicle status flow", async () => {
    const createdRequest = await requestRepository.insertRequest({
      user_id: ids.userId,
      company_id: ids.companyId,
      vehicle_id: null,
      geogText: "SRID=4326;POINT(105.3 21.3)",
      relative_location: "Integration road",
      request_description: `Request ${suffix}`,
      issue_type: "flat_tire",
      contact_name: "Integration User",
      contact_phone: "0999999999",
      contact_back_now: true,
      priority: "high",
      request_status: "pending",
      estimatedArrivalValue: "2026-06-13T10:30:00.000Z",
    });
    ids.requestId = createdRequest.request_id;

    await requestRepository.upsertRequestServiceLine({
      requestId: ids.requestId,
      serviceId: ids.serviceId,
      serviceQuantity: 2,
      servicePrice: 123456.78,
    });
    await requestRepository.insertRequestStatusHistory({
      requestId: ids.requestId,
      oldStatus: null,
      newStatus: "pending",
      changedBy: "user",
      note: `History ${suffix}`,
    });

    const found = await requestRepository.findRequestById(ids.requestId);
    const userRequests = await requestRepository.findRequests({
      user_id: ids.userId,
      company_id: null,
      request_status: "pending",
    });

    expect(found).toMatchObject({
      request_id: ids.requestId,
      user_id: ids.userId,
      company_id: ids.companyId,
      request_status: "pending",
      request_description: `Request ${suffix}`,
    });
    expect(userRequests.some((requestRow) => requestRow.request_id === ids.requestId)).toBe(true);
    await expect(entityRepository.requestExists(ids.requestId)).resolves.toBe(true);

    const message = await requestMessageRepository.insertRequestMessage(ids.requestId, {
      message_sender: "user",
      message_content: `Message ${suffix}`,
      is_seen: false,
    });
    const messages = await requestMessageRepository.findRequestMessages(ids.requestId);
    const seenMessage = await requestMessageRepository.updateMessageSeen(
      ids.requestId,
      message.message_id,
      true
    );

    expect(messages.some((row) => row.message_id === message.message_id)).toBe(true);
    expect(seenMessage.is_seen).toBe(true);

    await notificationRepository.insertNotification({
      recipientType: "user",
      recipientId: ids.userId,
      requestId: ids.requestId,
      title: `Notification ${suffix}`,
      message: `Notification message ${suffix}`,
      type: "integration_test",
    });
    const notifications = await notificationRepository.findNotifications({
      recipientType: "user",
      recipientId: ids.userId,
      limit: 10,
    });
    const notification = notifications.find((row) => row.title === `Notification ${suffix}`);
    const readNotification = await notificationRepository.markNotificationReadById(
      notification.notification_id
    );

    expect(notification).toBeTruthy();
    expect(readNotification.is_read).toBe(true);

    const acceptedRequest = await requestRepository.updateRequestById(ids.requestId, {
      vehicle_id: ids.vehicleId,
      request_status: "accepted",
      acceptedAt: "2026-06-13T10:05:00.000Z",
    });
    await requestRepository.syncRequestVehicleStatus(found, acceptedRequest);
    const busyVehicles = await vehicleRepository.findVehiclesByCompany(ids.companyId);
    const busyVehicle = busyVehicles.find((vehicle) => vehicle.vehicle_id === ids.vehicleId);

    expect(acceptedRequest).toMatchObject({
      request_id: ids.requestId,
      vehicle_id: ids.vehicleId,
      request_status: "accepted",
    });
    expect(busyVehicle.vehicle_status).toBe("busy");

    const deleted = await requestRepository.deleteRequestById(ids.requestId);
    expect(deleted.request_id).toBe(ids.requestId);
    await expect(entityRepository.requestExists(ids.requestId)).resolves.toBe(false);
    ids.requestId = null;
  });

  it("integrates company aggregate queries, request images, reviews, and duplicate constraints", async () => {
    const completedRequest = await requestRepository.insertRequest({
      user_id: ids.userId,
      company_id: ids.companyId,
      vehicle_id: null,
      geogText: "SRID=4326;POINT(105.31 21.31)",
      relative_location: "Review integration road",
      request_description: `Reviewed Request ${suffix}`,
      issue_type: "battery",
      request_status: "completed",
      completed_at: "2026-06-13T12:00:00.000Z",
    });

    const image = await requestImageRepository.insertRequestImage(
      completedRequest.request_id,
      `https://example.test/request-${suffix}.jpg`
    );
    const images = await requestImageRepository.findRequestImages(completedRequest.request_id);

    const review = await reviewRepository.insertReview(completedRequest.request_id, {
      review_rating: 5,
      review_comment: `Excellent ${suffix}`,
    });
    const companyReviews = await reviewRepository.findCompanyReviews(ids.companyId);
    const ratingSummary = await reviewRepository.getCompanyRatingSummary(ids.companyId);
    const company = await companyRepository.findCompanyById(ids.companyId);
    const nearbyCompanies = await companyRepository.findNearbyCompanies({
      longitude: 105,
      latitude: 21,
      radiusMeters: 50000,
    });
    const ratingRows = await companyRepository.findCompanyRatingsByIds([ids.companyId]);

    expect(images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image_id: image.image_id,
          image_url: `https://example.test/request-${suffix}.jpg`,
        }),
      ])
    );
    expect(companyReviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          review_id: review.review_id,
          request_id: completedRequest.request_id,
          review_rating: 5,
        }),
      ])
    );
    expect(Number(ratingSummary.average_rating)).toBeGreaterThanOrEqual(5);
    expect(company).toMatchObject({
      company_id: ids.companyId,
      company_name: `Company ${suffix}`,
    });
    expect(
      company.services.some((service) => Number(service.service_id) === Number(ids.serviceId))
    ).toBe(true);
    expect(nearbyCompanies.some((row) => row.company_id === ids.companyId)).toBe(true);
    expect(ratingRows.some((row) => row.company_id === Number(ids.companyId))).toBe(true);

    await expect(
      authRepository.insertRegisteredUser({
        user_name: `user_${suffix}`,
        password_hash: "another-hash",
        user_phone: `098${Date.now().toString().slice(-9)}`,
      })
    ).rejects.toMatchObject({ code: "23505" });

    const deletedImage = await requestImageRepository.deleteRequestImageById(
      completedRequest.request_id,
      image.image_id
    );
    expect(deletedImage.image_id).toBe(image.image_id);
  });

  it("integrates community posts, comments, likes, reports, and moderation", async () => {
    const postId = await communityRepository.insertPost({
      userId: ids.userId,
      title: `Community Post ${suffix}`,
      content: `Community Content ${suffix}`,
      category: "Integration",
    });
    await communityRepository.insertPostImage(
      postId,
      `https://example.test/post-${suffix}.jpg`
    );
    const tagId = await communityRepository.upsertTag(`tag_${suffix}`);
    await communityRepository.linkPostTag(postId, tagId);

    const likedPost = await communityRepository.togglePostLikeByUser(postId, ids.userId);
    const postLikes = await communityRepository.countPostLikes(postId);
    const commentId = await communityRepository.insertComment({
      postId,
      userId: ids.userId,
      content: `Comment ${suffix}`,
    });
    const likedComment = await communityRepository.toggleCommentLikeByUser(commentId, ids.userId);
    const commentLikes = await communityRepository.countCommentLikes(commentId);

    const posts = await communityRepository.findPosts({
      category: "Integration",
      q: suffix,
      userId: ids.userId,
    });
    const post = await communityRepository.findPublishedPostById(postId, ids.userId);
    const comments = await communityRepository.findPublishedCommentsByPostId(postId, ids.userId);
    const commentPayload = await communityRepository.findCommentByIdForPayload(commentId);

    const report = await communityRepository.insertContentReport({
      reporterUserId: ids.userId,
      targetType: "post",
      targetId: postId,
      reason: `Report ${suffix}`,
    });
    const reports = await communityRepository.findContentReports({ status: "pending" });
    const reviewedReport = await communityRepository.updateContentReportStatus(
      report.report_id,
      "reviewed"
    );
    const hiddenPost = await communityRepository.updatePostStatusById(postId, "hidden");
    const hiddenComment = await communityRepository.updateCommentStatusById(commentId, "hidden");

    expect(likedPost).toBe(true);
    expect(postLikes).toBe(1);
    expect(likedComment).toBe(true);
    expect(commentLikes).toBe(1);
    expect(posts.some((row) => row.post_id === postId)).toBe(true);
    expect(post).toMatchObject({
      post_id: postId,
      post_title: `Community Post ${suffix}`,
      liked_by_user: true,
    });
    expect(post.images).toEqual([`https://example.test/post-${suffix}.jpg`]);
    expect(post.tags).toEqual([`tag_${suffix}`]);
    expect(comments.some((row) => row.comment_id === commentId)).toBe(true);
    expect(commentPayload).toMatchObject({
      comment_id: commentId,
      comment_content: `Comment ${suffix}`,
    });
    expect(reports.some((row) => row.report_id === report.report_id)).toBe(true);
    expect(reviewedReport.status).toBe("reviewed");
    expect(hiddenPost.post_status).toBe("hidden");
    expect(hiddenComment.comment_status).toBe("hidden");
  });
});
