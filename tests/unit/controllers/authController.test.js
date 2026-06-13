import { beforeEach, describe, expect, it, vi } from "vitest";

const authRepository = vi.hoisted(() => ({
  findCompanyAuthByIdentifier: vi.fn(),
  findExistingCompanyRegistration: vi.fn(),
  findExistingUserRegistration: vi.fn(),
  findUserAuthByIdentifier: vi.fn(),
  insertRegisteredCompany: vi.fn(),
  insertRegisteredUser: vi.fn(),
}));

const bcrypt = vi.hoisted(() => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => bcrypt);
vi.mock("../../../src/repositories/authRepository.js", () => authRepository);

const {
  loginCompany,
  loginUser,
  registerCompany,
  registerUser,
} = await import("../../../src/controllers/authController.js");

const createRes = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe("authController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bcrypt.default.hash.mockResolvedValue("hashed-password");
    bcrypt.default.compare.mockResolvedValue(true);
  });

  describe("registerUser", () => {
    it("rejects missing required fields", async () => {
      const res = createRes();

      await registerUser({ body: { user_name: "john" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Missing required fields: user_name, password, user_phone",
      });
    });

    it("returns 409 when a user already exists", async () => {
      authRepository.findExistingUserRegistration.mockResolvedValue({ user_id: 1 });
      const res = createRes();

      await registerUser(
        { body: { user_name: "john", password: "secret", user_phone: "090" } },
        res
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "User already exists" });
      expect(authRepository.insertRegisteredUser).not.toHaveBeenCalled();
    });

    it("hashes the password and inserts a new user", async () => {
      const created = { user_id: 1, user_name: "john" };
      authRepository.findExistingUserRegistration.mockResolvedValue(null);
      authRepository.insertRegisteredUser.mockResolvedValue(created);
      const res = createRes();

      await registerUser(
        {
          body: {
            user_name: "john",
            password: "secret",
            full_name: "John",
            user_phone: "090",
            user_email: "john@example.com",
          },
        },
        res
      );

      expect(bcrypt.default.hash).toHaveBeenCalledWith("secret", 10);
      expect(authRepository.insertRegisteredUser).toHaveBeenCalledWith(
        expect.objectContaining({ user_name: "john", password_hash: "hashed-password" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, role: "user", data: created });
    });
  });

  describe("loginUser", () => {
    it("rejects missing credentials", async () => {
      const res = createRes();

      await loginUser({ body: { identifier: "john" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Missing required fields: identifier, password",
      });
    });

    it("returns 401 when the identifier is unknown", async () => {
      authRepository.findUserAuthByIdentifier.mockResolvedValue(null);
      const res = createRes();

      await loginUser({ body: { identifier: "john", password: "secret" } }, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
    });

    it("returns 403 for inactive users", async () => {
      authRepository.findUserAuthByIdentifier.mockResolvedValue({
        user_id: 1,
        password_hash: "hash",
        is_active: false,
      });
      const res = createRes();

      await loginUser({ body: { identifier: "john", password: "secret" } }, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Account is inactive" });
      expect(bcrypt.default.compare).not.toHaveBeenCalled();
    });

    it("returns user data without password_hash on successful login", async () => {
      authRepository.findUserAuthByIdentifier.mockResolvedValue({
        user_id: 1,
        user_name: "john",
        full_name: "John",
        user_phone: "090",
        user_email: "john@example.com",
        avatar_url: null,
        user_role: "user",
        is_active: true,
        registered_at: "2026-01-01",
        password_hash: "hash",
      });
      const res = createRes();

      await loginUser({ body: { identifier: "john", password: "secret" } }, res);

      expect(bcrypt.default.compare).toHaveBeenCalledWith("secret", "hash");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        role: "user",
        data: expect.not.objectContaining({ password_hash: expect.anything() }),
      });
    });
  });

  describe("registerCompany", () => {
    it("rejects missing required company fields or invalid coordinates", async () => {
      const res = createRes();

      await registerCompany(
        {
          body: {
            company_name: "Rescue",
            password: "secret",
            company_phone: "091",
            absolute_address: { lat: "bad", lng: 105 },
          },
        },
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("creates a company with normalized geography text", async () => {
      const created = { company_id: 5, company_name: "Rescue" };
      authRepository.findExistingCompanyRegistration.mockResolvedValue(null);
      authRepository.insertRegisteredCompany.mockResolvedValue(created);
      const res = createRes();

      await registerCompany(
        {
          body: {
            company_name: "Rescue",
            password: "secret",
            company_phone: "091",
            absolute_address: { lat: 21, lng: 105 },
          },
        },
        res
      );

      expect(authRepository.insertRegisteredCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: "Rescue",
          password_hash: "hashed-password",
          geogText: "SRID=4326;POINT(105 21)",
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, role: "company", data: created });
    });
  });

  describe("loginCompany", () => {
    it("returns 401 for a wrong company password", async () => {
      authRepository.findCompanyAuthByIdentifier.mockResolvedValue({
        company_id: 1,
        password_hash: "hash",
      });
      bcrypt.default.compare.mockResolvedValue(false);
      const res = createRes();

      await loginCompany({ body: { identifier: "rescue", password: "bad" } }, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
    });
  });
});
