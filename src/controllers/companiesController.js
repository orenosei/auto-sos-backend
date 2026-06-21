import bcrypt from "bcryptjs";

import {
  deleteCompanyById,
  findAllCompanies,
  findCompanyById,
  findCompanyCandidates,
  findCompanyPasswordById,
  findCompanyRatingsByIds,
  findNearbyCompanies,
  findCompanyReports,
  insertCompany,
  insertCompanyReport,
  updateCompanyById,
  updateCompanyReportStatusById,
  updateCompanyPasswordHash,
} from "../repositories/companyRepository.js";
import { companyExists, userExists } from "../repositories/entityRepository.js";
import { createAdminNotifications } from "../services/notificationService.js";
import { toGeogText } from "../utils/geo.js";

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await findAllCompanies();
    res.status(200).json({ success: true, data: companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompanyById = async (req, res) => {
  const { id } = req.params;
  try {
    const company = await findCompanyById(id);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({ success: true, data: company });
  } catch (error) {
    console.error(`Error fetching company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCompany = async (req, res) => {
  const { company_name, password_hash, absolute_address, company_phone } = req.body;

  const geogText = toGeogText(absolute_address);
  if (!company_name || !password_hash || !company_phone || !geogText) {
    return res.status(400).json({
      error:
        "Missing required fields: company_name, password_hash, company_phone, absolute_address",
    });
  }

  try {
    const newCompany = await insertCompany({ ...req.body, geogText });
    console.log("Created company:", newCompany);
    res.status(201).json({ success: true, data: newCompany });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCompany = async (req, res) => {
  const { id } = req.params;
  const geogText = toGeogText(req.body.absolute_address);

  try {
    const updatedCompany = await updateCompanyById(id, { ...req.body, geogText });
    if (!updatedCompany) {
      return res.status(404).json({ error: "Company not found" });
    }
    console.log("Updated company:", updatedCompany);
    res.status(200).json({ success: true, data: updatedCompany });
  } catch (error) {
    console.error(`Error updating company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const changeCompanyPassword = async (req, res) => {
  const { id } = req.params;
  const currentPassword = req.body.current_password ?? req.body.currentPassword;
  const newPassword = req.body.new_password ?? req.body.newPassword;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới",
    });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({
      error: "Mật khẩu mới phải có ít nhất 6 ký tự",
    });
  }

  try {
    const company = await findCompanyPasswordById(id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const ok = await bcrypt.compare(currentPassword, company.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updated = await updateCompanyPasswordHash(id, password_hash);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error changing password for company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteCompany = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCompany = await deleteCompanyById(id);
    if (!deletedCompany) {
      return res.status(404).json({ error: "Company not found" });
    }
    console.log("Deleted company:", deletedCompany);
    res.status(200).json({ success: true, data: deletedCompany });
  } catch (error) {
    console.error(`Error deleting company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getNearbyCompanies = async (req, res) => {
  const { latitude, longitude, radiusKm = 10 } = req.query;

  if (latitude == null || longitude == null) {
    return res.status(400).json({
      error: "Missing required query params: latitude, longitude",
    });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const radius = parseFloat(radiusKm);

  if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(radius)) {
    return res.status(400).json({
      error: "Invalid parameters: latitude, longitude, and radiusKm must be numbers",
    });
  }

  if (radius <= 0) {
    return res.status(400).json({
      error: "radiusKm must be greater than 0",
    });
  }

  try {
    const companies = await findNearbyCompanies({
      longitude: lon,
      latitude: lat,
      radiusMeters: radius * 1000,
    });

    res.status(200).json({
      success: true,
      data: companies,
      userLocation: { latitude: lat, longitude: lon },
      radiusKm: radius,
    });
  } catch (error) {
    console.error("Error fetching nearby companies:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompaniesRatings = async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: "Missing query param: ids" });

  const idArr = ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((v) => Number(v))
    .filter(Number.isFinite);

  if (idArr.length === 0) return res.status(400).json({ error: "No valid ids provided" });

  try {
    const rows = await findCompanyRatingsByIds(idArr);
    const map = {};
    rows.forEach((row) => {
      map[String(row.company_id)] = {
        average_rating: Number(row.average_rating),
        review_count: Number(row.review_count),
      };
    });

    res.status(200).json({ success: true, data: map });
  } catch (error) {
    console.error("Error fetching batch company ratings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCompanyReport = async (req, res) => {
  const { id } = req.params;
  const reporterUserId = req.body?.reporter_user_id ?? req.body?.user_id;
  const reason = String(req.body?.reason ?? "").trim();

  if (!reporterUserId || !reason) {
    return res.status(400).json({
      error: "Missing required fields: reporter_user_id, reason",
    });
  }

  try {
    if (!(await companyExists(id))) {
      return res.status(404).json({ error: "Company not found" });
    }
    if (!(await userExists(reporterUserId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const created = await insertCompanyReport({
      companyId: id,
      reporterUserId,
      reason,
    });

    await createAdminNotifications({
      title: "Có báo cáo công ty mới",
      message: `Người dùng đã báo cáo công ty #${id}.\nLý do: ${reason}`,
      type: "company_report",
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        error: "Bạn đã có một báo cáo đang chờ xử lý cho công ty này.",
      });
    }
    console.error(`Error reporting company ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompanyReports = async (req, res) => {
  const status = String(req.query?.status ?? "").trim();
  if (status && !["pending", "reviewed", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Invalid report status" });
  }

  try {
    const rows = await findCompanyReports({ status });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching company reports:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCompanyReportStatus = async (req, res) => {
  const status = String(req.body?.status ?? "").trim();
  if (!["pending", "reviewed", "dismissed"].includes(status)) {
    return res.status(400).json({
      error: "status must be pending, reviewed, or dismissed",
    });
  }

  try {
    const updated = await updateCompanyReportStatusById(req.params.reportId, status);
    if (!updated) return res.status(404).json({ error: "Report not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error updating company report ${req.params.reportId}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const normalizeCriterion = (value, min, max, higherIsBetter = false) => {
  if (max === min) return 1;
  const normalized = (value - min) / (max - min);
  return higherIsBetter ? normalized : 1 - normalized;
};

export const recommendCompany = async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const serviceId = Number(req.body.service_id);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(serviceId)
  ) {
    return res.status(400).json({
      error: "latitude, longitude and service_id are required",
    });
  }

  try {
    const candidates = await findCompanyCandidates({
      latitude,
      longitude,
      serviceId,
    });

    if (candidates.length === 0) {
      return res.status(404).json({
        error: "Không có công ty đã xác minh cung cấp dịch vụ này",
      });
    }

    const numeric = candidates.map((row) => ({
      ...row,
      distance_km: Number(row.distance_km),
      avg_response_minutes: Number(row.avg_response_minutes),
      average_rating: Number(row.average_rating),
      service_price: Number(row.service_price),
    }));
    const range = (key) => ({
      min: Math.min(...numeric.map((row) => row[key])),
      max: Math.max(...numeric.map((row) => row[key])),
    });
    const ranges = {
      distance_km: range("distance_km"),
      avg_response_minutes: range("avg_response_minutes"),
      average_rating: range("average_rating"),
      service_price: range("service_price"),
    };

    const ranked = numeric
      .map((row) => {
        const distance = normalizeCriterion(
          row.distance_km,
          ranges.distance_km.min,
          ranges.distance_km.max
        );
        const response = normalizeCriterion(
          row.avg_response_minutes,
          ranges.avg_response_minutes.min,
          ranges.avg_response_minutes.max
        );
        const rating = normalizeCriterion(
          row.average_rating,
          ranges.average_rating.min,
          ranges.average_rating.max,
          true
        );
        const price = normalizeCriterion(
          row.service_price,
          ranges.service_price.min,
          ranges.service_price.max
        );
        const score =
          distance * 0.35 + response * 0.25 + rating * 0.25 + price * 0.15;

        return {
          ...row,
          score: Number(score.toFixed(4)),
          score_breakdown: { distance, response, rating, price },
        };
      })
      .sort((a, b) => b.score - a.score);

    res.status(200).json({
      success: true,
      data: ranked[0],
      alternatives: ranked.slice(1, 4),
      weights: {
        distance: 0.35,
        response: 0.25,
        rating: 0.25,
        price: 0.15,
      },
    });
  } catch (error) {
    console.error("Error recommending company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
