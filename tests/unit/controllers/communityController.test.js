import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

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
  postExists: vi.fn(),
  userExists: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createAdminNotifications: vi.fn(),
}));

const sensitiveWordService = vi.hoisted(() => ({
  findSensitiveWords: vi.fn(),
}));

vi.mock("../../../src/repositories/communityRepository.js", () => communityRepository);
vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/services/notificationService.js", () => notificationService);
vi.mock("../../../src/services/sensitiveWordService.js", () => sensitiveWordService);

const {
  createComment,
  createPost,
  createReport,
  getPostById,
  getPosts,
  getReports,
  toggleCommentLike,
  togglePostLike,
  updateCommentStatus,
  updatePostStatus,
  updateReportStatus,
} = await import("../../../src/controllers/communityController.js");

const postRow = {
  post_id: 1,
  user_id: 5,
  full_name: "John",
  user_name: "john",
  avatar_url: null,
  post_title: "Title",
  post_content: "Content",
  post_status: "published",
  category: "Help",
  created_at: "2026-01-01",
  images: JSON.stringify(["https://img"]),
  tags: JSON.stringify(["tag"]),
  likes_count: "2",
  comments_count: "3",
  liked_by_user: true,
};

const commentRow = {
  comment_id: 7,
  post_id: 1,
  user_id: 5,
  full_name: "John",
  user_name: "john",
  avatar_url: null,
  comment_content: "Nice",
  comment_status: "published",
  created_at: "2026-01-01",
  likes_count: "1",
  liked_by_user: false,
};

