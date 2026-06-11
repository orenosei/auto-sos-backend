import { companyExists } from "../repositories/entityRepository.js";
import {
  deleteVehicleById,
  findVehiclesByCompany,
  insertVehicle,
  updateVehicleById,
} from "../repositories/vehicleRepository.js";
import { isUniqueViolation } from "../utils/dbErrors.js";
import { toGeogPointText } from "../utils/geo.js";

const VEHICLE_STATUSES = new Set(["available", "busy", "maintenance"]);

const isValidVehicleStatus = (value) =>
  typeof value === "string" && VEHICLE_STATUSES.has(value);

export const getVehicles = async (req, res) => {
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: "Missing required query param: company_id" });
  }

  try {
    const companyOk = await companyExists(company_id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const rows = await findVehiclesByCompany(company_id);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createVehicle = async (req, res) => {
  const {
    company_id,
    vehicle_license,
    vehicle_type,
    vehicle_status,
    equipment_description,
    current_location,
  } = req.body;

  if (!company_id || !vehicle_license || !vehicle_type) {
    return res.status(400).json({
      error: "Missing required fields: company_id, vehicle_license, vehicle_type",
    });
  }

  if (vehicle_status != null && !isValidVehicleStatus(vehicle_status)) {
    return res.status(400).json({
      error: "vehicle_status must be one of: available, busy, maintenance",
    });
  }

  try {
    const companyOk = await companyExists(company_id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const created = await insertVehicle({
      company_id,
      vehicle_license,
      vehicle_type,
      vehicle_status,
      equipment_description,
      geogText: toGeogPointText(current_location),
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res
        .status(409)
        .json({ error: "vehicle_license already exists" });
    }

    console.error("Error creating vehicle:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateVehicle = async (req, res) => {
  const { id } = req.params;
  const {
    vehicle_license,
    vehicle_type,
    vehicle_status,
    equipment_description,
    current_location,
  } = req.body;

  if (vehicle_status != null && !isValidVehicleStatus(vehicle_status)) {
    return res.status(400).json({
      error: "vehicle_status must be one of: available, busy, maintenance",
    });
  }

  try {
    const updated = await updateVehicleById(id, {
      vehicle_license,
      vehicle_type,
      vehicle_status,
      equipment_description,
      geogText: toGeogPointText(current_location),
    });

    if (!updated) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res
        .status(409)
        .json({ error: "vehicle_license already exists" });
    }

    console.error(`Error updating vehicle with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteVehicle = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await deleteVehicleById(id);

    if (!deleted) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(`Error deleting vehicle with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
