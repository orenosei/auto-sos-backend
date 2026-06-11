import {
  findActiveAdminUserIds,
  insertNotification,
} from "../repositories/notificationRepository.js";

export const createNotification = async ({
  recipientType,
  recipientId,
  requestId,
  title,
  message,
  type,
}) => {
  if (!recipientType || recipientId == null || !title || !message) return;

  try {
    await insertNotification({ recipientType, recipientId, requestId, title, message, type });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

export const createAdminNotifications = async ({ title, message, type }) => {
  try {
    const admins = await findActiveAdminUserIds();
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          recipientType: "user",
          recipientId: admin.user_id,
          title,
          message,
          type,
        })
      )
    );
  } catch (error) {
    console.error("Error creating admin notification:", error);
  }
};

export const getRequestStatusNotification = (status) => {
  const labels = {
    accepted: ["Yêu cầu đã được tiếp nhận", "Công ty cứu hộ đã tiếp nhận yêu cầu của bạn."],
    heading: ["Xe cứu hộ đang di chuyển", "Đơn vị cứu hộ đang trên đường đến vị trí của bạn."],
    arrived: ["Cứu hộ đã đến nơi", "Đơn vị cứu hộ đã đến hiện trường."],
    processing: ["Đang xử lý sự cố", "Đơn vị cứu hộ đang xử lý sự cố của bạn."],
    completed: ["Yêu cầu đã hoàn tất", "Dịch vụ cứu hộ đã được đánh dấu hoàn tất."],
    cancelled: ["Yêu cầu đã hủy", "Yêu cầu cứu hộ đã được hủy."],
  };

  return labels[status] ?? null;
};
