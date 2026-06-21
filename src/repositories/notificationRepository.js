import { sql } from "../config/db.js";

export const insertNotification = async ({
  recipientType,
  recipientId,
  requestId,
  title,
  message,
  type,
}) => {
  await sql.query(
    `
      INSERT INTO notifications (
        recipient_type,
        recipient_id,
        request_id,
        title,
        message,
        notification_type
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [recipientType, recipientId, requestId ?? null, title, message, type ?? null]
  );
};

export const findActiveAdminUserIds = async () => {
  return sql.query("SELECT user_id FROM users WHERE user_role = 'admin' AND is_active = true");
};

export const findNotifications = async ({ recipientType, recipientId, limit }) => {
  return sql.query(
    `
      SELECT
        n.notification_id,
        n.recipient_type,
        n.recipient_id,
        n.request_id,
        n.title,
        n.message,
        n.notification_type,
        n.is_read,
        n.created_at,
        r.priority AS request_priority
      FROM notifications n
      LEFT JOIN requests r ON r.request_id = n.request_id
      WHERE n.recipient_type = $1 AND n.recipient_id = $2
      ORDER BY n.created_at DESC
      LIMIT $3
    `,
    [recipientType, recipientId, limit]
  );
};

export const markNotificationReadById = async (id) => {
  const rows = await sql.query(
    `
      UPDATE notifications
      SET is_read = true
      WHERE notification_id = $1
      RETURNING notification_id, recipient_type, recipient_id, request_id, title, message, notification_type, is_read, created_at
    `,
    [id]
  );
  return rows[0] ?? null;
};
