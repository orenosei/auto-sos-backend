import bcrypt from "bcryptjs";

import { sql } from "../config/db.js";

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
  rescue_area,
  company_license,
  is_verified,
  registered_at
`;

export const registerUser = async (req, res) => {
  const {
    user_name,
    password,
    full_name,
    user_phone,
    user_email,
    avatar_url,
  } = req.body;

  if (!user_name || !password || !user_phone) {
    return res.status(400).json({
      error: "Missing required fields: user_name, password, user_phone",
    });
  }

  try {
    const existing = await sql.query(
      `
        SELECT user_id FROM users
        WHERE user_name = $1 OR user_phone = $2 OR ($3::text IS NOT NULL AND user_email = $3)
        LIMIT 1
      `,
      [user_name, user_phone, user_email ?? null]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await sql.query(
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

    const user = created[0];
    res.status(201).json({ success: true, role: "user", data: user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const loginUser = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      error: "Missing required fields: identifier, password",
    });
  }

  try {
    const rows = await sql.query(
      `
        SELECT user_id, password_hash, ${USER_SELECT}
        FROM users
        WHERE user_name = $1 OR user_phone = $1 OR user_email = $1
        LIMIT 1
      `,
      [identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const row = rows[0];
    if (!row.is_active) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = {
      user_id: row.user_id,
      user_name: row.user_name,
      full_name: row.full_name,
      user_phone: row.user_phone,
      user_email: row.user_email,
      avatar_url: row.avatar_url,
      user_role: row.user_role,
      is_active: row.is_active,
      registered_at: row.registered_at,
    };

    res.status(200).json({ success: true, role: row.user_role ?? "user", data: user });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerCompany = async (req, res) => {
  const {
    company_name,
    password,
    relative_address,
    absolute_address,
    company_phone,
    rescue_area,
    company_license,
  } = req.body;

  const geogText = toGeogText(absolute_address);
  if (!company_name || !password || !company_phone || !geogText) {
    return res.status(400).json({
      error:
        "Missing required fields: company_name, password, company_phone, absolute_address",
    });
  }

  try {
    const existing = await sql.query(
      `
        SELECT company_id FROM companies
        WHERE company_name = $1 OR company_phone = $2
        LIMIT 1
      `,
      [company_name, company_phone]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Company already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await sql.query(
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
        VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, FALSE)
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
      ]
    );

    const company = created[0];
    res.status(201).json({ success: true, role: "company", data: company });
  } catch (error) {
    console.error("Error registering company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const loginCompany = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      error: "Missing required fields: identifier, password",
    });
  }

  try {
    const rows = await sql.query(
      `
        SELECT company_id, password_hash, ${COMPANY_SELECT}
        FROM companies
        WHERE company_name = $1 OR company_phone = $1
        LIMIT 1
      `,
      [identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const company = {
      company_id: row.company_id,
      company_name: row.company_name,
      relative_address: row.relative_address,
      absolute_address: row.absolute_address,
      company_phone: row.company_phone,
      rescue_area: row.rescue_area,
      company_license: row.company_license,
      is_verified: row.is_verified,
      registered_at: row.registered_at,
    };

    res.status(200).json({ success: true, role: "company", data: company });
  } catch (error) {
    console.error("Error logging in company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
