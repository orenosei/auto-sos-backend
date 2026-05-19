import express from 'express';
import { getNotifications, markNotificationRead } from '../controllers/notificationsController.js';

const router = express.Router();

// GET /notifications?recipient_type=...&recipient_id=...
router.get('/', getNotifications);

// PUT /notifications/:id/read
router.put('/:id/read', markNotificationRead);

export default router;
