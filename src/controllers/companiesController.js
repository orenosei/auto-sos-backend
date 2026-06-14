import bcrypt from "bcryptjs";

import {
  deleteCompanyById,
  findAllCompanies,
  findCompanyById,
  findCompanyPasswordById,
  findCompanyRatingsByIds,
  findNearbyCompanies,
  insertCompany,
  updateCompanyById,
  updateCompanyPasswordHash,
} from "../repositories/companyRepository.js";
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
