import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const companyRepository = vi.hoisted(() => ({
  deleteCompanyById: vi.fn(),
  findAllCompanies: vi.fn(),
  findCompanyById: vi.fn(),
  findCompanyRatingsByIds: vi.fn(),
  findNearbyCompanies: vi.fn(),
  insertCompany: vi.fn(),
  updateCompanyById: vi.fn(),
}));

vi.mock("../../../src/repositories/companyRepository.js", () => companyRepository);

const {
  createCompany,
  deleteCompany,
  getAllCompanies,
  getCompaniesRatings,
  getCompanyById,
  getNearbyCompanies,
  updateCompany,
} = await import("../../../src/controllers/companiesController.js");

describe("companiesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all companies and 404 for missing company detail", async () => {
    companyRepository.findAllCompanies.mockResolvedValue([{ company_id: 1 }]);
    companyRepository.findCompanyById.mockResolvedValue(null);

    const listRes = createMockResponse();
    await getAllCompanies({}, listRes);

    const detailRes = createMockResponse();
    await getCompanyById({ params: { id: "404" } }, detailRes);

    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(detailRes.status).toHaveBeenCalledWith(404);
  });

  it("validates and creates companies with normalized address", async () => {
    const invalidRes = createMockResponse();
    await createCompany({ body: { company_name: "A" } }, invalidRes);

    const created = { company_id: 1 };
    companyRepository.insertCompany.mockResolvedValue(created);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const createRes = createMockResponse();
    await createCompany(
      {
        body: {
          company_name: "A",
          password_hash: "hash",
          company_phone: "090",
          absolute_address: { lat: 21, lng: 105 },
        },
      },
      createRes
    );

    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(companyRepository.insertCompany).toHaveBeenCalledWith(
      expect.objectContaining({ geogText: "SRID=4326;POINT(105 21)" })
    );
    expect(createRes.status).toHaveBeenCalledWith(201);
  });

  it("updates and deletes companies, returning 404 when rows are missing", async () => {
    companyRepository.updateCompanyById.mockResolvedValue(null);
    companyRepository.deleteCompanyById.mockResolvedValue(null);

    const updateRes = createMockResponse();
    await updateCompany({ params: { id: "1" }, body: {} }, updateRes);

    const deleteRes = createMockResponse();
    await deleteCompany({ params: { id: "1" } }, deleteRes);

    expect(updateRes.status).toHaveBeenCalledWith(404);
    expect(deleteRes.status).toHaveBeenCalledWith(404);
  });

  it("validates nearby search query and calls repository with meters", async () => {
    const missingRes = createMockResponse();
    await getNearbyCompanies({ query: {} }, missingRes);

    const invalidRadiusRes = createMockResponse();
    await getNearbyCompanies(
      { query: { latitude: "21", longitude: "105", radiusKm: "0" } },
      invalidRadiusRes
    );

    const rows = [{ company_id: 1 }];
    companyRepository.findNearbyCompanies.mockResolvedValue(rows);
    const okRes = createMockResponse();
    await getNearbyCompanies(
      { query: { latitude: "21", longitude: "105", radiusKm: "2.5" } },
      okRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(invalidRadiusRes.status).toHaveBeenCalledWith(400);
    expect(companyRepository.findNearbyCompanies).toHaveBeenCalledWith({
      longitude: 105,
      latitude: 21,
      radiusMeters: 2500,
    });
    expect(okRes.json).toHaveBeenCalledWith({
      success: true,
      data: rows,
      userLocation: { latitude: 21, longitude: 105 },
      radiusKm: 2.5,
    });
  });

  it("returns ratings map for valid company ids", async () => {
    companyRepository.findCompanyRatingsByIds.mockResolvedValue([
      { company_id: 1, average_rating: "4.5", review_count: "2" },
    ]);
    const res = createMockResponse();

    await getCompaniesRatings({ query: { ids: "1,abc" } }, res);

    expect(companyRepository.findCompanyRatingsByIds).toHaveBeenCalledWith([1]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { 1: { average_rating: 4.5, review_count: 2 } },
    });
  });
});
