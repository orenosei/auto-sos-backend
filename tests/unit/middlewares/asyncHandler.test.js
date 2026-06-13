import { describe, expect, it, vi } from "vitest";

import { asyncHandler } from "../../../src/middlewares/asyncHandler.js";

describe("asyncHandler", () => {
  it("passes rejected handler errors to next", async () => {
    const error = new Error("boom");
    const next = vi.fn();
    const wrapped = asyncHandler(async () => {
      throw error;
    });

    wrapped({}, {}, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(error);
  });

  it("does not call next when handler resolves", async () => {
    const next = vi.fn();
    const wrapped = asyncHandler(async (req, res) => {
      res.ok = true;
    });
    const res = {};

    wrapped({}, res, next);
    await Promise.resolve();

    expect(res.ok).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});
