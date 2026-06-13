import { vi } from "vitest";

export const createMockResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};
