import { sql } from "../config/db.js";

//CRUD cho companies

const toGeogText = (absoluteAddress) => {
  if (absoluteAddress == null) return null;

  if (typeof absoluteAddress === "string") {
    const trimmed = absoluteAddress.trim();
    if (trimmed.length === 0) return null;
    if (/^SRID=/i.test(trimmed)) return trimmed;
    if (/^POINT\s*\(/i.test(trimmed)) return `SRID=4326;${trimmed}`;
    return trimmed;
  }

  if (typeof absoluteAddress === "object") {
    const lat = absoluteAddress.lat ?? absoluteAddress.latitude;
    const lng = absoluteAddress.lng ?? absoluteAddress.lon ?? absoluteAddress.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      return `SRID=4326;POINT(${lng} ${lat})`;
    }
  }

  return null;
};

const COMPANY_SELECT = `
  company_id,
  company_name,
  relative_address,
  ST_AsGeoJSON(absolute_address::geometry) as absolute_address,
  company_phone,
  rescue_area,
  company_license,
  is_verified,
  registered_at
`;

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await sql.query(
      `SELECT ${COMPANY_SELECT} FROM companies ORDER BY company_id DESC`
    );
    console.log("Fetched companies:", companies);
    res.status(200).json({ success: true, data: companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompanyById = async (req, res) => {
  const { id } = req.params;
  try {
    const company = await sql.query(
      `SELECT ${COMPANY_SELECT} FROM companies WHERE company_id = $1`,
      [id]
    );
    if (company.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }
    console.log("Fetched company:", company[0]);
    res.status(200).json({ success: true, data: company[0] });
  } catch (error) {
    console.error(`Error fetching company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCompany = async (req, res) => {
  const {
    company_name,
    password_hash,
    relative_address,
    absolute_address,
    company_phone,
    rescue_area,
    company_license,
    is_verified,
  } = req.body;

  const geogText = toGeogText(absolute_address);
  if (!company_name || !password_hash || !company_phone || !geogText) {
    return res.status(400).json({
      error:
        "Missing required fields: company_name, password_hash, company_phone, absolute_address",
    });
  }

  try {
    const newCompany = await sql.query(
      `
        INSERT INTO companies (
          company_name,
          password_hash,
          relative_address,
          absolute_address,
          company_phone,
          rescue_area,
          company_license,
          is_verified
        )
        VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, $8)
        RETURNING ${COMPANY_SELECT}
      `,
      [
        company_name,
        password_hash,
        relative_address ?? null,
        geogText,
        company_phone,
        rescue_area ?? null,
        company_license ?? null,
        is_verified ?? false,
      ]
    );
    console.log("Created company:", newCompany[0]);
    res.status(201).json({ success: true, data: newCompany[0] });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCompany = async (req, res) => {
  const { id } = req.params;
  const {
    company_name,
    password_hash,
    relative_address,
    absolute_address,
    company_phone,
    rescue_area,
    company_license,
    is_verified,
  } = req.body;

  const geogText = toGeogText(absolute_address);
  try {
    const updatedCompany = await sql.query(
      `
        UPDATE companies
        SET
          company_name = COALESCE($1, company_name),
          password_hash = COALESCE($2, password_hash),
          relative_address = COALESCE($3, relative_address),
          absolute_address = COALESCE(ST_GeogFromText($4), absolute_address),
          company_phone = COALESCE($5, company_phone),
          rescue_area = COALESCE($6, rescue_area),
          company_license = COALESCE($7, company_license),
          is_verified = COALESCE($8, is_verified)
        WHERE company_id = $9
        RETURNING ${COMPANY_SELECT}
      `,
      [
        company_name ?? null,
        password_hash ?? null,
        relative_address ?? null,
        geogText,
        company_phone ?? null,
        rescue_area ?? null,
        company_license ?? null,
        is_verified ?? null,
        id,
      ]
    );
    if (updatedCompany.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }
    console.log("Updated company:", updatedCompany[0]);
    res.status(200).json({ success: true, data: updatedCompany[0] });
  } catch (error) {
    console.error(`Error updating company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteCompany = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCompany = await sql.query(
      `DELETE FROM companies WHERE company_id = $1 RETURNING ${COMPANY_SELECT}`,
      [id]
    );
    if (deletedCompany.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }
    console.log("Deleted company:", deletedCompany[0]);
    res.status(200).json({ success: true, data: deletedCompany[0] });
  } catch (error) {
    console.error(`Error deleting company with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Lấy danh sách công ty gần nhất dựa trên vị trí GPS
 * Query params: latitude, longitude, radiusKm (tùy chọn, mặc định 10km)
 */
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

  if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
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
    const companies = await sql.query(
      `
        SELECT 
          ${COMPANY_SELECT},
          ST_DistanceSphere(
            absolute_address::geometry,
            ST_GeomFromText('POINT(${lon} ${lat})', 4326)
          ) / 1000.0 as distance_km
        FROM companies
        WHERE ST_DWithin(
          absolute_address::geography,
          ST_GeogFromText('SRID=4326;POINT(${lon} ${lat})'),
          ${radius * 1000}
        )
        ORDER BY distance_km ASC
      `
    );

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