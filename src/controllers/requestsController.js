import {
  companyExists,
  userExists,
  vehicleBelongsToCompany,
  vehicleExists,
} from "../repositories/entityRepository.js";
import {
  deleteRequestById,
  findCompanyServicePrice,
  findRequestById,
  findRequests,
  insertRequest,
  insertRequestStatusHistory,
  syncRequestVehicleStatus,
  updateRequestById,
  upsertRequestServiceLine,
} from "../repositories/requestRepository.js";
import {
  createNotification,
  getRequestStatusNotification,
} from "../services/notificationService.js";
import { toGeogPointText } from "../utils/geo.js";

const REQUEST_STATUSES = new Set([
  "pending",
  "accepted",
  "heading",
  "arrived",
  "processing",
  "completed",
  "cancelled",
]);

const isValidRequestStatus = (value) =>
  typeof value === "string" && REQUEST_STATUSES.has(value);

const toEstimatedArrival = (estimatedArrival, etaMinutes) => {
  if (estimatedArrival) return estimatedArrival;

  const minutes = Number(etaMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  return new Date(Date.now() + Math.round(minutes) * 60 * 1000).toISOString();
};

export const getRequests = async (req, res) => {
  const { user_id, company_id, request_status, all } = req.query;
  const requestsAll = all === "true";

  if (!user_id && !company_id && !requestsAll) {
    return res.status(400).json({
      error: "Missing required query param: user_id, company_id, or all=true",
    });
  }

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id && !(await userExists(user_id))) {
      return res.status(404).json({ error: "User not found" });
    }

    if (company_id && !(await companyExists(company_id))) {
      return res.status(404).json({ error: "Company not found" });
    }

    const rows = await findRequests({ user_id, company_id, request_status });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    const request = await findRequestById(id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error(`Error fetching request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createRequest = async (req, res) => {
  const {
    user_id,
    company_id,
    vehicle_id,
    absolute_location,
    request_status,
    estimated_arrival,
    eta_minutes,
    service_id,
    service_quantity,
    service_price,
  } = req.body;

  const geogText = toGeogPointText(absolute_location);
  if (!geogText) {
    return res.status(400).json({
      error: "Missing or invalid required field: absolute_location",
    });
  }

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id != null && !(await userExists(user_id))) {
      return res.status(404).json({ error: "User not found" });
    }

    if (company_id != null && !(await companyExists(company_id))) {
      return res.status(404).json({ error: "Company not found" });
    }

    if (vehicle_id != null && !(await vehicleExists(vehicle_id))) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    let lockedServicePrice = service_price ?? null;
    if (service_id != null && company_id != null && lockedServicePrice == null) {
      lockedServicePrice = await findCompanyServicePrice(company_id, service_id);

      if (lockedServicePrice == null) {
        return res.status(400).json({
          error: "Selected company does not provide this service",
        });
      }
    }

    const created = await insertRequest({
      ...req.body,
      geogText,
      estimatedArrivalValue: toEstimatedArrival(estimated_arrival, eta_minutes),
    });

    if (service_id != null) {
      await upsertRequestServiceLine({
        requestId: created.request_id,
        serviceId: service_id,
        serviceQuantity: service_quantity,
        servicePrice: lockedServicePrice,
      });
    }

    await insertRequestStatusHistory({
      requestId: created.request_id,
      oldStatus: null,
      newStatus: created.request_status,
      changedBy: user_id != null ? "user" : "system",
      note: "Request created",
    });

    if (created.company_id != null) {
      await createNotification({
        recipientType: "company",
        recipientId: created.company_id,
        requestId: created.request_id,
        title: "Yêu cầu cứu hộ mới",
        message: "Bạn có một yêu cầu cứu hộ mới cần tiếp nhận.",
        type: "request_created",
      });
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateRequest = async (req, res) => {
  const { id } = req.params;
  const {
    user_id,
    company_id,
    vehicle_id,
    absolute_location,
    request_status,
    estimated_arrival,
    eta_minutes,
    actual_arrival,
    completed_at,
    cancelled_by,
    changed_by,
    note,
  } = req.body;

  const geogText = toGeogPointText(absolute_location);

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id != null && !(await userExists(user_id))) {
      return res.status(404).json({ error: "User not found" });
    }

    if (company_id != null && !(await companyExists(company_id))) {
      return res.status(404).json({ error: "Company not found" });
    }

    const current = await findRequestById(id);
    if (!current) {
      return res.status(404).json({ error: "Request not found" });
    }

    const nextCompanyId = company_id ?? current.company_id;

    if (vehicle_id != null) {
      const vehicleOk = nextCompanyId != null
        ? await vehicleBelongsToCompany(vehicle_id, nextCompanyId)
        : await vehicleExists(vehicle_id);
      if (!vehicleOk) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
    }

    const next = await updateRequestById(id, {
      ...req.body,
      geogText,
      estimatedArrivalValue: toEstimatedArrival(estimated_arrival, eta_minutes),
      acceptedAt: request_status === "accepted" ? new Date().toISOString() : null,
      headingAt: request_status === "heading" ? new Date().toISOString() : null,
      arrivedAt: request_status === "arrived" ? new Date().toISOString() : null,
      actualArrivalValue:
        request_status === "arrived" ? new Date().toISOString() : actual_arrival ?? null,
      completedAtValue:
        request_status === "completed" ? new Date().toISOString() : completed_at ?? null,
      cancelledAt: request_status === "cancelled" ? new Date().toISOString() : null,
    });

    if (request_status != null && current.request_status !== next.request_status) {
      await insertRequestStatusHistory({
        requestId: id,
        oldStatus: current.request_status,
        newStatus: next.request_status,
        changedBy: changed_by ?? cancelled_by ?? "system",
        note,
      });

      const notification = getRequestStatusNotification(next.request_status);
      if (notification && next.user_id != null) {
        await createNotification({
          recipientType: "user",
          recipientId: next.user_id,
          requestId: next.request_id,
          title: notification[0],
          message: notification[1],
          type: `request_${next.request_status}`,
        });
      }
    }

    await syncRequestVehicleStatus(current, next);

    res.status(200).json({ success: true, data: next });
  } catch (error) {
    console.error(`Error updating request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await deleteRequestById(id);

    if (!deleted) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(`Error deleting request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
