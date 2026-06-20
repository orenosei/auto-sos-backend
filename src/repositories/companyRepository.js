import { sql } from "../config/db.js";

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

const COMPANY_AGGREGATE_JOINS = `
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
`;

export const findAllCompanies = async () => {
  return sql.query(
    `
      SELECT
        ${COMPANY_SELECT_QUALIFIED},
        COALESCE(r.avg_rating, NULL) AS average_rating,
        COALESCE(r.count_reviews, NULL) AS review_count,
        COALESCE(resp.avg_response_minutes, NULL) AS avg_response_minutes,
        COALESCE(svc.services, '[]'::json) AS services
      FROM companies
      ${COMPANY_AGGREGATE_JOINS}
      ORDER BY companies.company_id DESC
    `
  );
};

export const findCompanyById = async (id) => {
  const rows = await sql.query(
    `
      SELECT
        ${COMPANY_SELECT_QUALIFIED},
        COALESCE(r.avg_rating, NULL) AS average_rating,
        COALESCE(r.count_reviews, NULL) AS review_count,
        COALESCE(resp.avg_response_minutes, NULL) AS avg_response_minutes,
        COALESCE(svc.services, '[]'::json) AS services
      FROM companies
      ${COMPANY_AGGREGATE_JOINS}
      WHERE companies.company_id = $1
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ?? null;
};

export const findCompanyPasswordById = async (id) => {
  const rows = await sql.query("SELECT company_id, password_hash FROM companies WHERE company_id = $1", [id]);
  return rows[0] ?? null;
};

export const insertCompany = async ({
  company_name,
  password_hash,
  relative_address,
  geogText,
  company_phone,
  avatar_url,
  rescue_area,
  company_license,
  verification_document_urls,
  is_verified,
}) => {
  const rows = await sql.query(
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
  return rows[0];
};

export const updateCompanyById = async (
  id,
  {
    company_name,
    password_hash,
    relative_address,
    geogText,
    company_phone,
    avatar_url,
    rescue_area,
    company_license,
    verification_document_urls,
    is_verified,
  }
) => {
  const rows = await sql.query(
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
  return rows[0] ?? null;
};

export const deleteCompanyById = async (id) => {
  const rows = await sql.query(
    `DELETE FROM companies WHERE company_id = $1 RETURNING ${COMPANY_SELECT}`,
    [id]
  );
  return rows[0] ?? null;
};

export const updateCompanyPasswordHash = async (id, password_hash) => {
  const rows = await sql.query(
    `
      UPDATE companies
      SET password_hash = $1
      WHERE company_id = $2
      RETURNING ${COMPANY_SELECT}
    `,
    [password_hash, id]
  );
  return rows[0] ?? null;
};

export const findNearbyCompanies = async ({ longitude, latitude, radiusMeters }) => {
  return sql.query(
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
      ${COMPANY_AGGREGATE_JOINS}
      WHERE ST_DWithin(
        absolute_address::geography,
        ST_MakePoint($1, $2)::geography,
        $3
      )
      ORDER BY distance_km ASC
    `,
    [longitude, latitude, radiusMeters]
  );
};

export const findCompanyRatingsByIds = async (ids) => {
  return sql.query(
    `
      SELECT req.company_id::int AS company_id,
             COUNT(r.review_id)::int AS review_count,
             COALESCE(ROUND(AVG(r.review_rating)::numeric,2),0) AS average_rating
      FROM requests req
      LEFT JOIN reviews r ON r.request_id = req.request_id
      WHERE req.company_id = ANY($1::int[])
      GROUP BY req.company_id
    `,
    [ids]
  );
};

export const findCompanyCandidates = async ({
  longitude,
  latitude,
  serviceId,
}) => {
  return sql.query(
    `
      SELECT
        c.company_id,
        c.company_name,
        c.company_phone,
        cs.service_price,
        ST_DistanceSphere(
          c.absolute_address::geometry,
          ST_MakePoint($1, $2)
        ) / 1000.0 AS distance_km,
        COALESCE(r.average_rating, 3) AS average_rating,
        COALESCE(resp.avg_acceptance_minutes, 30) AS avg_response_minutes
      FROM companies c
      JOIN company_services cs
        ON cs.company_id = c.company_id
       AND cs.service_id = $3
      LEFT JOIN (
        SELECT
          req.company_id,
          ROUND(AVG(rv.review_rating)::numeric, 2) AS average_rating
        FROM requests req
        JOIN reviews rv ON rv.request_id = req.request_id
        GROUP BY req.company_id
      ) r ON r.company_id = c.company_id
      LEFT JOIN (
        SELECT
          company_id,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 60)::numeric,
            1
          ) AS avg_acceptance_minutes
        FROM requests
        WHERE accepted_at IS NOT NULL
        GROUP BY company_id
      ) resp ON resp.company_id = c.company_id
      WHERE c.is_verified = TRUE
      ORDER BY distance_km ASC
    `,
    [longitude, latitude, serviceId]
  );
};
