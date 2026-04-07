import { sql } from "../config/db.js";

const REQUEST_SELECT = `
  request_id,
  user_id,
  company_id,
  vehicle_id,
  ST_AsGeoJSON(absolute_location::geometry) as absolute_location,
  relative_location,
  request_description,
  request_status,
  created_at,
  estimated_arrival,
  actual_arrival,
  completed_at
`;

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

const toGeogPointText = (absoluteLocation) => {
  if (absoluteLocation == null) return null;

  if (typeof absoluteLocation === "string") {
    const trimmed = absoluteLocation.trim();
    if (trimmed.length === 0) return null;
    if (/^SRID=/i.test(trimmed)) return trimmed;
    if (/^POINT\s*\(/i.test(trimmed)) return `SRID=4326;${trimmed}`;
    return trimmed;
  }

  if (typeof absoluteLocation === "object") {
    const lat = absoluteLocation.lat ?? absoluteLocation.latitude;
    const lng =
      absoluteLocation.lng ??
      absoluteLocation.lon ??
      absoluteLocation.longitude;

    if (typeof lat === "number" && typeof lng === "number") {
      return `SRID=4326;POINT(${lng} ${lat})`;
    }
  }

  return null;
};

const ensureUserExists = async (userId) => {
  const rows = await sql.query("SELECT 1 FROM users WHERE user_id = $1 LIMIT 1", [
    userId,
  ]);
  return rows.length > 0;
};

const ensureCompanyExists = async (companyId) => {
  const rows = await sql.query(
    "SELECT 1 FROM companies WHERE company_id = $1 LIMIT 1",
    [companyId]
  );
  return rows.length > 0;
};

const ensureVehicleExists = async (vehicleId) => {
  const rows = await sql.query(
    "SELECT 1 FROM rescue_vehicles WHERE vehicle_id = $1 LIMIT 1",
    [vehicleId]
  );
  return rows.length > 0;
};

export const getRequests = async (req, res) => {
  const { user_id, company_id, request_status } = req.query;

  if (!user_id && !company_id) {
    return res.status(400).json({
      error: "Missing required query param: user_id or company_id",
    });
  }

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id) {
      const userOk = await ensureUserExists(user_id);
      if (!userOk) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (company_id) {
      const companyOk = await ensureCompanyExists(company_id);
      if (!companyOk) {
        return res.status(404).json({ error: "Company not found" });
      }
    }

    const where = [];
    const values = [];

    if (user_id) {
      values.push(user_id);
      where.push(`user_id = $${values.length}`);
    }

    if (company_id) {
      values.push(company_id);
      where.push(`company_id = $${values.length}`);
    }

    if (request_status) {
      values.push(request_status);
      where.push(`request_status = $${values.length}::request_status_enum`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await sql.query(
      `
        SELECT ${REQUEST_SELECT}
        FROM requests
        ${whereSql}
        ORDER BY created_at DESC, request_id DESC
      `,
      values
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await sql.query(
      `SELECT ${REQUEST_SELECT} FROM requests WHERE request_id = $1 LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
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
    relative_location,
    request_description,
    request_status,
    estimated_arrival,
    actual_arrival,
    completed_at,
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
    if (user_id != null) {
      const userOk = await ensureUserExists(user_id);
      if (!userOk) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (company_id != null) {
      const companyOk = await ensureCompanyExists(company_id);
      if (!companyOk) {
        return res.status(404).json({ error: "Company not found" });
      }
    }

    if (vehicle_id != null) {
      const vehicleOk = await ensureVehicleExists(vehicle_id);
      if (!vehicleOk) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
    }

    const created = await sql.query(
      `
        INSERT INTO requests (
          user_id,
          company_id,
          vehicle_id,
          absolute_location,
          relative_location,
          request_description,
          request_status,
          estimated_arrival,
          actual_arrival,
          completed_at
        )
        VALUES (
          $1,
          $2,
          $3,
          ST_GeogFromText($4),
          $5,
          $6,
          COALESCE($7::request_status_enum, 'pending'::request_status_enum),
          $8,
          $9,
          $10
        )
        RETURNING ${REQUEST_SELECT}
      `,
      [
        user_id ?? null,
        company_id ?? null,
        vehicle_id ?? null,
        geogText,
        relative_location ?? null,
        request_description ?? null,
        request_status ?? null,
        estimated_arrival ?? null,
        actual_arrival ?? null,
        completed_at ?? null,
      ]
    );

    res.status(201).json({ success: true, data: created[0] });
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
    relative_location,
    request_description,
    request_status,
    estimated_arrival,
    actual_arrival,
    completed_at,
  } = req.body;

  const geogText = toGeogPointText(absolute_location);

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id != null) {
      const userOk = await ensureUserExists(user_id);
      if (!userOk) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (company_id != null) {
      const companyOk = await ensureCompanyExists(company_id);
      if (!companyOk) {
        return res.status(404).json({ error: "Company not found" });
      }
    }

    if (vehicle_id != null) {
      const vehicleOk = await ensureVehicleExists(vehicle_id);
      if (!vehicleOk) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
    }

    const updated = await sql.query(
      `
        UPDATE requests
        SET
          user_id = COALESCE($1, user_id),
          company_id = COALESCE($2, company_id),
          vehicle_id = COALESCE($3, vehicle_id),
          absolute_location = COALESCE(ST_GeogFromText($4), absolute_location),
          relative_location = COALESCE($5, relative_location),
          request_description = COALESCE($6, request_description),
          request_status = COALESCE($7::request_status_enum, request_status),
          estimated_arrival = COALESCE($8, estimated_arrival),
          actual_arrival = COALESCE($9, actual_arrival),
          completed_at = COALESCE($10, completed_at)
        WHERE request_id = $11
        RETURNING ${REQUEST_SELECT}
      `,
      [
        user_id ?? null,
        company_id ?? null,
        vehicle_id ?? null,
        geogText,
        relative_location ?? null,
        request_description ?? null,
        request_status ?? null,
        estimated_arrival ?? null,
        actual_arrival ?? null,
        completed_at ?? null,
        id,
      ]
    );

    if (updated.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    console.error(`Error updating request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await sql.query(
      `DELETE FROM requests WHERE request_id = $1 RETURNING ${REQUEST_SELECT}`,
      [id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(`Error deleting request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
