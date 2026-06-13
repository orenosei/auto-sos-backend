import { afterEach, describe, expect, it, vi } from "vitest";

import { requestLogger } from "../../../src/middlewares/requestLogger.js";

describe("requestLogger", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("skips logging in test environment", () => {
    process.env.NODE_ENV = "test";
    const req = { method: "GET", originalUrl: "/api/services" };
    const res = { on: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).not.toHaveBeenCalled();
  });

  it("logs method, URL, status, and duration when response finishes", () => {
    process.env.NODE_ENV = "development";
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const hrtimeSpy = vi
      .spyOn(process.hrtime, "bigint")
      .mockReturnValueOnce(1_000_000_000n)
      .mockReturnValueOnce(1_025_000_000n);
    let finishHandler;
    const req = { method: "POST", originalUrl: "/api/requests" };
    const res = {
      statusCode: 201,
      on: vi.fn((event, handler) => {
        if (event === "finish") finishHandler = handler;
      }),
    };
    const next = vi.fn();

    requestLogger(req, res, next);
    finishHandler();

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    expect(hrtimeSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith("POST /api/requests 201 25.0ms");
  });
});
