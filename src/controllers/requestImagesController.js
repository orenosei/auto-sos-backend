import { sql } from "../config/db.js";

const ensureRequestExists = async (requestId) => {
  const rows = await sql.query(
    "SELECT 1 FROM requests WHERE request_id = $1 LIMIT 1",
    [requestId]
  );
  return rows.length > 0;
};

export const getRequestImages = async (req, res) => {
  const { id } = req.params;

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const rows = await sql.query(
      `
        SELECT image_id, image_url, request_id
        FROM request_images
        WHERE request_id = $1
        ORDER BY image_id DESC
      `,
      [id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching images for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addRequestImage = async (req, res) => {
  const { id } = req.params;
  const { image_url } = req.body;

  if (!image_url) {
    return res.status(400).json({ error: "Missing required field: image_url" });
  }

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const created = await sql.query(
      `
        INSERT INTO request_images (image_url, request_id)
        VALUES ($1, $2)
        RETURNING image_id, image_url, request_id
      `,
      [image_url, id]
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error(`Error adding image for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequestImage = async (req, res) => {
  const { id, image_id } = req.params;

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const deleted = await sql.query(
      `
        DELETE FROM request_images
        WHERE request_id = $1 AND image_id = $2
        RETURNING image_id, image_url, request_id
      `,
      [id, image_id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Request image not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(`Error deleting image ${image_id} for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
