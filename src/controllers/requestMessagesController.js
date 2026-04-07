import { sql } from "../config/db.js";

const MESSAGE_SENDERS = new Set(["user", "company"]);

const isValidMessageSender = (value) =>
  typeof value === "string" && MESSAGE_SENDERS.has(value);

const ensureRequestExists = async (requestId) => {
  const rows = await sql.query(
    "SELECT 1 FROM requests WHERE request_id = $1 LIMIT 1",
    [requestId]
  );
  return rows.length > 0;
};

export const getRequestMessages = async (req, res) => {
  const { id } = req.params;

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const rows = await sql.query(
      `
        SELECT
          message_id,
          request_id,
          message_sender,
          message_content,
          is_seen,
          sent_at
        FROM messages
        WHERE request_id = $1
        ORDER BY sent_at ASC, message_id ASC
      `,
      [id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching messages for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addRequestMessage = async (req, res) => {
  const { id } = req.params;
  const { message_sender, message_content, is_seen } = req.body;

  if (!message_sender || !message_content) {
    return res.status(400).json({
      error: "Missing required fields: message_sender, message_content",
    });
  }

  if (!isValidMessageSender(message_sender)) {
    return res.status(400).json({
      error: "message_sender must be one of: user, company",
    });
  }

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const created = await sql.query(
      `
        INSERT INTO messages (
          request_id,
          message_sender,
          message_content,
          is_seen
        )
        VALUES (
          $1,
          $2::message_sender_enum,
          $3,
          COALESCE($4, false)
        )
        RETURNING
          message_id,
          request_id,
          message_sender,
          message_content,
          is_seen,
          sent_at
      `,
      [id, message_sender, message_content, typeof is_seen === "boolean" ? is_seen : null]
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error(`Error adding message for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const markMessageSeen = async (req, res) => {
  const { id, message_id } = req.params;
  const { is_seen } = req.body;

  const seenValue = typeof is_seen === "boolean" ? is_seen : true;

  try {
    const requestOk = await ensureRequestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const updated = await sql.query(
      `
        UPDATE messages
        SET is_seen = $3
        WHERE request_id = $1 AND message_id = $2
        RETURNING
          message_id,
          request_id,
          message_sender,
          message_content,
          is_seen,
          sent_at
      `,
      [id, message_id, seenValue]
    );

    if (updated.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    console.error(`Error marking message ${message_id} seen for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
