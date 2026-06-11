import {
  findNotifications,
  markNotificationReadById,
} from "../repositories/notificationRepository.js";
import { isDbTimeoutError } from "../utils/dbErrors.js";

export const getNotifications = async (req, res) => {
  const { recipient_type, recipient_id, limit } = req.query;

  if (!recipient_type || !recipient_id) {
    return res.status(400).json({ error: 'Missing required query params: recipient_type, recipient_id' });
  }

  const max = Math.min(parseInt(limit) || 100, 1000);

  try {
    const rows = await findNotifications({
      recipientType: recipient_type,
      recipientId: recipient_id,
      limit: max,
    });

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
    const updated = await markNotificationReadById(id);

    if (!updated) return res.status(404).json({ error: 'Notification not found' });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
