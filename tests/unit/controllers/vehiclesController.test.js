import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const entityRepository = vi.hoisted(() => ({
  companyExists: vi.fn(),
}));

const vehicleRepository = vi.hoisted(() => ({
  deleteVehicleById: vi.fn(),
  findVehiclesByCompany: vi.fn(),
  insertVehicle: vi.fn(),
  updateVehicleById: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/vehicleRepository.js", () => vehicleRepository);

const {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
} = await import("../../../src/controllers/vehiclesController.js");

describe("vehiclesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.companyExists.mockResolvedValue(true);
  });

  it("requires company_id when listing vehicles", async () => {
    const res = createMockResponse();

    await getVehicles({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(vehicleRepository.findVehiclesByCompany).not.toHaveBeenCalled();
  });

  it("returns vehicles for an existing company", async () => {
    const rows = [{ vehicle_id: 1 }];
    vehicleRepository.findVehiclesByCompany.mockResolvedValue(rows);
    const res = createMockResponse();

    await getVehicles({ query: { company_id: "2" } }, res);

    expect(vehicleRepository.findVehiclesByCompany).toHaveBeenCalledWith("2");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it("validates create fields and vehicle status", async () => {
    const missingRes = createMockResponse();
    await createVehicle({ body: { company_id: 1 } }, missingRes);

    const statusRes = createMockResponse();
    await createVehicle(
      {
        body: {
          company_id: 1,
          vehicle_license: "30A",
          vehicle_type: "Tow",
          vehicle_status: "offline",
        },
      },
      statusRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(statusRes.status).toHaveBeenCalledWith(400);
  });

  it("creates a vehicle with normalized location", async () => {
    const created = { vehicle_id: 1 };
    vehicleRepository.insertVehicle.mockResolvedValue(created);
    const res = createMockResponse();

    await createVehicle(
      {
        body: {
          company_id: 2,
          vehicle_license: "30A",
          vehicle_type: "Tow",
          current_location: { lat: 21, lng: 105 },
        },
      },
      res
    );

    expect(vehicleRepository.insertVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ geogText: "SRID=4326;POINT(105 21)" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
  });

  it("returns 409 on duplicate vehicle_license", async () => {
    vehicleRepository.insertVehicle.mockRejectedValue({ code: "23505" });
    const res = createMockResponse();

    await createVehicle(
      {
        body: {
          company_id: 2,
          vehicle_license: "30A",
          vehicle_type: "Tow",
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "vehicle_license already exists" });
  });

  it("returns 404 for missing update/delete targets", async () => {
    vehicleRepository.updateVehicleById.mockResolvedValue(null);
    vehicleRepository.deleteVehicleById.mockResolvedValue(null);

    const updateRes = createMockResponse();
    await updateVehicle({ params: { id: "1" }, body: {} }, updateRes);

    const deleteRes = createMockResponse();
    await deleteVehicle({ params: { id: "1" } }, deleteRes);

    expect(updateRes.status).toHaveBeenCalledWith(404);
    expect(deleteRes.status).toHaveBeenCalledWith(404);
  });
});
