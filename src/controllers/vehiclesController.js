import { sql } from "../config/db.js";

const VEHICLE_SELECT = `
  vehicle_id,
  company_id,
  vehicle_license,
  vehicle_type,
  vehicle_status,
  equipment_description,
  ST_AsGeoJSON(current_location::geometry) as current_location
`;

const VEHICLE_STATUSES = new Set(["available", "busy", "maintenance"]);

const ensureCompanyExists = async (companyId) => {
  const rows = await sql.query(
    "SELECT 1 FROM companies WHERE company_id = $1 LIMIT 1",
    [companyId]
  );
  return rows.length > 0;
};

const isValidVehicleStatus = (value) =>
  typeof value === "string" && VEHICLE_STATUSES.has(value);

const isUniqueViolation = (error) => {
  // Postgres unique_violation = 23505
  return error && typeof error === "object" && error.code === "23505";
};

export const getVehicles = async (req, res) => {
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: "Missing required query param: company_id" });
  }

  try {
    const companyOk = await ensureCompanyExists(company_id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const rows = await sql.query(
      `
        SELECT ${VEHICLE_SELECT}
        FROM rescue_vehicles
        WHERE company_id = $1
        ORDER BY vehicle_id DESC
      `,
      [company_id]
    );

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
    const companyOk = await ensureCompanyExists(company_id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const created = await sql.query(
      `
        INSERT INTO rescue_vehicles (
          company_id,
          vehicle_license,
          vehicle_type,
          vehicle_status,
          equipment_description,
          current_location
        )
        VALUES (
          $1,
          $2,
          $3,
          COALESCE($4::vehicle_status_enum, 'available'::vehicle_status_enum),
          $5,
          CASE
            WHEN $6::text IS NULL THEN NULL
            ELSE ST_GeogFromText($6)
          END
        )
        RETURNING ${VEHICLE_SELECT}
      `,
      [
        company_id,
        vehicle_license,
        vehicle_type,
        vehicle_status ?? null,
        equipment_description ?? null,
        toGeogPointText(current_location),
      ]
    );

    res.status(201).json({ success: true, data: created[0] });
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
    const updated = await sql.query(
      `
        UPDATE rescue_vehicles
        SET
          vehicle_license = COALESCE($1, vehicle_license),
          vehicle_type = COALESCE($2, vehicle_type),
          vehicle_status = COALESCE($3::vehicle_status_enum, vehicle_status),
          equipment_description = COALESCE($4, equipment_description),
          current_location = COALESCE(
            CASE
              WHEN $5::text IS NULL THEN NULL
              ELSE ST_GeogFromText($5)
            END,
            current_location
          )
        WHERE vehicle_id = $6
        RETURNING ${VEHICLE_SELECT}
      `,
      [
        vehicle_license ?? null,
        vehicle_type ?? null,
        vehicle_status ?? null,
        equipment_description ?? null,
        toGeogPointText(current_location),
        id,
      ]
    );

    if (updated.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.status(200).json({ success: true, data: updated[0] });
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

const toGeogPointText = (location) => {
  if (location == null) return null;

  if (typeof location === "string") {
    const trimmed = location.trim();
    if (trimmed.length === 0) return null;
    if (/^SRID=/i.test(trimmed)) return trimmed;
    if (/^POINT\s*\(/i.test(trimmed)) return `SRID=4326;${trimmed}`;
    return trimmed;
  }

  if (typeof location === "object") {
    const lat = location.lat ?? location.latitude;
    const lng = location.lng ?? location.lon ?? location.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      return `SRID=4326;POINT(${lng} ${lat})`;
    }
  }

  return null;
};

export const deleteVehicle = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await sql.query(
      `DELETE FROM rescue_vehicles WHERE vehicle_id = $1 RETURNING ${VEHICLE_SELECT}`,
      [id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(`Error deleting vehicle with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
