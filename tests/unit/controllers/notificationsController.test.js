import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const notificationRepository = vi.hoisted(() => ({
  findNotifications: vi.fn(),
  markNotificationReadById: vi.fn(),
}));

vi.mock("../../../src/repositories/notificationRepository.js", () => notificationRepository);

const {
  getNotifications,
  markNotificationRead,
} = await import("../../../src/controllers/notificationsController.js");

describe("notificationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires recipient query params and caps limit", async () => {
    const missingRes = createMockResponse();
    await getNotifications({ query: {} }, missingRes);

    const rows = [{ notification_id: 1 }];
    notificationRepository.findNotifications.mockResolvedValue(rows);
    const okRes = createMockResponse();
    await getNotifications(
      { query: { recipient_type: "user", recipient_id: "5", limit: "9999" } },
      okRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(notificationRepository.findNotifications).toHaveBeenCalledWith({
      recipientType: "user",
      recipientId: "5",
      limit: 1000,
    });
    expect(okRes.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("returns empty data for DB timeout errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    notificationRepository.findNotifications.mockRejectedValue(new Error("fetch failed"));
    const res = createMockResponse();

    await getNotifications({ query: { recipient_type: "user", recipient_id: "5" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it("marks notifications as read or returns 404", async () => {
    const updated = { notification_id: 1, is_read: true };
    notificationRepository.markNotificationReadById.mockResolvedValueOnce(updated);
    const okRes = createMockResponse();
    await markNotificationRead({ params: { id: "1" } }, okRes);

    notificationRepository.markNotificationReadById.mockResolvedValueOnce(null);
    const missingRes = createMockResponse();
    await markNotificationRead({ params: { id: "2" } }, missingRes);

    expect(okRes.status).toHaveBeenCalledWith(200);
    expect(okRes.json).toHaveBeenCalledWith({ success: true, data: updated });
    expect(missingRes.status).toHaveBeenCalledWith(404);
  });
});
