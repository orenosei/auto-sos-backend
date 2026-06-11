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
      registered_at: row.registered_at,
    };

    res.status(200).json({ success: true, role: "company", data: company });
  } catch (error) {
    console.error("Error logging in company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
