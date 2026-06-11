import { sql } from "../config/db.js";

const REQUEST_IMAGE_SELECT = "image_id, image_url, request_id";

export const findRequestImages = async (requestId) => {
  return sql.query(
    `
      SELECT ${REQUEST_IMAGE_SELECT}
      FROM request_images
      WHERE request_id = $1
      ORDER BY image_id DESC
    `,
    [requestId]
  );
};

export const insertRequestImage = async (requestId, imageUrl) => {
  const rows = await sql.query(
    `
      INSERT INTO request_images (image_url, request_id)
      VALUES ($1, $2)
      RETURNING ${REQUEST_IMAGE_SELECT}
    `,
    [imageUrl, requestId]
  );
  return rows[0];
};

export const deleteRequestImageById = async (requestId, imageId) => {
  const rows = await sql.query(
    `
      DELETE FROM request_images
      WHERE request_id = $1 AND image_id = $2
      RETURNING ${REQUEST_IMAGE_SELECT}
    `,
    [requestId, imageId]
  );
  return rows[0] ?? null;
};
