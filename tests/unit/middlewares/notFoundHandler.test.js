import { describe, expect, it, vi } from "vitest";

import { notFoundHandler } from "../../../src/middlewares/notFoundHandler.js";

const createRes = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe("notFoundHandler", () => {
  it("returns a 404 response with the original URL", () => {
    const req = { originalUrl: "/api/missing" };
    const res = createRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Route not found",
      path: "/api/missing",
    });
  });
});
