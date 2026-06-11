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

export const findVehiclesByCompany = async (companyId) => {
  return sql.query(
    `
      SELECT ${VEHICLE_SELECT}
      FROM rescue_vehicles
      WHERE company_id = $1
      ORDER BY vehicle_id DESC
    `,
    [companyId]
  );
};

export const insertVehicle = async ({
  company_id,
  vehicle_license,
  vehicle_type,
  vehicle_status,
  equipment_description,
  geogText,
}) => {
  const rows = await sql.query(
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
      geogText,
    ]
  );
  return rows[0];
};

export const updateVehicleById = async (
  id,
  {
    vehicle_license,
    vehicle_type,
    vehicle_status,
    equipment_description,
    geogText,
  }
) => {
  const rows = await sql.query(
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
      geogText,
      id,
    ]
  );
  return rows[0] ?? null;
};

export const deleteVehicleById = async (id) => {
  const rows = await sql.query(
    `DELETE FROM rescue_vehicles WHERE vehicle_id = $1 RETURNING ${VEHICLE_SELECT}`,
    [id]
  );
  return rows[0] ?? null;
};
