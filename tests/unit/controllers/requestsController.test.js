import { beforeEach, describe, expect, it, vi } from "vitest";

const entityRepository = vi.hoisted(() => ({
  companyExists: vi.fn(),
  userExists: vi.fn(),
  vehicleBelongsToCompany: vi.fn(),
  vehicleExists: vi.fn(),
}));

const requestRepository = vi.hoisted(() => ({
  deleteRequestById: vi.fn(),
  findCompanyServicePrice: vi.fn(),
  findRequestById: vi.fn(),
  findRequests: vi.fn(),
  insertRequest: vi.fn(),
  insertRequestStatusHistory: vi.fn(),
  syncRequestVehicleStatus: vi.fn(),
  updateRequestById: vi.fn(),
  upsertRequestServiceLine: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createNotification: vi.fn(),
  getRequestStatusNotification: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/requestRepository.js", () => requestRepository);
vi.mock("../../../src/services/notificationService.js", () => notificationService);

const {
  createRequest,
  deleteRequest,
  getRequestById,
  getRequests,
  updateRequest,
} = await import("../../../src/controllers/requestsController.js");

const createRes = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe("requestsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.companyExists.mockResolvedValue(true);
    entityRepository.userExists.mockResolvedValue(true);
    entityRepository.vehicleExists.mockResolvedValue(true);
    entityRepository.vehicleBelongsToCompany.mockResolvedValue(true);
    requestRepository.findCompanyServicePrice.mockResolvedValue(250000);
    requestRepository.syncRequestVehicleStatus.mockResolvedValue(undefined);
    notificationService.getRequestStatusNotification.mockReturnValue([
      "Status changed",
      "Request status changed.",
    ]);
  });

  describe("getRequests", () => {
    it("requires either user_id or company_id", async () => {
      const res = createRes();

      await getRequests({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Missing required query param: user_id or company_id",
      });
    });

    it("rejects invalid status filters", async () => {
      const res = createRes();

      await getRequests({ query: { user_id: "1", request_status: "bad" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(requestRepository.findRequests).not.toHaveBeenCalled();
    });

    it("returns 404 when the filtered user does not exist", async () => {
      entityRepository.userExists.mockResolvedValue(false);
      const res = createRes();

      await getRequests({ query: { user_id: "404" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("returns matching requests", async () => {
      const rows = [{ request_id: 1 }];
      requestRepository.findRequests.mockResolvedValue(rows);
      const res = createRes();

      await getRequests(
        { query: { company_id: "2", request_status: "pending" } },
        res
      );

      expect(requestRepository.findRequests).toHaveBeenCalledWith({
        user_id: undefined,
        company_id: "2",
        request_status: "pending",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
    });
  });

  describe("getRequestById", () => {
    it("returns 404 for an unknown request", async () => {
      requestRepository.findRequestById.mockResolvedValue(null);
      const res = createRes();

      await getRequestById({ params: { id: "999" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Request not found" });
    });
  });

  describe("createRequest", () => {
    it("requires a valid absolute_location", async () => {
      const res = createRes();

      await createRequest({ body: { absolute_location: { lat: "bad", lng: 105 } } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Missing or invalid required field: absolute_location",
      });
    });

    it("rejects service selections not provided by the company", async () => {
      requestRepository.findCompanyServicePrice.mockResolvedValue(null);
      const res = createRes();

      await createRequest(
        {
          body: {
            user_id: 1,
            company_id: 2,
            service_id: 9,
            absolute_location: { lat: 21, lng: 105 },
          },
        },
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Selected company does not provide this service",
      });
      expect(requestRepository.insertRequest).not.toHaveBeenCalled();
    });

    it("creates request, service line, history, and company notification", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-13T10:00:00.000Z"));
      const created = {
        request_id: 10,
        company_id: 2,
        request_status: "pending",
      };
      requestRepository.insertRequest.mockResolvedValue(created);
      const res = createRes();

      await createRequest(
        {
          body: {
            user_id: 1,
            company_id: 2,
            service_id: 3,
            service_quantity: 2,
            eta_minutes: 15,
            absolute_location: { lat: 21, lng: 105 },
          },
        },
        res
      );

      expect(requestRepository.insertRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 1,
          company_id: 2,
          geogText: "SRID=4326;POINT(105 21)",
          estimatedArrivalValue: "2026-06-13T10:15:00.000Z",
        })
      );
      expect(requestRepository.upsertRequestServiceLine).toHaveBeenCalledWith({
        requestId: 10,
        serviceId: 3,
        serviceQuantity: 2,
        servicePrice: 250000,
      });
      expect(requestRepository.insertRequestStatusHistory).toHaveBeenCalledWith({
        requestId: 10,
        oldStatus: null,
        newStatus: "pending",
        changedBy: "user",
        note: "Request created",
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientType: "company",
          recipientId: 2,
          requestId: 10,
          type: "request_created",
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: created });

      vi.useRealTimers();
    });
  });

  describe("updateRequest", () => {
    it("returns 404 when the request does not exist", async () => {
      requestRepository.findRequestById.mockResolvedValue(null);
      const res = createRes();

      await updateRequest({ params: { id: "1" }, body: { request_status: "accepted" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Request not found" });
    });

    it("rejects vehicles that do not belong to the target company", async () => {
      requestRepository.findRequestById.mockResolvedValue({
        request_id: 1,
        company_id: 2,
        request_status: "pending",
      });
      entityRepository.vehicleBelongsToCompany.mockResolvedValue(false);
      const res = createRes();

      await updateRequest({ params: { id: "1" }, body: { vehicle_id: 7 } }, res);

      expect(entityRepository.vehicleBelongsToCompany).toHaveBeenCalledWith(7, 2);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Vehicle not found" });
    });

    it("records history and notifies the user when status changes", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-13T11:00:00.000Z"));
      const current = { request_id: 1, request_status: "pending", company_id: 2 };
      const next = {
        request_id: 1,
        request_status: "accepted",
        company_id: 2,
        user_id: 5,
      };
      requestRepository.findRequestById.mockResolvedValue(current);
      requestRepository.updateRequestById.mockResolvedValue(next);
      const res = createRes();

      await updateRequest(
        {
          params: { id: "1" },
          body: { request_status: "accepted", changed_by: "company", note: "OK" },
        },
        res
      );

      expect(requestRepository.updateRequestById).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          request_status: "accepted",
          acceptedAt: "2026-06-13T11:00:00.000Z",
        })
      );
      expect(requestRepository.insertRequestStatusHistory).toHaveBeenCalledWith({
        requestId: "1",
        oldStatus: "pending",
        newStatus: "accepted",
        changedBy: "company",
        note: "OK",
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        recipientType: "user",
        recipientId: 5,
        requestId: 1,
        title: "Status changed",
        message: "Request status changed.",
        type: "request_accepted",
      });
      expect(requestRepository.syncRequestVehicleStatus).toHaveBeenCalledWith(current, next);
      expect(res.status).toHaveBeenCalledWith(200);

      vi.useRealTimers();
    });

    it("does not write status history when status is unchanged", async () => {
      const current = { request_id: 1, request_status: "pending", company_id: 2 };
      requestRepository.findRequestById.mockResolvedValue(current);
      requestRepository.updateRequestById.mockResolvedValue(current);
      const res = createRes();

      await updateRequest(
        { params: { id: "1" }, body: { request_status: "pending" } },
        res
      );

      expect(requestRepository.insertRequestStatusHistory).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteRequest", () => {
    it("returns 404 when deletion does not remove a request", async () => {
      requestRepository.deleteRequestById.mockResolvedValue(null);
      const res = createRes();

      await deleteRequest({ params: { id: "1" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Request not found" });
    });
  });
});
