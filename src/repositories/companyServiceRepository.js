import { sql } from "../config/db.js";

const COMPANY_SERVICE_SELECT = `
  cs.company_id,
  s.service_id,
  s.service_name,
  s.service_description,
  cs.service_price
`;

export const findCompanyServices = async (companyId) => {
  return sql.query(
    `
      SELECT ${COMPANY_SERVICE_SELECT}
      FROM company_services cs
      JOIN services s ON s.service_id = cs.service_id
      WHERE cs.company_id = $1
      ORDER BY s.service_name ASC
    `,
    [companyId]
  );
};

export const upsertCompanyService = async (companyId, serviceId, servicePrice) => {
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
    [companyId, serviceId, servicePrice]
  );
  return rows[0];
};

export const updateCompanyServicePrice = async (companyId, serviceId, servicePrice) => {
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
    [companyId, serviceId, servicePrice]
  );
  return rows[0] ?? null;
};

export const deleteCompanyServiceById = async (companyId, serviceId) => {
  const rows = await sql.query(
    `
      DELETE FROM company_services
      WHERE company_id = $1 AND service_id = $2
      RETURNING company_id, service_id, service_price
    `,
    [companyId, serviceId]
  );
  return rows[0] ?? null;
};
