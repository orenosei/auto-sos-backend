import { sql } from "../config/db.js";

const REQUEST_SELECT = `
  request_id,
  user_id,
  company_id,
  vehicle_id,
  ST_AsGeoJSON(absolute_location::geometry) as absolute_location,
  relative_location,
  request_description,
  issue_type,
  contact_name,
  contact_phone,
  contact_back_now,
  priority,
  request_status,
  created_at,
  estimated_arrival,
  accepted_at,
  heading_at,
  arrived_at,
  actual_arrival,
  completed_at,
  cancelled_at,
  cancelled_by,
  cancel_reason,
  final_price,
  user_confirmed_at
`;

export const findRequests = async ({ user_id, company_id, request_status }) => {
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

  return sql.query(
    `
      SELECT ${REQUEST_SELECT}
      FROM requests
      ${whereSql}
      ORDER BY created_at DESC, request_id DESC
    `,
    values
  );
};

export const findRequestById = async (requestId) => {
  const rows = await sql.query(
    `SELECT ${REQUEST_SELECT} FROM requests WHERE request_id = $1 LIMIT 1`,
    [requestId]
  );
  return rows[0] ?? null;
};

export const findCompanyServicePrice = async (companyId, serviceId) => {
  const rows = await sql.query(
    `
      SELECT service_price
      FROM company_services
      WHERE company_id = $1 AND service_id = $2
      LIMIT 1
    `,
    [companyId, serviceId]
  );
  return rows[0]?.service_price ?? null;
};

export const insertRequest = async ({
  user_id,
  company_id,
  vehicle_id,
  geogText,
  relative_location,
  request_description,
  issue_type,
  contact_name,
  contact_phone,
  contact_back_now,
  priority,
  request_status,
  estimatedArrivalValue,
  actual_arrival,
  completed_at,
}) => {
  const rows = await sql.query(
    `
      INSERT INTO requests (
        user_id,
        company_id,
        vehicle_id,
        absolute_location,
        relative_location,
        request_description,
        issue_type,
        contact_name,
        contact_phone,
        contact_back_now,
        priority,
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
        $7,
        $8,
        $9,
        COALESCE($10, FALSE),
        COALESCE($11, 'normal'),
        COALESCE($12::request_status_enum, 'pending'::request_status_enum),
        $13,
        $14,
        $15
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
      issue_type ?? null,
      contact_name ?? null,
      contact_phone ?? null,
      typeof contact_back_now === "boolean" ? contact_back_now : false,
      priority ?? null,
      request_status ?? null,
      estimatedArrivalValue,
      actual_arrival ?? null,
      completed_at ?? null,
    ]
  );
  return rows[0];
};

export const upsertRequestServiceLine = async ({
  requestId,
  serviceId,
  serviceQuantity,
  servicePrice,
}) => {
  await sql.query(
    `
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
    `,
    [requestId, serviceId, serviceQuantity ?? 1, servicePrice ?? 0]
  );
};

export const insertRequestStatusHistory = async ({
  requestId,
  oldStatus,
  newStatus,
  changedBy,
  note,
}) => {
  await sql.query(
    `
      INSERT INTO request_status_history (
        request_id,
        old_status,
        new_status,
        changed_by,
        note
      )
      VALUES ($1, $2::request_status_enum, $3::request_status_enum, $4, $5)
    `,
    [requestId, oldStatus ?? null, newStatus, changedBy, note ?? null]
  );
};

export const updateRequestById = async (
  id,
  {
    user_id,
    company_id,
    vehicle_id,
    geogText,
    relative_location,
    request_description,
    issue_type,
    contact_name,
    contact_phone,
    contact_back_now,
    priority,
    request_status,
    estimatedArrivalValue,
    acceptedAt,
    headingAt,
    arrivedAt,
    actualArrivalValue,
    completedAtValue,
    cancelledAt,
    cancelled_by,
    cancel_reason,
    final_price,
    user_confirmed_at,
  }
) => {
  const rows = await sql.query(
    `
      UPDATE requests
      SET
        user_id = COALESCE($1, user_id),
        company_id = COALESCE($2, company_id),
        vehicle_id = COALESCE($3, vehicle_id),
        absolute_location = COALESCE(
          CASE
            WHEN $4::text IS NULL THEN NULL
            ELSE ST_GeogFromText($4)
          END,
          absolute_location
        ),
        relative_location = COALESCE($5, relative_location),
        request_description = COALESCE($6, request_description),
        issue_type = COALESCE($7, issue_type),
        contact_name = COALESCE($8, contact_name),
        contact_phone = COALESCE($9, contact_phone),
        contact_back_now = COALESCE($10, contact_back_now),
        priority = COALESCE($11, priority),
        request_status = COALESCE($12::request_status_enum, request_status),
        estimated_arrival = COALESCE($13, estimated_arrival),
        accepted_at = COALESCE($14, accepted_at),
        heading_at = COALESCE($15, heading_at),
        arrived_at = COALESCE($16, arrived_at),
        actual_arrival = COALESCE($17, actual_arrival),
        completed_at = COALESCE($18, completed_at),
        cancelled_at = COALESCE($19, cancelled_at),
        cancelled_by = COALESCE($20, cancelled_by),
        cancel_reason = COALESCE($21, cancel_reason),
        final_price = COALESCE($22, final_price),
        user_confirmed_at = COALESCE($23, user_confirmed_at)
      WHERE request_id = $24
      RETURNING ${REQUEST_SELECT}
    `,
    [
      user_id ?? null,
      company_id ?? null,
      vehicle_id ?? null,
      geogText,
      relative_location ?? null,
      request_description ?? null,
      issue_type ?? null,
      contact_name ?? null,
      contact_phone ?? null,
      typeof contact_back_now === "boolean" ? contact_back_now : null,
      priority ?? null,
      request_status ?? null,
      estimatedArrivalValue,
      acceptedAt,
      headingAt,
      arrivedAt,
      actualArrivalValue,
      completedAtValue,
      cancelledAt,
      cancelled_by ?? null,
      cancel_reason ?? null,
      final_price ?? null,
      user_confirmed_at ?? null,
      id,
    ]
  );
  return rows[0] ?? null;
};

export const syncRequestVehicleStatus = async (oldRequest, newRequest) => {
  const oldVehicleId = oldRequest?.vehicle_id;
  const newVehicleId = newRequest?.vehicle_id;

  if (oldVehicleId && oldVehicleId !== newVehicleId) {
    await sql.query(
      `
        UPDATE rescue_vehicles
        SET vehicle_status = 'available'
        WHERE vehicle_id = $1 AND vehicle_status = 'busy'
      `,
      [oldVehicleId]
    );
  }

  if (!newVehicleId) return;

  if (["accepted", "heading", "arrived", "processing"].includes(newRequest.request_status)) {
    await sql.query(
      `
        UPDATE rescue_vehicles
        SET vehicle_status = 'busy'
        WHERE vehicle_id = $1
      `,
      [newVehicleId]
    );
  }

  if (["completed", "cancelled"].includes(newRequest.request_status)) {
    await sql.query(
      `
        UPDATE rescue_vehicles
        SET vehicle_status = 'available'
        WHERE vehicle_id = $1 AND vehicle_status = 'busy'
      `,
      [newVehicleId]
    );
  }
};

export const deleteRequestById = async (id) => {
  const rows = await sql.query(
    `DELETE FROM requests WHERE request_id = $1 RETURNING ${REQUEST_SELECT}`,
    [id]
  );
  return rows[0] ?? null;
};
