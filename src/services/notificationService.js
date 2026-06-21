import {
  findActiveAdminUserIds,
  insertNotification,
} from "../repositories/notificationRepository.js";

const formatVietnamDateTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

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

const detailLine = (label, value) => {
  const text = String(value ?? "").trim();
  return text ? `${label}: ${text}` : null;
};

export const getRequestStatusNotification = (status, request = {}) => {
  const labels = {
    accepted: ["Yêu cầu đã được tiếp nhận", "Công ty cứu hộ đã tiếp nhận yêu cầu của bạn."],
    heading: ["Xe cứu hộ đang di chuyển", "Đơn vị cứu hộ đang trên đường đến vị trí của bạn."],
    arrived: ["Cứu hộ đã đến nơi", "Đơn vị cứu hộ đã đến hiện trường."],
    processing: ["Đang xử lý sự cố", "Đơn vị cứu hộ đang xử lý sự cố của bạn."],
    completed: ["Yêu cầu đã hoàn tất", "Dịch vụ cứu hộ đã được đánh dấu hoàn tất."],
    cancelled: ["Yêu cầu đã hủy", "Yêu cầu cứu hộ đã được hủy."],
  };

  const base = labels[status];
  if (!base) return null;

  const details = [
    detailLine("Mã yêu cầu", request.request_id ? `#${request.request_id}` : ""),
    detailLine("Sự cố", request.issue_type || request.request_description),
    detailLine("Địa điểm", request.relative_location),
    status === "accepted" || status === "heading"
      ? detailLine(
          "Dự kiến đến",
          request.estimated_arrival
            ? formatVietnamDateTime(request.estimated_arrival)
            : ""
        )
      : null,
    status === "completed" && request.final_price != null
      ? detailLine("Chi phí", `${Number(request.final_price).toLocaleString("vi-VN")}đ`)
      : null,
    status === "cancelled"
      ? detailLine("Lý do", request.cancel_reason)
      : null,
  ].filter(Boolean);

  return [base[0], [base[1], ...details].join("\n")];
};
