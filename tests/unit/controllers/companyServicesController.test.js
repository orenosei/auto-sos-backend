import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const entityRepository = vi.hoisted(() => ({
  companyExists: vi.fn(),
  serviceExists: vi.fn(),
}));

const companyServiceRepository = vi.hoisted(() => ({
  deleteCompanyServiceById: vi.fn(),
  findCompanyServices: vi.fn(),
  updateCompanyServicePrice: vi.fn(),
  upsertCompanyService: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/companyServiceRepository.js", () => companyServiceRepository);

const {
  addCompanyService,
  deleteCompanyService,
  getCompanyServices,
  updateCompanyService,
} = await import("../../../src/controllers/companyServicesController.js");

describe("companyServicesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.companyExists.mockResolvedValue(true);
    entityRepository.serviceExists.mockResolvedValue(true);
  });

  it("returns company services for an existing company", async () => {
    const rows = [{ service_id: 1 }];
    companyServiceRepository.findCompanyServices.mockResolvedValue(rows);
    const res = createMockResponse();

    await getCompanyServices({ params: { id: "2" } }, res);

    expect(companyServiceRepository.findCompanyServices).toHaveBeenCalledWith("2");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("validates add company service payload", async () => {
    const missingRes = createMockResponse();
    await addCompanyService({ params: { id: "2" }, body: {} }, missingRes);

    const invalidRes = createMockResponse();
    await addCompanyService(
      { params: { id: "2" }, body: { service_id: 1, service_price: -1 } },
      invalidRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
  });

  it("adds, updates, and deletes company services", async () => {
    const row = { company_id: 2, service_id: 1, service_price: 100 };
    companyServiceRepository.upsertCompanyService.mockResolvedValue(row);
    companyServiceRepository.updateCompanyServicePrice.mockResolvedValue(row);
    companyServiceRepository.deleteCompanyServiceById.mockResolvedValue(row);

    const addRes = createMockResponse();
    await addCompanyService(
      { params: { id: "2" }, body: { service_id: 1, service_price: 100 } },
      addRes
    );

    const updateRes = createMockResponse();
    await updateCompanyService(
      { params: { id: "2", service_id: "1" }, body: { service_price: 120 } },
      updateRes
    );

    const deleteRes = createMockResponse();
    await deleteCompanyService({ params: { id: "2", service_id: "1" } }, deleteRes);

    expect(addRes.status).toHaveBeenCalledWith(201);
    expect(updateRes.status).toHaveBeenCalledWith(200);
    expect(deleteRes.status).toHaveBeenCalledWith(200);
  });

  it("returns not found when related rows are missing", async () => {
    entityRepository.companyExists.mockResolvedValue(false);
    const res = createMockResponse();

    await getCompanyServices({ params: { id: "404" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Company not found" });
  });
});
