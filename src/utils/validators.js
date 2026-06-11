export const isPositiveInteger = (value) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const isNonNegativeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
