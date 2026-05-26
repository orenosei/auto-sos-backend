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
  avatar_url,
  rescue_area,
  company_license,
  verification_document_urls,
  is_verified,
  registered_at
`;

// Qualified version for use inside SELECT queries that join other tables
const COMPANY_SELECT_QUALIFIED = `
  companies.company_id,
  companies.company_name,
  companies.relative_address,
  ST_AsGeoJSON(companies.absolute_address::geometry) as absolute_address,
  companies.company_phone,
  companies.avatar_url,
  companies.rescue_area,
  companies.company_license,
  companies.verification_document_urls,
  companies.is_verified,
  companies.registered_at
`;

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await sql.query(
      `
        SELECT
          ${COMPANY_SELECT_QUALIFIED},
          COALESCE(r.avg_rating, NULL) AS average_rating,
          COALESCE(r.count_reviews, NULL) AS review_count,
          COALESCE(resp.avg_response_minutes, NULL) AS avg_response_minutes,
          COALESCE(svc.services, '[]'::json) AS services
        FROM companies
        LEFT JOIN (
          SELECT req.company_id,
                 COUNT(*)::int AS count_reviews,
                 ROUND(AVG(r.review_rating)::numeric,2) AS avg_rating
          FROM reviews r
          JOIN requests req ON req.request_id = r.request_id
          GROUP BY req.company_id
        ) r ON r.company_id = companies.company_id
        LEFT JOIN (
          SELECT req.company_id,
                 ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(req.arrived_at, req.completed_at) - req.accepted_at))/60)::numeric,0) AS avg_response_minutes
          FROM requests req
          WHERE req.accepted_at IS NOT NULL AND (req.arrived_at IS NOT NULL OR req.completed_at IS NOT NULL)
          GROUP BY req.company_id
        ) resp ON resp.company_id = companies.company_id
        LEFT JOIN (
          SELECT cs.company_id,
                 json_agg(json_build_object(
                   'service_id', s.service_id,
                   'service_name', s.service_name,
                   'service_description', s.service_description,
                   'service_price', cs.service_price
                 ) ORDER BY s.service_name) AS services
          FROM company_services cs
          JOIN services s ON s.service_id = cs.service_id
          GROUP BY cs.company_id
        ) svc ON svc.company_id = companies.company_id
        ORDER BY companies.company_id DESC
      `
    );

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
      `
        SELECT
          ${COMPANY_SELECT_QUALIFIED},
          COALESCE(r.avg_rating, NULL) AS average_rating,
          COALESCE(r.count_reviews, NULL) AS review_count,
          COALESCE(resp.avg_response_minutes, NULL) AS avg_response_minutes,
          COALESCE(svc.services, '[]'::json) AS services
        FROM companies
        LEFT JOIN (
          SELECT req.company_id,
                 COUNT(*)::int AS count_reviews,
                 ROUND(AVG(r.review_rating)::numeric,2) AS avg_rating
          FROM reviews r
          JOIN requests req ON req.request_id = r.request_id
          GROUP BY req.company_id
        ) r ON r.company_id = companies.company_id
        LEFT JOIN (
          SELECT req.company_id,
                 ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(req.arrived_at, req.completed_at) - req.accepted_at))/60)::numeric,0) AS avg_response_minutes
          FROM requests req
          WHERE req.accepted_at IS NOT NULL AND (req.arrived_at IS NOT NULL OR req.completed_at IS NOT NULL)
          GROUP BY req.company_id
        ) resp ON resp.company_id = companies.company_id
        LEFT JOIN (
          SELECT cs.company_id,
                 json_agg(json_build_object(
                   'service_id', s.service_id,
                   'service_name', s.service_name,
                   'service_description', s.service_description,
                   'service_price', cs.service_price
                 ) ORDER BY s.service_name) AS services
          FROM company_services cs
          JOIN services s ON s.service_id = cs.service_id
          GROUP BY cs.company_id
        ) svc ON svc.company_id = companies.company_id
        WHERE companies.company_id = $1
        LIMIT 1
      `,
      [id]
    );

    if (company.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

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
    avatar_url,
    rescue_area,
    company_license,
    verification_document_urls,
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
          avatar_url,
          rescue_area,
          company_license,
          verification_document_urls,
          is_verified
        )
        VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, $8, COALESCE($9::text[], ARRAY[]::text[]), $10)
        RETURNING ${COMPANY_SELECT}
      `,
      [
        company_name,
        password_hash,
        relative_address ?? null,
        geogText,
        company_phone,
        avatar_url ?? null,
        rescue_area ?? null,
        company_license ?? null,
        Array.isArray(verification_document_urls) ? verification_document_urls : [],
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
    avatar_url,
    rescue_area,
    company_license,
    verification_document_urls,
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
          avatar_url = COALESCE($6, avatar_url),
          rescue_area = COALESCE($7, rescue_area),
          company_license = COALESCE($8, company_license),
          verification_document_urls = COALESCE($9::text[], verification_document_urls),
          is_verified = COALESCE($10, is_verified)
        WHERE company_id = $11
        RETURNING ${COMPANY_SELECT}
      `,
      [
        company_name ?? null,
        password_hash ?? null,
        relative_address ?? null,
        geogText,
        company_phone ?? null,
        avatar_url ?? null,
        rescue_area ?? null,
        company_license ?? null,
        Array.isArray(verification_document_urls) ? verification_document_urls : null,
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
          ${COMPANY_SELECT_QUALIFIED},
          COALESCE(r.avg_rating, NULL) AS average_rating,
          COALESCE(r.count_reviews, NULL) AS review_count,
          COALESCE(resp.avg_response_minutes, NULL) AS avg_response_minutes,
          ST_DistanceSphere(
            absolute_address::geometry,
            ST_MakePoint($1, $2)
          ) / 1000.0 AS distance_km,
          COALESCE(svc.services, '[]'::json) AS services
        FROM companies
        LEFT JOIN (
          SELECT req.company_id,
                 COUNT(*)::int AS count_reviews,
                 ROUND(AVG(r.review_rating)::numeric,2) AS avg_rating
          FROM reviews r
          JOIN requests req ON req.request_id = r.request_id
          GROUP BY req.company_id
        ) r ON r.company_id = companies.company_id
        LEFT JOIN (
          SELECT req.company_id,
                 ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(req.arrived_at, req.completed_at) - req.accepted_at))/60)::numeric,0) AS avg_response_minutes
          FROM requests req
          WHERE req.accepted_at IS NOT NULL AND (req.arrived_at IS NOT NULL OR req.completed_at IS NOT NULL)
          GROUP BY req.company_id
        ) resp ON resp.company_id = companies.company_id
        LEFT JOIN (
          SELECT cs.company_id,
                 json_agg(json_build_object(
                   'service_id', s.service_id,
                   'service_name', s.service_name,
                   'service_description', s.service_description,
                   'service_price', cs.service_price
                 ) ORDER BY s.service_name) AS services
          FROM company_services cs
          JOIN services s ON s.service_id = cs.service_id
          GROUP BY cs.company_id
        ) svc ON svc.company_id = companies.company_id
        WHERE ST_DWithin(
          absolute_address::geography,
          ST_MakePoint($1, $2)::geography,
          $3
        )
        ORDER BY distance_km ASC
      `,
      [lon, lat, radius * 1000]
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

// Batch ratings for a list of company ids
export const getCompaniesRatings = async (req, res) => {
  const { ids } = req.query; // expected comma separated ids: ids=1,2,3
  if (!ids) return res.status(400).json({ error: 'Missing query param: ids' });
  const idArr = ids.split(',').map((s) => s.trim()).filter(Boolean).map((v) => Number(v)).filter(Number.isFinite);
  if (idArr.length === 0) return res.status(400).json({ error: 'No valid ids provided' });

  try {
    const rows = await sql.query(
      `
        SELECT req.company_id::int AS company_id,
               COUNT(r.review_id)::int AS review_count,
               COALESCE(ROUND(AVG(r.review_rating)::numeric,2),0) AS average_rating
        FROM requests req
        LEFT JOIN reviews r ON r.request_id = req.request_id
        WHERE req.company_id = ANY($1::int[])
        GROUP BY req.company_id
      `,
      [idArr]
    );

    // build map
    const map = {};
    rows.forEach((row) => {
      map[String(row.company_id)] = { average_rating: Number(row.average_rating), review_count: Number(row.review_count) };
    });

    res.status(200).json({ success: true, data: map });
  } catch (error) {
    console.error('Error fetching batch company ratings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
