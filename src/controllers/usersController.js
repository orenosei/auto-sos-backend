import {
  deleteUserById,
  findAllUsers,
  findUserById,
  insertUser,
  updateUserById,
} from "../repositories/userRepository.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await findAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error(`Error fetching user with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createUser = async (req, res) => {
  const { user_name, password_hash, user_phone } = req.body;

  if (!user_name || !password_hash || !user_phone) {
    return res.status(400).json({
      error: "Missing required fields: user_name, password_hash, user_phone",
    });
  }

  try {
    const created = await insertUser(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await updateUserById(id, req.body);

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error updating user with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deleteUserById(id);

    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(`Error deleting user with id ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
