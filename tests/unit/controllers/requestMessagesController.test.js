import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const entityRepository = vi.hoisted(() => ({
  requestExists: vi.fn(),
}));

const requestMessageRepository = vi.hoisted(() => ({
  findRequestMessages: vi.fn(),
  insertRequestMessage: vi.fn(),
  updateMessageSeen: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/requestMessageRepository.js", () => requestMessageRepository);

const {
  addRequestMessage,
  getRequestMessages,
  markMessageSeen,
} = await import("../../../src/controllers/requestMessagesController.js");

describe("requestMessagesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.requestExists.mockResolvedValue(true);
  });

  it("lists request messages", async () => {
    const rows = [{ message_id: 1 }];
    requestMessageRepository.findRequestMessages.mockResolvedValue(rows);
    const res = createMockResponse();

    await getRequestMessages({ params: { id: "10" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("validates message payload", async () => {
    const missingRes = createMockResponse();
    await addRequestMessage({ params: { id: "10" }, body: { message_sender: "user" } }, missingRes);

    const senderRes = createMockResponse();
    await addRequestMessage(
      { params: { id: "10" }, body: { message_sender: "admin", message_content: "Hi" } },
      senderRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(senderRes.status).toHaveBeenCalledWith(400);
  });

  it("creates a message and marks messages seen", async () => {
    const created = { message_id: 1 };
    const updated = { message_id: 1, is_seen: false };
    requestMessageRepository.insertRequestMessage.mockResolvedValue(created);
    requestMessageRepository.updateMessageSeen.mockResolvedValue(updated);

    const addRes = createMockResponse();
    await addRequestMessage(
      {
        params: { id: "10" },
        body: { message_sender: "company", message_content: "Coming", is_seen: true },
      },
      addRes
    );

    const seenRes = createMockResponse();
    await markMessageSeen(
      { params: { id: "10", message_id: "1" }, body: { is_seen: false } },
      seenRes
    );

    expect(requestMessageRepository.insertRequestMessage).toHaveBeenCalledWith("10", {
      message_sender: "company",
      message_content: "Coming",
      is_seen: true,
    });
    expect(requestMessageRepository.updateMessageSeen).toHaveBeenCalledWith("10", "1", false);
    expect(addRes.status).toHaveBeenCalledWith(201);
    expect(seenRes.status).toHaveBeenCalledWith(200);
  });

  it("defaults mark seen value to true and returns 404 for missing messages", async () => {
    requestMessageRepository.updateMessageSeen.mockResolvedValue(null);
    const res = createMockResponse();

    await markMessageSeen({ params: { id: "10", message_id: "1" }, body: {} }, res);

    expect(requestMessageRepository.updateMessageSeen).toHaveBeenCalledWith("10", "1", true);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
