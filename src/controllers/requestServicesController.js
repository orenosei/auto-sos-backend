import { sql } from "../config/db.js";

const isPositiveInteger = (value) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isNonNegativeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const ensureRequestExists = async (requestId) => {
  const rows = await sql.query(
    "SELECT 1 FROM requests WHERE request_id = $1 LIMIT 1",
    [requestId]
  );
  return rows.length > 0;
};

const ensureServiceExists = async (serviceId) => {
  const rows = await sql.query(
    "SELECT 1 FROM services WHERE service_id = $1 LIMIT 1",
    [serviceId]
  );
  return rows.length > 0;
};

export const getRequestServices = async (req, res) => {
  const { id } = req.params;

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const rows = await sql.query(
      `
        SELECT
          rs.request_id,
          s.service_id,
          s.service_name,
          s.service_description,
          rs.service_quantity,
          rs.service_price
        FROM request_services rs
        JOIN services s ON s.service_id = rs.service_id
        WHERE rs.request_id = $1
        ORDER BY s.service_name ASC
      `,
      [id]
    );

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
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const serviceOk = await ensureServiceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const rows = await sql.query(
      `
        WITH upsert AS (
          INSERT INTO request_services (
            request_id,
            service_id,
            service_quantity,
            service_price
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (request_id, service_id)
          DO UPDATE SET
            service_quantity = EXCLUDED.service_quantity,
            service_price = EXCLUDED.service_price
          RETURNING request_id, service_id, service_quantity, service_price
        )
        SELECT
          u.request_id,
          s.service_id,
          s.service_name,
          s.service_description,
          u.service_quantity,
          u.service_price
        FROM upsert u
        JOIN services s ON s.service_id = u.service_id
      `,
      [id, service_id, service_quantity, service_price]
    );

    res.status(201).json({ success: true, data: rows[0] });
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
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const serviceOk = await ensureServiceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const updated = await sql.query(
      `
        UPDATE request_services
        SET
          service_quantity = COALESCE($3, service_quantity),
          service_price = COALESCE($4, service_price)
        WHERE request_id = $1 AND service_id = $2
        RETURNING request_id, service_id, service_quantity, service_price
      `,
      [
        id,
        service_id,
        service_quantity ?? null,
        service_price ?? null,
      ]
    );

    if (updated.length === 0) {
      return res.status(404).json({ error: "Request service not found" });
    }

    const rows = await sql.query(
      `
        SELECT
          rs.request_id,
          s.service_id,
          s.service_name,
          s.service_description,
          rs.service_quantity,
          rs.service_price
        FROM request_services rs
        JOIN services s ON s.service_id = rs.service_id
        WHERE rs.request_id = $1 AND rs.service_id = $2
        LIMIT 1
      `,
      [id, service_id]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(`Error updating service ${service_id} for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequestService = async (req, res) => {
  const { id, service_id } = req.params;

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const serviceOk = await ensureServiceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const deleted = await sql.query(
      `
        DELETE FROM request_services
        WHERE request_id = $1 AND service_id = $2
        RETURNING request_id, service_id, service_quantity, service_price
      `,
      [id, service_id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Request service not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(`Error deleting service ${service_id} for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
