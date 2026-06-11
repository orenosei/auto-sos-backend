import { sql } from "../config/db.js";

const MESSAGE_SELECT = `
  message_id,
  request_id,
  message_sender,
  message_content,
  is_seen,
  sent_at
`;

export const findRequestMessages = async (requestId) => {
  return sql.query(
    `
      SELECT ${MESSAGE_SELECT}
      FROM messages
      WHERE request_id = $1
      ORDER BY sent_at ASC, message_id ASC
    `,
    [requestId]
  );
};

export const insertRequestMessage = async (requestId, { message_sender, message_content, is_seen }) => {
  const rows = await sql.query(
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
      RETURNING ${MESSAGE_SELECT}
    `,
    [requestId, message_sender, message_content, typeof is_seen === "boolean" ? is_seen : null]
  );
  return rows[0];
};

export const updateMessageSeen = async (requestId, messageId, seenValue) => {
  const rows = await sql.query(
    `
      UPDATE messages
      SET is_seen = $3
      WHERE request_id = $1 AND message_id = $2
      RETURNING ${MESSAGE_SELECT}
    `,
    [requestId, messageId, seenValue]
  );
  return rows[0] ?? null;
};
