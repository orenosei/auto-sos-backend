import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationRepository = vi.hoisted(() => ({
  findActiveAdminUserIds: vi.fn(),
  insertNotification: vi.fn(),
}));

vi.mock("../../../src/repositories/notificationRepository.js", () => notificationRepository);

const {
  createAdminNotifications,
  createNotification,
  getRequestStatusNotification,
} = await import("../../../src/services/notificationService.js");

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips notification creation when required fields are missing", async () => {
    await createNotification({
      recipientType: "",
      recipientId: 1,
      title: "Title",
      message: "Message",
    });
    await createNotification({
      recipientType: "user",
      recipientId: null,
      title: "Title",
      message: "Message",
    });
    await createNotification({
      recipientType: "user",
      recipientId: 1,
      title: "",
      message: "Message",
    });

    expect(notificationRepository.insertNotification).not.toHaveBeenCalled();
  });

  it("inserts valid notifications", async () => {
    const payload = {
      recipientType: "company",
      recipientId: 2,
      requestId: 10,
      title: "Title",
      message: "Message",
      type: "request_created",
    };

    await createNotification(payload);

    expect(notificationRepository.insertNotification).toHaveBeenCalledWith(payload);
  });

  it("logs and swallows insert errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("db down");
    notificationRepository.insertNotification.mockRejectedValue(error);

    await expect(
      createNotification({
        recipientType: "user",
        recipientId: 1,
        title: "Title",
        message: "Message",
      })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith("Error creating notification:", error);
  });

  it("creates notifications for all active admins", async () => {
    notificationRepository.findActiveAdminUserIds.mockResolvedValue([
      { user_id: 1 },
      { user_id: 2 },
    ]);

    await createAdminNotifications({
      title: "Report",
      message: "New report",
      type: "content_report",
    });

    expect(notificationRepository.insertNotification).toHaveBeenCalledTimes(2);
    expect(notificationRepository.insertNotification).toHaveBeenNthCalledWith(1, {
      recipientType: "user",
      recipientId: 1,
      requestId: undefined,
      title: "Report",
      message: "New report",
      type: "content_report",
    });
    expect(notificationRepository.insertNotification).toHaveBeenNthCalledWith(2, {
      recipientType: "user",
      recipientId: 2,
      requestId: undefined,
      title: "Report",
      message: "New report",
      type: "content_report",
    });
  });

  it("logs and swallows admin lookup errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("admin lookup failed");
    notificationRepository.findActiveAdminUserIds.mockRejectedValue(error);

    await expect(
      createAdminNotifications({
        title: "Report",
        message: "New report",
        type: "content_report",
      })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith("Error creating admin notification:", error);
  });

  it("returns labels for supported request statuses", () => {
    expect(getRequestStatusNotification("accepted")).toEqual([
      "Yêu cầu đã được tiếp nhận",
      "Công ty cứu hộ đã tiếp nhận yêu cầu của bạn.",
    ]);
    expect(getRequestStatusNotification("heading")).toEqual([
      "Xe cứu hộ đang di chuyển",
      "Đơn vị cứu hộ đang trên đường đến vị trí của bạn.",
    ]);
    expect(getRequestStatusNotification("arrived")).toEqual([
      "Cứu hộ đã đến nơi",
      "Đơn vị cứu hộ đã đến hiện trường.",
    ]);
    expect(getRequestStatusNotification("processing")).toEqual([
      "Đang xử lý sự cố",
      "Đơn vị cứu hộ đang xử lý sự cố của bạn.",
    ]);
    expect(getRequestStatusNotification("completed")).toEqual([
      "Yêu cầu đã hoàn tất",
      "Dịch vụ cứu hộ đã được đánh dấu hoàn tất.",
    ]);
    expect(getRequestStatusNotification("cancelled")).toEqual([
      "Yêu cầu đã hủy",
      "Yêu cầu cứu hộ đã được hủy.",
    ]);
  });

  it("returns null for unsupported request statuses", () => {
    expect(getRequestStatusNotification("pending")).toBeNull();
    expect(getRequestStatusNotification("unknown")).toBeNull();
  });
});
