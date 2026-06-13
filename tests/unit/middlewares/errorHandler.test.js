import { afterEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../src/middlewares/errorHandler.js";

const createRes = (overrides = {}) => {
  const res = {
    headersSent: false,
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    ...overrides,
  };
  return res;
};

describe("errorHandler", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns the original message for non-500 errors", () => {
    const error = Object.assign(new Error("Bad input"), { statusCode: 400 });
    const res = createRes();

    errorHandler(error, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Bad input",
      details: "Bad input",
    });
  });

  it("hides internal messages for 500 errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = createRes();

    errorHandler(new Error("database password leaked"), {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal Server Error",
      details: "database password leaked",
    });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("omits details in production", () => {
    process.env.NODE_ENV = "production";
    const error = Object.assign(new Error("Nope"), { status: 403 });
    const res = createRes();

    errorHandler(error, {}, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ error: "Nope" });
  });

  it("delegates when headers have already been sent", () => {
    const error = new Error("late");
    const next = vi.fn();
    const res = createRes({ headersSent: true });

    errorHandler(error, {}, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
