import { sql } from "../config/db.js";

const REQUEST_SELECT = `
  request_id,
  user_id,
  company_id,
  vehicle_id,
  ST_AsGeoJSON(absolute_location::geometry) as absolute_location,
  relative_location,
  request_description,
  issue_type,
  priority,
  request_status,
  created_at,
  estimated_arrival,
  accepted_at,
  heading_at,
  arrived_at,
  actual_arrival,
  completed_at,
  cancelled_at,
  cancelled_by,
  cancel_reason,
  final_price,
  user_confirmed_at
`;

const REQUEST_STATUSES = new Set([
  "pending",
  "accepted",
  "heading",
  "arrived",
  "processing",
  "completed",
  "cancelled",
]);

const isValidRequestStatus = (value) =>
  typeof value === "string" && REQUEST_STATUSES.has(value);

const toGeogPointText = (absoluteLocation) => {
  if (absoluteLocation == null) return null;

  if (typeof absoluteLocation === "string") {
    const trimmed = absoluteLocation.trim();
    if (trimmed.length === 0) return null;
    if (/^SRID=/i.test(trimmed)) return trimmed;
    if (/^POINT\s*\(/i.test(trimmed)) return `SRID=4326;${trimmed}`;
    return trimmed;
  }

  if (typeof absoluteLocation === "object") {
    const lat = absoluteLocation.lat ?? absoluteLocation.latitude;
    const lng =
      absoluteLocation.lng ??
      absoluteLocation.lon ??
      absoluteLocation.longitude;

    if (typeof lat === "number" && typeof lng === "number") {
      return `SRID=4326;POINT(${lng} ${lat})`;
    }
  }

  return null;
};

const ensureUserExists = async (userId) => {
  const rows = await sql.query("SELECT 1 FROM users WHERE user_id = $1 LIMIT 1", [
    userId,
  ]);
  return rows.length > 0;
};

const ensureCompanyExists = async (companyId) => {
  const rows = await sql.query(
    "SELECT 1 FROM companies WHERE company_id = $1 LIMIT 1",
    [companyId]
  );
  return rows.length > 0;
};

const ensureVehicleExists = async (vehicleId) => {
  const rows = await sql.query(
    "SELECT 1 FROM rescue_vehicles WHERE vehicle_id = $1 LIMIT 1",
    [vehicleId]
  );
  return rows.length > 0;
};

const ensureVehicleBelongsToCompany = async (vehicleId, companyId) => {
  const rows = await sql.query(
    `
      SELECT 1
      FROM rescue_vehicles
      WHERE vehicle_id = $1 AND company_id = $2
      LIMIT 1
    `,
    [vehicleId, companyId]
  );
  return rows.length > 0;
};

const getRequestRow = async (requestId) => {
  const rows = await sql.query(
    `SELECT ${REQUEST_SELECT} FROM requests WHERE request_id = $1 LIMIT 1`,
    [requestId]
  );
  return rows[0] ?? null;
};

const toEstimatedArrival = (estimatedArrival, etaMinutes) => {
  if (estimatedArrival) return estimatedArrival;

  const minutes = Number(etaMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  return new Date(Date.now() + Math.round(minutes) * 60 * 1000).toISOString();
};

const createNotification = async ({ recipientType, recipientId, requestId, title, message, type }) => {
  if (!recipientType || recipientId == null || !title || !message) return;

  try {
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
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

const getStatusNotification = (status) => {
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

const syncVehicleStatus = async (oldRequest, newRequest) => {
  const oldVehicleId = oldRequest?.vehicle_id;
  const newVehicleId = newRequest?.vehicle_id;

  if (oldVehicleId && oldVehicleId !== newVehicleId) {
    await sql.query(
      `
        UPDATE rescue_vehicles
        SET vehicle_status = 'available'
        WHERE vehicle_id = $1 AND vehicle_status = 'busy'
      `,
      [oldVehicleId]
    );
  }

  if (!newVehicleId) return;

  if (["accepted", "heading", "arrived", "processing"].includes(newRequest.request_status)) {
    await sql.query(
      `
        UPDATE rescue_vehicles
        SET vehicle_status = 'busy'
        WHERE vehicle_id = $1
      `,
      [newVehicleId]
    );
  }

  if (["completed", "cancelled"].includes(newRequest.request_status)) {
    await sql.query(
      `
        UPDATE rescue_vehicles
        SET vehicle_status = 'available'
        WHERE vehicle_id = $1 AND vehicle_status = 'busy'
      `,
      [newVehicleId]
    );
  }
};

export const getRequests = async (req, res) => {
  const { user_id, company_id, request_status } = req.query;

  if (!user_id && !company_id) {
    return res.status(400).json({
      error: "Missing required query param: user_id or company_id",
    });
  }

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id) {
      const userOk = await ensureUserExists(user_id);
      if (!userOk) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (company_id) {
      const companyOk = await ensureCompanyExists(company_id);
      if (!companyOk) {
        return res.status(404).json({ error: "Company not found" });
      }
    }

    const where = [];
    const values = [];

    if (user_id) {
      values.push(user_id);
      where.push(`user_id = $${values.length}`);
    }

    if (company_id) {
      values.push(company_id);
      where.push(`company_id = $${values.length}`);
    }

    if (request_status) {
      values.push(request_status);
      where.push(`request_status = $${values.length}::request_status_enum`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await sql.query(
      `
        SELECT ${REQUEST_SELECT}
        FROM requests
        ${whereSql}
        ORDER BY created_at DESC, request_id DESC
      `,
      values
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await sql.query(
      `SELECT ${REQUEST_SELECT} FROM requests WHERE request_id = $1 LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(`Error fetching request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createRequest = async (req, res) => {
  const {
    user_id,
    company_id,
    vehicle_id,
    absolute_location,
    relative_location,
    request_description,
    issue_type,
    priority,
    request_status,
    estimated_arrival,
    eta_minutes,
    actual_arrival,
    completed_at,
    service_id,
    service_quantity,
    service_price,
  } = req.body;

  const geogText = toGeogPointText(absolute_location);
  if (!geogText) {
    return res.status(400).json({
      error: "Missing or invalid required field: absolute_location",
    });
  }

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id != null) {
      const userOk = await ensureUserExists(user_id);
      if (!userOk) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (company_id != null) {
      const companyOk = await ensureCompanyExists(company_id);
      if (!companyOk) {
        return res.status(404).json({ error: "Company not found" });
      }
    }

    if (vehicle_id != null) {
      const vehicleOk = await ensureVehicleExists(vehicle_id);
      if (!vehicleOk) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
    }

    let lockedServicePrice = service_price ?? null;
    if (service_id != null && company_id != null && lockedServicePrice == null) {
      const priceRows = await sql.query(
        `
          SELECT service_price
          FROM company_services
          WHERE company_id = $1 AND service_id = $2
          LIMIT 1
        `,
        [company_id, service_id]
      );

      if (priceRows.length === 0) {
        return res.status(400).json({
          error: "Selected company does not provide this service",
        });
      }

      lockedServicePrice = priceRows[0].service_price;
    }

    const estimatedArrivalValue = toEstimatedArrival(estimated_arrival, eta_minutes);

    const created = await sql.query(
      `
        INSERT INTO requests (
          user_id,
          company_id,
          vehicle_id,
          absolute_location,
          relative_location,
          request_description,
          issue_type,
          priority,
          request_status,
          estimated_arrival,
          actual_arrival,
          completed_at
        )
        VALUES (
          $1,
          $2,
          $3,
          ST_GeogFromText($4),
          $5,
          $6,
          $7,
          COALESCE($8, 'normal'),
          COALESCE($9::request_status_enum, 'pending'::request_status_enum),
          $10,
          $11,
          $12
        )
        RETURNING ${REQUEST_SELECT}
      `,
      [
        user_id ?? null,
        company_id ?? null,
        vehicle_id ?? null,
        geogText,
        relative_location ?? null,
        request_description ?? null,
        issue_type ?? null,
        priority ?? null,
        request_status ?? null,
        estimatedArrivalValue,
        actual_arrival ?? null,
        completed_at ?? null,
      ]
    );

    if (service_id != null) {
      await sql.query(
        `
          INSERT INTO request_services (
            request_id,
            service_id,
            service_quantity,
            service_price
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (request_id, service_id)
          DO UPDATE SET
            service_quantity = EXCLUDED.service_quantity,
            service_price = EXCLUDED.service_price
        `,
        [
          created[0].request_id,
          service_id,
          service_quantity ?? 1,
          lockedServicePrice ?? 0,
        ]
      );
    }

    await sql.query(
      `
        INSERT INTO request_status_history (
          request_id,
          old_status,
          new_status,
          changed_by,
          note
        )
        VALUES ($1, NULL, $2::request_status_enum, $3, $4)
      `,
      [
        created[0].request_id,
        created[0].request_status,
        user_id != null ? "user" : "system",
        "Request created",
      ]
    );

    if (created[0].company_id != null) {
      await createNotification({
        recipientType: "company",
        recipientId: created[0].company_id,
        requestId: created[0].request_id,
        title: "Yêu cầu cứu hộ mới",
        message: "Bạn có một yêu cầu cứu hộ mới cần tiếp nhận.",
        type: "request_created",
      });
    }

    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateRequest = async (req, res) => {
  const { id } = req.params;
  const {
    user_id,
    company_id,
    vehicle_id,
    absolute_location,
    relative_location,
    request_description,
    issue_type,
    priority,
    request_status,
    estimated_arrival,
    eta_minutes,
    actual_arrival,
    completed_at,
    cancelled_by,
    cancel_reason,
    final_price,
    user_confirmed_at,
    changed_by,
    note,
  } = req.body;

  const geogText = toGeogPointText(absolute_location);

  if (request_status != null && !isValidRequestStatus(request_status)) {
    return res.status(400).json({
      error:
        "request_status must be one of: pending, accepted, heading, arrived, processing, completed, cancelled",
    });
  }

  try {
    if (user_id != null) {
      const userOk = await ensureUserExists(user_id);
      if (!userOk) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (company_id != null) {
      const companyOk = await ensureCompanyExists(company_id);
      if (!companyOk) {
        return res.status(404).json({ error: "Company not found" });
      }
    }

    const current = await getRequestRow(id);
    if (!current) {
      return res.status(404).json({ error: "Request not found" });
    }

    const nextCompanyId = company_id ?? current.company_id;

    if (vehicle_id != null) {
      const vehicleOk = nextCompanyId != null
        ? await ensureVehicleBelongsToCompany(vehicle_id, nextCompanyId)
        : await ensureVehicleExists(vehicle_id);
      if (!vehicleOk) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
    }

    const estimatedArrivalValue = toEstimatedArrival(estimated_arrival, eta_minutes);
    const acceptedAt = request_status === "accepted" ? new Date().toISOString() : null;
    const headingAt = request_status === "heading" ? new Date().toISOString() : null;
    const arrivedAt = request_status === "arrived" ? new Date().toISOString() : null;
    const actualArrivalValue =
      request_status === "arrived" ? new Date().toISOString() : actual_arrival ?? null;
    const completedAtValue =
      request_status === "completed" ? new Date().toISOString() : completed_at ?? null;
    const cancelledAt = request_status === "cancelled" ? new Date().toISOString() : null;

    const updated = await sql.query(
      `
        UPDATE requests
        SET
          user_id = COALESCE($1, user_id),
          company_id = COALESCE($2, company_id),
          vehicle_id = COALESCE($3, vehicle_id),
          absolute_location = COALESCE(
            CASE
              WHEN $4::text IS NULL THEN NULL
              ELSE ST_GeogFromText($4)
            END,
            absolute_location
          ),
          relative_location = COALESCE($5, relative_location),
          request_description = COALESCE($6, request_description),
          issue_type = COALESCE($7, issue_type),
          priority = COALESCE($8, priority),
          request_status = COALESCE($9::request_status_enum, request_status),
          estimated_arrival = COALESCE($10, estimated_arrival),
          accepted_at = COALESCE($11, accepted_at),
          heading_at = COALESCE($12, heading_at),
          arrived_at = COALESCE($13, arrived_at),
          actual_arrival = COALESCE($14, actual_arrival),
          completed_at = COALESCE($15, completed_at),
          cancelled_at = COALESCE($16, cancelled_at),
          cancelled_by = COALESCE($17, cancelled_by),
          cancel_reason = COALESCE($18, cancel_reason),
          final_price = COALESCE($19, final_price),
          user_confirmed_at = COALESCE($20, user_confirmed_at)
        WHERE request_id = $21
        RETURNING ${REQUEST_SELECT}
      `,
      [
        user_id ?? null,
        company_id ?? null,
        vehicle_id ?? null,
        geogText,
        relative_location ?? null,
        request_description ?? null,
        issue_type ?? null,
        priority ?? null,
        request_status ?? null,
        estimatedArrivalValue,
        acceptedAt,
        headingAt,
        arrivedAt,
        actualArrivalValue,
        completedAtValue,
        cancelledAt,
        cancelled_by ?? null,
        cancel_reason ?? null,
        final_price ?? null,
        user_confirmed_at ?? null,
        id,
      ]
    );

    const next = updated[0];

    if (request_status != null && current.request_status !== next.request_status) {
      await sql.query(
        `
          INSERT INTO request_status_history (
            request_id,
            old_status,
            new_status,
            changed_by,
            note
          )
          VALUES ($1, $2::request_status_enum, $3::request_status_enum, $4, $5)
        `,
        [
          id,
          current.request_status,
          next.request_status,
          changed_by ?? cancelled_by ?? "system",
          note ?? null,
        ]
      );

      const notification = getStatusNotification(next.request_status);
      if (notification && next.user_id != null) {
        await createNotification({
          recipientType: "user",
          recipientId: next.user_id,
          requestId: next.request_id,
          title: notification[0],
          message: notification[1],
          type: `request_${next.request_status}`,
        });
      }
    }

    await syncVehicleStatus(current, next);

    res.status(200).json({ success: true, data: next });
  } catch (error) {
    console.error(`Error updating request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await sql.query(
      `DELETE FROM requests WHERE request_id = $1 RETURNING ${REQUEST_SELECT}`,
      [id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(`Error deleting request with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
