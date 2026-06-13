import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const entityRepository = vi.hoisted(() => ({
  requestExists: vi.fn(),
  serviceExists: vi.fn(),
}));

const requestServiceRepository = vi.hoisted(() => ({
  deleteRequestServiceById: vi.fn(),
  findRequestServices: vi.fn(),
  updateRequestServiceById: vi.fn(),
  upsertRequestService: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/requestServiceRepository.js", () => requestServiceRepository);

const {
  addRequestService,
  deleteRequestService,
  getRequestServices,
  updateRequestService,
} = await import("../../../src/controllers/requestServicesController.js");

describe("requestServicesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.requestExists.mockResolvedValue(true);
    entityRepository.serviceExists.mockResolvedValue(true);
  });

  it("lists services for an existing request", async () => {
    const rows = [{ service_id: 1 }];
    requestServiceRepository.findRequestServices.mockResolvedValue(rows);
    const res = createMockResponse();

    await getRequestServices({ params: { id: "10" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("validates add request service payload", async () => {
    const missingRes = createMockResponse();
    await addRequestService({ params: { id: "10" }, body: {} }, missingRes);

    const quantityRes = createMockResponse();
    await addRequestService(
      {
        params: { id: "10" },
        body: { service_id: 1, service_quantity: 0, service_price: 10 },
      },
      quantityRes
    );

    const priceRes = createMockResponse();
    await addRequestService(
      {
        params: { id: "10" },
        body: { service_id: 1, service_quantity: 1, service_price: -1 },
      },
      priceRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(quantityRes.status).toHaveBeenCalledWith(400);
    expect(priceRes.status).toHaveBeenCalledWith(400);
  });

  it("adds, updates, and deletes request services", async () => {
    const row = { request_id: 10, service_id: 1 };
    requestServiceRepository.upsertRequestService.mockResolvedValue(row);
    requestServiceRepository.updateRequestServiceById.mockResolvedValue(row);
    requestServiceRepository.deleteRequestServiceById.mockResolvedValue(row);

    const addRes = createMockResponse();
    await addRequestService(
      {
        params: { id: "10" },
        body: { service_id: 1, service_quantity: 2, service_price: 100 },
      },
      addRes
    );

    const updateRes = createMockResponse();
    await updateRequestService(
      { params: { id: "10", service_id: "1" }, body: { service_quantity: 3 } },
      updateRes
    );

    const deleteRes = createMockResponse();
    await deleteRequestService({ params: { id: "10", service_id: "1" } }, deleteRes);

    expect(addRes.status).toHaveBeenCalledWith(201);
    expect(updateRes.status).toHaveBeenCalledWith(200);
    expect(deleteRes.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when request service cannot be updated", async () => {
    requestServiceRepository.updateRequestServiceById.mockResolvedValue(null);
    const res = createMockResponse();

    await updateRequestService(
      { params: { id: "10", service_id: "1" }, body: { service_price: 100 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Request service not found" });
  });
});
