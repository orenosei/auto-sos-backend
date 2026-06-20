import bcrypt from "bcryptjs";

import {
  findCompanyAuthByIdentifier,
  findExistingCompanyRegistration,
  findExistingUserRegistration,
  findUserAuthByIdentifier,
  insertRegisteredCompany,
  insertRegisteredUser,
} from "../repositories/authRepository.js";
import { toGeogText } from "../utils/geo.js";

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
    const existing = await findExistingUserRegistration({ user_name, user_phone, user_email });

    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await insertRegisteredUser({
      user_name,
      password_hash,
      full_name,
      user_phone,
      user_email,
      avatar_url,
    });
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
    const row = await findUserAuthByIdentifier(identifier);

    if (!row) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

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
    avatar_url,
    rescue_area,
    company_license,
    verification_document_urls,
  } = req.body;

  const geogText = toGeogText(absolute_address);
  if (!company_name || !password || !company_phone || !geogText) {
    return res.status(400).json({
      error:
        "Missing required fields: company_name, password, company_phone, absolute_address",
    });
  }

  try {
    const existing = await findExistingCompanyRegistration({ company_name, company_phone });

    if (existing) {
      return res.status(409).json({ error: "Company already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const company = await insertRegisteredCompany({
      company_name,
      password_hash,
      relative_address,
      geogText,
      company_phone,
      avatar_url,
      rescue_area,
      company_license,
      verification_document_urls,
    });
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
    const row = await findCompanyAuthByIdentifier(identifier);

    if (!row) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!row.is_active) {
      return res.status(403).json({ error: "Công ty đã bị quản trị viên khóa" });
    }

    const company = {
      company_id: row.company_id,
      company_name: row.company_name,
      relative_address: row.relative_address,
      absolute_address: row.absolute_address,
      company_phone: row.company_phone,
      avatar_url: row.avatar_url,
      rescue_area: row.rescue_area,
      company_license: row.company_license,
      verification_document_urls: row.verification_document_urls,
      is_verified: row.is_verified,
      is_active: row.is_active,
      registered_at: row.registered_at,
    };

    res.status(200).json({ success: true, role: "company", data: company });
  } catch (error) {
    console.error("Error logging in company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const loginAccount = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      error: "Missing required fields: identifier, password",
    });
  }

  try {
    const [userRow, companyRow] = await Promise.all([
      findUserAuthByIdentifier(identifier),
      findCompanyAuthByIdentifier(identifier),
    ]);

    if (userRow && userRow.user_role !== "admin") {
      const userPasswordMatches = await bcrypt.compare(password, userRow.password_hash);
      if (userPasswordMatches) {
        if (!userRow.is_active) {
          return res.status(403).json({ error: "Tài khoản đã bị khóa" });
        }

        const user = {
          user_id: userRow.user_id,
          user_name: userRow.user_name,
          full_name: userRow.full_name,
          user_phone: userRow.user_phone,
          user_email: userRow.user_email,
          avatar_url: userRow.avatar_url,
          user_role: userRow.user_role,
          is_active: userRow.is_active,
          registered_at: userRow.registered_at,
        };
        return res.status(200).json({ success: true, role: "user", data: user });
      }
    }

    if (companyRow) {
      const companyPasswordMatches = await bcrypt.compare(password, companyRow.password_hash);
      if (companyPasswordMatches) {
        if (!companyRow.is_active) {
          return res.status(403).json({ error: "Công ty đã bị quản trị viên khóa" });
        }

        const company = {
          company_id: companyRow.company_id,
          company_name: companyRow.company_name,
          relative_address: companyRow.relative_address,
          absolute_address: companyRow.absolute_address,
          company_phone: companyRow.company_phone,
          avatar_url: companyRow.avatar_url,
          rescue_area: companyRow.rescue_area,
          company_license: companyRow.company_license,
          verification_document_urls: companyRow.verification_document_urls,
          is_verified: companyRow.is_verified,
          is_active: companyRow.is_active,
          registered_at: companyRow.registered_at,
        };
        return res.status(200).json({ success: true, role: "company", data: company });
      }
    }

    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" });
  } catch (error) {
    console.error("Error logging in account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const verifyAdminAccess = (req, res) => {
  const code = String(req.body?.code ?? "");
  const configuredCode = process.env.ADMIN_ACCESS_CODE;

  if (!configuredCode) {
    return res.status(503).json({ error: "Chưa cấu hình mã quản trị viên" });
  }

  if (code !== configuredCode) {
    return res.status(401).json({ error: "Mã quản trị viên không đúng" });
  }

  return res.status(200).json({ success: true });
};
