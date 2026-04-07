import { sql } from "../config/db.js";

const USER_SELECT = `
  user_id,
  user_name,
  full_name,
  user_phone,
  user_email,
  avatar_url,
  is_active,
  registered_at
`;

export const getAllUsers = async (req, res) => {
  try {
    const users = await sql.query(`SELECT ${USER_SELECT} FROM users ORDER BY user_id DESC`);
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const users = await sql.query(`SELECT ${USER_SELECT} FROM users WHERE user_id = $1`, [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ success: true, data: users[0] });
  } catch (error) {
    console.error(`Error fetching user with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createUser = async (req, res) => {
  const {
    user_name,
    password_hash,
    full_name,
    user_phone,
    user_email,
    avatar_url,
    is_active,
  } = req.body;

  if (!user_name || !password_hash || !user_phone) {
    return res.status(400).json({
      error: "Missing required fields: user_name, password_hash, user_phone",
    });
  }

  try {
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
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${USER_SELECT}
      `,
      [
        user_name,
        password_hash,
        full_name ?? null,
        user_phone,
        user_email ?? null,
        avatar_url ?? null,
        is_active ?? true,
      ]
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    user_name,
    password_hash,
    full_name,
    user_phone,
    user_email,
    avatar_url,
    is_active,
  } = req.body;

  try {
    const updated = await sql.query(
      `
        UPDATE users
        SET
          user_name = COALESCE($1, user_name),
          password_hash = COALESCE($2, password_hash),
          full_name = COALESCE($3, full_name),
          user_phone = COALESCE($4, user_phone),
          user_email = COALESCE($5, user_email),
          avatar_url = COALESCE($6, avatar_url),
          is_active = COALESCE($7, is_active)
        WHERE user_id = $8
        RETURNING ${USER_SELECT}
      `,
      [
        user_name ?? null,
        password_hash ?? null,
        full_name ?? null,
        user_phone ?? null,
        user_email ?? null,
        avatar_url ?? null,
        typeof is_active === "boolean" ? is_active : null,
        id,
      ]
    );

    if (updated.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    console.error(`Error updating user with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await sql.query(
      `DELETE FROM users WHERE user_id = $1 RETURNING ${USER_SELECT}`,
      [id]
    );

    if (deleted.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error(`Error deleting user with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