describe("communityController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.userExists.mockResolvedValue(true);
    entityRepository.postExists.mockResolvedValue(true);
    entityRepository.commentExists.mockResolvedValue(true);
    sensitiveWordService.findSensitiveWords.mockResolvedValue([]);
  });

  it("maps posts and post detail payloads", async () => {
    communityRepository.findPosts.mockResolvedValue([postRow]);
    communityRepository.findPublishedPostById.mockResolvedValue(postRow);
    communityRepository.findPublishedCommentsByPostId.mockResolvedValue([commentRow]);

    const listRes = createMockResponse();
    await getPosts({ query: { user_id: "5" } }, listRes);

    const detailRes = createMockResponse();
    await getPostById({ params: { id: "1" }, query: { user_id: "5" } }, detailRes);

    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(listRes.json).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          id: "1",
          userName: "John",
          likes: 2,
          comments: 3,
          liked: true,
        }),
      ],
    });
    expect(detailRes.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        id: "1",
        commentItems: [
          expect.objectContaining({
            id: "7",
            content: "Nice",
            likes: 1,
          }),
        ],
      }),
    });
  });

  it("returns 404 for missing post detail", async () => {
    communityRepository.findPublishedPostById.mockResolvedValue(null);
    const res = createMockResponse();

    await getPostById({ params: { id: "404" }, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Post not found" });
  });

  it("validates create post and blocks sensitive words", async () => {
    const missingRes = createMockResponse();
    await createPost({ body: { user_id: 5 } }, missingRes);

    sensitiveWordService.findSensitiveWords.mockResolvedValue(["bad"]);
    const blockedRes = createMockResponse();
    await createPost(
      { body: { user_id: 5, title: "Bad", content: "Content" } },
      blockedRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(blockedRes.status).toHaveBeenCalledWith(400);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: "Nội dung chứa từ nhạy cảm. Vui lòng chỉnh sửa trước khi đăng.",
      data: { blockedWords: ["bad"] },
    });
  });

  it("creates posts with images and tags then returns detail", async () => {
    communityRepository.insertPost.mockResolvedValue(1);
    communityRepository.upsertTag.mockResolvedValue(11);
    communityRepository.findPublishedPostById.mockResolvedValue(postRow);
    communityRepository.findPublishedCommentsByPostId.mockResolvedValue([]);
    const res = createMockResponse();

    await createPost(
      {
        body: {
          user_id: 5,
          title: " Title ",
          content: " Content ",
          category: " Help ",
          images: ["https://img"],
          tags: ["SOS", "Tips"],
        },
      },
      res
    );

    expect(communityRepository.insertPost).toHaveBeenCalledWith({
      userId: 5,
      title: "Title",
      content: "Content",
      category: "Help",
    });
    expect(communityRepository.insertPostImage).toHaveBeenCalledWith(1, "https://img");
    expect(communityRepository.upsertTag).toHaveBeenCalledWith("sos");
    expect(communityRepository.linkPostTag).toHaveBeenCalledWith(1, 11);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("creates comments after validating user, post, and sensitive words", async () => {
    communityRepository.insertComment.mockResolvedValue(7);
    communityRepository.findCommentByIdForPayload.mockResolvedValue(commentRow);
    const res = createMockResponse();

    await createComment(
      { params: { id: "1" }, body: { user_id: 5, content: " Nice " } },
      res
    );

    expect(communityRepository.insertComment).toHaveBeenCalledWith({
      postId: "1",
      userId: 5,
      content: "Nice",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ id: "7", content: "Nice" }),
    });
  });

  it("toggles post and comment likes", async () => {
    communityRepository.togglePostLikeByUser.mockResolvedValue(true);
    communityRepository.countPostLikes.mockResolvedValue(4);
    communityRepository.toggleCommentLikeByUser.mockResolvedValue(false);
    communityRepository.countCommentLikes.mockResolvedValue(1);

    const postRes = createMockResponse();
    await togglePostLike({ params: { id: "1" }, body: { user_id: 5 } }, postRes);

    const commentRes = createMockResponse();
    await toggleCommentLike(
      { params: { commentId: "7" }, body: { user_id: 5 } },
      commentRes
    );

    expect(postRes.json).toHaveBeenCalledWith({ success: true, data: { liked: true, likes: 4 } });
    expect(commentRes.json).toHaveBeenCalledWith({
      success: true,
      data: { liked: false, likes: 1 },
    });
  });

  it("creates content reports and notifies admins", async () => {
    const created = { report_id: 1 };
    communityRepository.insertContentReport.mockResolvedValue(created);
    const res = createMockResponse();

    await createReport(
      {
        body: {
          reporter_user_id: 5,
          target_type: "post",
          target_id: 1,
          reason: "Spam",
        },
      },
      res
    );

    expect(communityRepository.insertContentReport).toHaveBeenCalledWith({
      reporterUserId: 5,
      targetType: "post",
      targetId: 1,
      reason: "Spam",
    });
    expect(notificationService.createAdminNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ type: "content_report" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("validates report and moderation statuses", async () => {
    const reportRes = createMockResponse();
    await createReport(
      { body: { reporter_user_id: 5, target_type: "vehicle", target_id: 1, reason: "Spam" } },
      reportRes
    );

    const reportStatusRes = createMockResponse();
    await updateReportStatus({ params: { id: "1" }, body: { status: "bad" } }, reportStatusRes);

    const postStatusRes = createMockResponse();
    await updatePostStatus({ params: { id: "1" }, body: { status: "bad" } }, postStatusRes);

    const commentStatusRes = createMockResponse();
    await updateCommentStatus(
      { params: { commentId: "1" }, body: { status: "bad" } },
      commentStatusRes
    );

    expect(reportRes.status).toHaveBeenCalledWith(400);
    expect(reportStatusRes.status).toHaveBeenCalledWith(400);
    expect(postStatusRes.status).toHaveBeenCalledWith(400);
    expect(commentStatusRes.status).toHaveBeenCalledWith(400);
  });

  it("lists reports and updates moderation statuses", async () => {
    communityRepository.findContentReports.mockResolvedValue([{ report_id: 1 }]);
    communityRepository.updateContentReportStatus.mockResolvedValue({ report_id: 1 });
    communityRepository.updatePostStatusById.mockResolvedValue({ post_id: 1 });
    communityRepository.updateCommentStatusById.mockResolvedValue({ comment_id: 7 });

    const reportsRes = createMockResponse();
    await getReports({ query: { status: "pending" } }, reportsRes);

    const reportStatusRes = createMockResponse();
    await updateReportStatus(
      { params: { id: "1" }, body: { status: "reviewed" } },
      reportStatusRes
    );

    const postStatusRes = createMockResponse();
    await updatePostStatus({ params: { id: "1" }, body: { status: "hidden" } }, postStatusRes);

    const commentStatusRes = createMockResponse();
    await updateCommentStatus(
      { params: { commentId: "7" }, body: { status: "removed" } },
      commentStatusRes
    );

    expect(reportsRes.status).toHaveBeenCalledWith(200);
    expect(reportStatusRes.status).toHaveBeenCalledWith(200);
    expect(postStatusRes.status).toHaveBeenCalledWith(200);
    expect(commentStatusRes.status).toHaveBeenCalledWith(200);
  });
});
