import { sql } from "../config/db.js";

export const findAllServices = async () => {
  return sql.query(
    `
      SELECT service_id, service_name, service_description
      FROM services
      ORDER BY service_name ASC
    `
  );
};
