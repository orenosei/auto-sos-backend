import { requestExists } from "../repositories/entityRepository.js";
import {
  findRequestMessages,
  insertRequestMessage,
  updateMessageSeen,
} from "../repositories/requestMessageRepository.js";

const MESSAGE_SENDERS = new Set(["user", "company"]);

const isValidMessageSender = (value) =>
  typeof value === "string" && MESSAGE_SENDERS.has(value);

export const getRequestMessages = async (req, res) => {
  const { id } = req.params;

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const rows = await findRequestMessages(id);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching messages for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addRequestMessage = async (req, res) => {
  const { id } = req.params;
  const { message_sender, message_content, is_seen } = req.body;

  if (!message_sender || !message_content) {
    return res.status(400).json({
      error: "Missing required fields: message_sender, message_content",
    });
  }

  if (!isValidMessageSender(message_sender)) {
    return res.status(400).json({
      error: "message_sender must be one of: user, company",
    });
  }

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const created = await insertRequestMessage(id, {
      message_sender,
      message_content,
      is_seen,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error(`Error adding message for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const markMessageSeen = async (req, res) => {
  const { id, message_id } = req.params;
  const { is_seen } = req.body;

  const seenValue = typeof is_seen === "boolean" ? is_seen : true;

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const updated = await updateMessageSeen(id, message_id, seenValue);

    if (!updated) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error(`Error marking message ${message_id} seen for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
