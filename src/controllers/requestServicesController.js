import {
  requestExists,
  serviceExists,
} from "../repositories/entityRepository.js";
import {
  deleteRequestServiceById,
  findRequestServices,
  updateRequestServiceById,
  upsertRequestService,
} from "../repositories/requestServiceRepository.js";
import { isNonNegativeNumber, isPositiveInteger } from "../utils/validators.js";

export const getRequestServices = async (req, res) => {
  const { id } = req.params;

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const rows = await findRequestServices(id);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching services for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addRequestService = async (req, res) => {
  const { id } = req.params;
  const { service_id, service_quantity, service_price } = req.body;

  if (!service_id || service_quantity == null || service_price == null) {
    return res.status(400).json({
      error:
        "Missing required fields: service_id, service_quantity, service_price",
    });
  }

  if (!isPositiveInteger(service_quantity)) {
    return res
      .status(400)
      .json({ error: "service_quantity must be a positive integer" });
  }

  if (!isNonNegativeNumber(service_price)) {
    return res
      .status(400)
      .json({ error: "service_price must be a non-negative number" });
  }

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const serviceOk = await serviceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const row = await upsertRequestService(id, {
      service_id,
      service_quantity,
      service_price,
    });

    res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error(`Error adding service to request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateRequestService = async (req, res) => {
  const { id, service_id } = req.params;
  const { service_quantity, service_price } = req.body;

  if (service_quantity == null && service_price == null) {
    return res.status(400).json({
      error: "Missing required field: service_quantity or service_price",
    });
  }

  if (service_quantity != null && !isPositiveInteger(service_quantity)) {
    return res
      .status(400)
      .json({ error: "service_quantity must be a positive integer" });
  }

  if (service_price != null && !isNonNegativeNumber(service_price)) {
    return res
      .status(400)
      .json({ error: "service_price must be a non-negative number" });
  }

  try {
    const row = await updateRequestServiceById(id, service_id, {
      service_quantity,
      service_price,
    });

    if (!row) {
      return res.status(404).json({ error: "Request service not found" });
    }

    res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error(`Error updating service ${service_id} for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequestService = async (req, res) => {
  const { id, service_id } = req.params;

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const serviceOk = await serviceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const deleted = await deleteRequestServiceById(id, service_id);

    if (!deleted) {
      return res.status(404).json({ error: "Request service not found" });
    }

    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(`Error deleting service ${service_id} for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
