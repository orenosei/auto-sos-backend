import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const companyRepository = vi.hoisted(() => ({
  deleteCompanyById: vi.fn(),
  findAllCompanies: vi.fn(),
  findCompanyById: vi.fn(),
  findCompanyCandidates: vi.fn(),
  findCompanyReports: vi.fn(),
  findCompanyRatingsByIds: vi.fn(),
  findNearbyCompanies: vi.fn(),
  insertCompany: vi.fn(),
  insertCompanyReport: vi.fn(),
  updateCompanyById: vi.fn(),
  updateCompanyReportStatusById: vi.fn(),
}));

const entityRepository = vi.hoisted(() => ({
  companyExists: vi.fn(),
  userExists: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createAdminNotifications: vi.fn(),
}));

vi.mock("../../../src/repositories/companyRepository.js", () => companyRepository);
vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/services/notificationService.js", () => notificationService);

const {
  createCompanyReport,
  createCompany,
  deleteCompany,
  getAllCompanies,
  getCompaniesRatings,
  getCompanyById,
  getCompanyReports,
  getNearbyCompanies,
  recommendCompany,
  updateCompanyReportStatus,
  updateCompany,
} = await import("../../../src/controllers/companiesController.js");

describe("companiesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.companyExists.mockResolvedValue(true);
    entityRepository.userExists.mockResolvedValue(true);
  });

  it("creates, lists, and moderates company reports", async () => {
    const created = {
      report_id: 8,
      company_id: 2,
      reporter_user_id: 5,
      reason: "Thu phí sai",
      status: "pending",
    };
    companyRepository.insertCompanyReport.mockResolvedValue(created);
    const createRes = createMockResponse();

    await createCompanyReport(
      {
        params: { id: "2" },
        body: { reporter_user_id: 5, reason: " Thu phí sai " },
      },
      createRes
    );

    expect(companyRepository.insertCompanyReport).toHaveBeenCalledWith({
      companyId: "2",
      reporterUserId: 5,
      reason: "Thu phí sai",
    });
    expect(notificationService.createAdminNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ type: "company_report" })
    );
    expect(createRes.status).toHaveBeenCalledWith(201);

    companyRepository.findCompanyReports.mockResolvedValue([created]);
    const listRes = createMockResponse();
    await getCompanyReports({ query: { status: "pending" } }, listRes);
    expect(companyRepository.findCompanyReports).toHaveBeenCalledWith({
      status: "pending",
    });
    expect(listRes.status).toHaveBeenCalledWith(200);

    companyRepository.updateCompanyReportStatusById.mockResolvedValue({
      ...created,
      status: "reviewed",
    });
    const updateRes = createMockResponse();
    await updateCompanyReportStatus(
      { params: { reportId: "8" }, body: { status: "reviewed" } },
      updateRes
    );
    expect(updateRes.status).toHaveBeenCalledWith(200);
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

  it("ranks verified service candidates using multiple criteria", async () => {
    companyRepository.findCompanyCandidates.mockResolvedValue([
      {
        company_id: 1,
        company_name: "Gần",
        distance_km: "2",
        avg_response_minutes: "10",
        average_rating: "4.8",
        service_price: "200000",
      },
      {
        company_id: 2,
        company_name: "Xa",
        distance_km: "10",
        avg_response_minutes: "25",
        average_rating: "4",
        service_price: "300000",
      },
    ]);
    const res = createMockResponse();

    await recommendCompany(
      {
        body: { latitude: 21, longitude: 105, service_id: 3 },
      },
      res
    );

    expect(companyRepository.findCompanyCandidates).toHaveBeenCalledWith({
      latitude: 21,
      longitude: 105,
      serviceId: 3,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ company_id: 1 }),
      })
    );
  });
});
