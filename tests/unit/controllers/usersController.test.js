import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const userRepository = vi.hoisted(() => ({
  deleteUserById: vi.fn(),
  findAllUsers: vi.fn(),
  findUserById: vi.fn(),
  insertUser: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("../../../src/repositories/userRepository.js", () => userRepository);

const {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUser,
} = await import("../../../src/controllers/usersController.js");

describe("usersController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all users", async () => {
    const rows = [{ user_id: 1 }];
    userRepository.findAllUsers.mockResolvedValue(rows);
    const res = createMockResponse();

    await getAllUsers({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("returns 404 when a user is not found", async () => {
    userRepository.findUserById.mockResolvedValue(null);
    const res = createMockResponse();

    await getUserById({ params: { id: "999" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
  });

  it("validates required fields when creating users", async () => {
    const res = createMockResponse();

    await createUser({ body: { user_name: "john" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(userRepository.insertUser).not.toHaveBeenCalled();
  });

  it("creates, updates, and deletes users through the repository", async () => {
    const created = { user_id: 1, user_name: "john" };
    const updated = { user_id: 1, full_name: "John" };
    const deleted = { user_id: 1 };
    userRepository.insertUser.mockResolvedValue(created);
    userRepository.updateUserById.mockResolvedValue(updated);
    userRepository.deleteUserById.mockResolvedValue(deleted);

    const createRes = createMockResponse();
    await createUser(
      { body: { user_name: "john", password_hash: "hash", user_phone: "090" } },
      createRes
    );

    const updateRes = createMockResponse();
    await updateUser({ params: { id: "1" }, body: { full_name: "John" } }, updateRes);

    const deleteRes = createMockResponse();
    await deleteUser({ params: { id: "1" } }, deleteRes);

    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(updateRes.status).toHaveBeenCalledWith(200);
    expect(deleteRes.status).toHaveBeenCalledWith(200);
  });
});
