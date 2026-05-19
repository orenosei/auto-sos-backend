import { sql } from "../config/db.js";

const isDbTimeoutError = (error) => {
  return (
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    String(error?.message ?? "").includes("fetch failed")
  );
};

export const getNotifications = async (req, res) => {
  const { recipient_type, recipient_id, limit } = req.query;

  if (!recipient_type || !recipient_id) {
    return res.status(400).json({ error: 'Missing required query params: recipient_type, recipient_id' });
  }

  const max = Math.min(parseInt(limit) || 100, 1000);

  try {
    const rows = await sql.query(
      `
        SELECT notification_id, recipient_type, recipient_id, request_id, title, message, notification_type, is_read, created_at
        FROM notifications
        WHERE recipient_type = $1 AND recipient_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [recipient_type, recipient_id, max]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn("Notifications DB timeout, returning empty list to keep UI responsive");
      return res.status(200).json({ success: true, data: [] });
    }

    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await sql.query(
      `
        UPDATE notifications
        SET is_read = true
        WHERE notification_id = $1
        RETURNING notification_id, recipient_type, recipient_id, request_id, title, message, notification_type, is_read, created_at
      `,
      [id]
    );

    if (updated.length === 0) return res.status(404).json({ error: 'Notification not found' });

    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
