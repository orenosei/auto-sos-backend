import { sql } from "../config/db.js";

const REQUEST_SERVICE_SELECT = `
  rs.request_id,
  s.service_id,
  s.service_name,
  s.service_description,
  rs.service_quantity,
  rs.service_price
`;

export const findRequestServices = async (requestId) => {
  return sql.query(
    `
      SELECT ${REQUEST_SERVICE_SELECT}
      FROM request_services rs
      JOIN services s ON s.service_id = rs.service_id
      WHERE rs.request_id = $1
      ORDER BY s.service_name ASC
    `,
    [requestId]
  );
};

export const upsertRequestService = async (requestId, { service_id, service_quantity, service_price }) => {
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
    [requestId, service_id, service_quantity, service_price]
  );
  return rows[0];
};

export const updateRequestServiceById = async (
  requestId,
  serviceId,
  { service_quantity, service_price }
) => {
  const rows = await sql.query(
    `
      WITH upd AS (
        UPDATE request_services
        SET
          service_quantity = COALESCE($3, service_quantity),
          service_price = COALESCE($4, service_price)
        WHERE request_id = $1 AND service_id = $2
        RETURNING request_id, service_id, service_quantity, service_price
      )
      SELECT
        upd.request_id,
        s.service_id,
        s.service_name,
        s.service_description,
        upd.service_quantity,
        upd.service_price
      FROM upd
      JOIN services s ON s.service_id = upd.service_id
    `,
    [requestId, serviceId, service_quantity ?? null, service_price ?? null]
  );
  return rows[0] ?? null;
};

export const deleteRequestServiceById = async (requestId, serviceId) => {
  const rows = await sql.query(
    `
      DELETE FROM request_services
      WHERE request_id = $1 AND service_id = $2
      RETURNING request_id, service_id, service_quantity, service_price
    `,
    [requestId, serviceId]
  );
  return rows[0] ?? null;
};
