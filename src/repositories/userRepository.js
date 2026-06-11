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

export const findAllUsers = async () => {
  return sql.query(`SELECT ${USER_SELECT} FROM users ORDER BY user_id DESC`);
};

export const findUserById = async (id) => {
  const rows = await sql.query(`SELECT ${USER_SELECT} FROM users WHERE user_id = $1`, [id]);
  return rows[0] ?? null;
};

export const insertUser = async ({
  user_name,
  password_hash,
  full_name,
  user_phone,
  user_email,
  avatar_url,
  user_role,
  is_active,
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
        user_role,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::user_role_enum, 'user'::user_role_enum), $8)
      RETURNING ${USER_SELECT}
    `,
    [
      user_name,
      password_hash,
      full_name ?? null,
      user_phone,
      user_email ?? null,
      avatar_url ?? null,
      user_role ?? null,
      is_active ?? true,
    ]
  );
  return rows[0];
};

export const updateUserById = async (
  id,
  {
    user_name,
    password_hash,
    full_name,
    user_phone,
    user_email,
    avatar_url,
    user_role,
    is_active,
  }
) => {
  const rows = await sql.query(
    `
      UPDATE users
      SET
        user_name = COALESCE($1, user_name),
        password_hash = COALESCE($2, password_hash),
        full_name = COALESCE($3, full_name),
        user_phone = COALESCE($4, user_phone),
        user_email = COALESCE($5, user_email),
        avatar_url = COALESCE($6, avatar_url),
        user_role = COALESCE($7::user_role_enum, user_role),
        is_active = COALESCE($8, is_active)
      WHERE user_id = $9
      RETURNING ${USER_SELECT}
    `,
    [
      user_name ?? null,
      password_hash ?? null,
      full_name ?? null,
      user_phone ?? null,
      user_email ?? null,
      avatar_url ?? null,
      user_role ?? null,
      typeof is_active === "boolean" ? is_active : null,
      id,
    ]
  );
  return rows[0] ?? null;
};

export const deleteUserById = async (id) => {
  const rows = await sql.query(`DELETE FROM users WHERE user_id = $1 RETURNING ${USER_SELECT}`, [id]);
  return rows[0] ?? null;
};
