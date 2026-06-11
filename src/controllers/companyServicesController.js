import {
  companyExists,
  serviceExists,
} from "../repositories/entityRepository.js";
import {
  deleteCompanyServiceById,
  findCompanyServices,
  updateCompanyServicePrice,
  upsertCompanyService,
} from "../repositories/companyServiceRepository.js";
import { isNonNegativeNumber } from "../utils/validators.js";

export const getCompanyServices = async (req, res) => {
  const { id } = req.params;

  try {
    const companyOk = await companyExists(id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const rows = await findCompanyServices(id);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching services for company ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addCompanyService = async (req, res) => {
  const { id } = req.params;
  const { service_id, service_price } = req.body;

  if (!service_id || service_price == null) {
    return res
      .status(400)
      .json({ error: "Missing required fields: service_id, service_price" });
  }

  if (!isNonNegativeNumber(service_price)) {
    return res
      .status(400)
      .json({ error: "service_price must be a non-negative number" });
  }

  try {
    const companyOk = await companyExists(id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const serviceOk = await serviceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const row = await upsertCompanyService(id, service_id, service_price);

    res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error(`Error adding service for company ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCompanyService = async (req, res) => {
  const { id, service_id } = req.params;
  const { service_price } = req.body;

  if (service_price == null) {
    return res.status(400).json({ error: "Missing required field: service_price" });
  }

  if (!isNonNegativeNumber(service_price)) {
    return res
      .status(400)
      .json({ error: "service_price must be a non-negative number" });
  }

  try {
    const row = await updateCompanyServicePrice(id, service_id, service_price);

    if (!row) {
      return res.status(404).json({ error: "Company service not found" });
    }

    res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error(`Error updating service for company ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteCompanyService = async (req, res) => {
  const { id, service_id } = req.params;

  try {
    const companyOk = await companyExists(id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const serviceOk = await serviceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const deleted = await deleteCompanyServiceById(id, service_id);

    if (!deleted) {
      return res.status(404).json({ error: "Company service not found" });
    }

    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(
      `Error deleting service ${service_id} for company ${id}:`,
      error
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
};
