import { sql } from "../config/db.js";

export const userExists = async (userId) => {
  const rows = await sql.query("SELECT 1 FROM users WHERE user_id = $1 LIMIT 1", [userId]);
  return rows.length > 0;
};

export const companyExists = async (companyId) => {
  const rows = await sql.query("SELECT 1 FROM companies WHERE company_id = $1 LIMIT 1", [companyId]);
  return rows.length > 0;
};

export const serviceExists = async (serviceId) => {
  const rows = await sql.query("SELECT 1 FROM services WHERE service_id = $1 LIMIT 1", [serviceId]);
  return rows.length > 0;
};

export const requestExists = async (requestId) => {
  const rows = await sql.query("SELECT 1 FROM requests WHERE request_id = $1 LIMIT 1", [requestId]);
  return rows.length > 0;
};

export const getRequestSummary = async (requestId) => {
  const rows = await sql.query(
    "SELECT request_id, company_id, request_status FROM requests WHERE request_id = $1 LIMIT 1",
    [requestId]
  );
  return rows[0] ?? null;
};

export const postExists = async (postId) => {
  const rows = await sql.query("SELECT 1 FROM posts WHERE post_id = $1 LIMIT 1", [postId]);
  return rows.length > 0;
};

export const commentExists = async (commentId) => {
  const rows = await sql.query("SELECT 1 FROM comments WHERE comment_id = $1 LIMIT 1", [commentId]);
  return rows.length > 0;
};

export const vehicleExists = async (vehicleId) => {
  const rows = await sql.query("SELECT 1 FROM rescue_vehicles WHERE vehicle_id = $1 LIMIT 1", [vehicleId]);
  return rows.length > 0;
};

export const vehicleBelongsToCompany = async (vehicleId, companyId) => {
  const rows = await sql.query(
    `
      SELECT 1
      FROM rescue_vehicles
      WHERE vehicle_id = $1 AND company_id = $2
      LIMIT 1
    `,
    [vehicleId, companyId]
  );
  return rows.length > 0;
};
