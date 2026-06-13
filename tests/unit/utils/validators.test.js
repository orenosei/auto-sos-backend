import { describe, expect, it } from "vitest";

import { isNonNegativeNumber, isPositiveInteger } from "../../../src/utils/validators.js";

describe("validators", () => {
  it("accepts only positive integers", () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(42)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(-1)).toBe(false);
    expect(isPositiveInteger(1.5)).toBe(false);
    expect(isPositiveInteger("1")).toBe(false);
  });

  it("accepts finite non-negative numbers", () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(12.5)).toBe(true);
    expect(isNonNegativeNumber(-0.1)).toBe(false);
    expect(isNonNegativeNumber(Number.NaN)).toBe(false);
    expect(isNonNegativeNumber(Infinity)).toBe(false);
    expect(isNonNegativeNumber("12")).toBe(false);
  });
});
