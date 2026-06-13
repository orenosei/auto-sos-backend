import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const serviceRepository = vi.hoisted(() => ({
  findAllServices: vi.fn(),
}));

vi.mock("../../../src/repositories/serviceRepository.js", () => serviceRepository);

const { getAllServices } = await import("../../../src/controllers/servicesController.js");

describe("servicesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all services", async () => {
    const rows = [{ service_id: 1, service_name: "Towing" }];
    serviceRepository.findAllServices.mockResolvedValue(rows);
    const res = createMockResponse();

    await getAllServices({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("returns 500 when repository fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    serviceRepository.findAllServices.mockRejectedValue(new Error("db down"));
    const res = createMockResponse();

    await getAllServices({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});
