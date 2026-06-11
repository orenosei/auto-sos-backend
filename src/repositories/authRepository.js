import { sql } from "../config/db.js";

const USER_SELECT = `
  user_id,
  user_name,
  full_name,
  user_phone,
  user_email,
  avatar_url,
  user_role,
  is_active,
  registered_at
`;

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

export const findExistingUserRegistration = async ({ user_name, user_phone, user_email }) => {
  const rows = await sql.query(
    `
      SELECT user_id FROM users
      WHERE user_name = $1 OR user_phone = $2 OR ($3::text IS NOT NULL AND user_email = $3)
      LIMIT 1
    `,
    [user_name, user_phone, user_email ?? null]
  );
  return rows[0] ?? null;
};

export const insertRegisteredUser = async ({
  user_name,
  password_hash,
  full_name,
  user_phone,
  user_email,
  avatar_url,
}) => {
  const rows = await sql.query(
    `
      INSERT INTO users (
        user_name,
        password_hash,
        full_name,
        user_phone,
        user_email,
        avatar_url,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING ${USER_SELECT}
    `,
    [
      user_name,
      password_hash,
      full_name ?? null,
      user_phone,
      user_email ?? null,
      avatar_url ?? null,
    ]
  );
  return rows[0];
};

export const findUserAuthByIdentifier = async (identifier) => {
  const rows = await sql.query(
    `
      SELECT user_id, password_hash, ${USER_SELECT}
      FROM users
      WHERE user_name = $1 OR user_phone = $1 OR user_email = $1
      LIMIT 1
    `,
    [identifier]
  );
  return rows[0] ?? null;
};

export const findExistingCompanyRegistration = async ({ company_name, company_phone }) => {
  const rows = await sql.query(
    `
      SELECT company_id FROM companies
      WHERE company_name = $1 OR company_phone = $2
      LIMIT 1
    `,
    [company_name, company_phone]
  );
  return rows[0] ?? null;
};

export const insertRegisteredCompany = async ({
  company_name,
  password_hash,
  relative_address,
  geogText,
  company_phone,
  avatar_url,
  rescue_area,
  company_license,
  verification_document_urls,
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
      VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, $8, COALESCE($9::text[], ARRAY[]::text[]), FALSE)
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
    ]
  );
  return rows[0];
};

export const findCompanyAuthByIdentifier = async (identifier) => {
  const rows = await sql.query(
    `
      SELECT company_id, password_hash, ${COMPANY_SELECT}
      FROM companies
      WHERE company_name = $1 OR company_phone = $1
      LIMIT 1
    `,
    [identifier]
  );
  return rows[0] ?? null;
};
