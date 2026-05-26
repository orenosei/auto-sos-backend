import { sql } from "../config/db.js";

const isNonNegativeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const ensureCompanyExists = async (companyId) => {
  const rows = await sql.query(
    "SELECT 1 FROM companies WHERE company_id = $1 LIMIT 1",
    [companyId]
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

export const getCompanyServices = async (req, res) => {
  const { id } = req.params;

  try {
    const companyOk = await ensureCompanyExists(id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const rows = await sql.query(
      `
        SELECT
          cs.company_id,
          s.service_id,
          s.service_name,
          s.service_description,
          cs.service_price
        FROM company_services cs
        JOIN services s ON s.service_id = cs.service_id
        WHERE cs.company_id = $1
        ORDER BY s.service_name ASC
      `,
      [id]
    );

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
    const companyOk = await ensureCompanyExists(id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const serviceOk = await ensureServiceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const rows = await sql.query(
      `
        WITH upsert AS (
          INSERT INTO company_services (company_id, service_id, service_price)
          VALUES ($1, $2, $3)
          ON CONFLICT (company_id, service_id)
          DO UPDATE SET service_price = EXCLUDED.service_price
          RETURNING company_id, service_id, service_price
        )
        SELECT
          u.company_id,
          s.service_id,
          s.service_name,
          s.service_description,
          u.service_price
        FROM upsert u
        JOIN services s ON s.service_id = u.service_id
      `,
      [id, service_id, service_price]
    );

    res.status(201).json({ success: true, data: rows[0] });
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
    // Gộp UPDATE + JOIN vào 1 CTE — giảm từ 4 roundtrip xuống còn 1
    const rows = await sql.query(
      `
        WITH upd AS (
          UPDATE company_services
          SET service_price = $3
          WHERE company_id = $1 AND service_id = $2
          RETURNING company_id, service_id, service_price
        )
        SELECT
          upd.company_id,
          s.service_id,
          s.service_name,
          s.service_description,
          upd.service_price
        FROM upd
        JOIN services s ON s.service_id = upd.service_id
      `,
      [id, service_id, service_price]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Company service not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(`Error updating service for company ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteCompanyService = async (req, res) => {
  const { id, service_id } = req.params;

  try {
    const companyOk = await ensureCompanyExists(id);
    if (!companyOk) {
      return res.status(404).json({ error: "Company not found" });
    }

    const serviceOk = await ensureServiceExists(service_id);
    if (!serviceOk) {
      return res.status(404).json({ error: "Service not found" });
    }

    const deleted = await sql.query(
      `
        DELETE FROM company_services
        WHERE company_id = $1 AND service_id = $2
        RETURNING company_id, service_id, service_price
      `,
      [id, service_id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Company service not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(
      `Error deleting service ${service_id} for company ${id}:`,
      error
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
};
