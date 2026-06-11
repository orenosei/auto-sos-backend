import crypto from "node:crypto";

import { requestExists } from "../repositories/entityRepository.js";
import {
  deleteRequestImageById,
  findRequestImages,
  insertRequestImage,
} from "../repositories/requestImageRepository.js";

const CLOUDINARY_UPLOAD_FOLDER = "rescuesos/requests";
const ALLOWED_UPLOAD_FOLDERS = new Set([
  "rescuesos/requests",
  "rescuesos/community",
  "rescuesos/avatars",
  "rescuesos/company-documents",
]);

const buildCloudinarySignature = (params, apiSecret) => {
  const baseString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(baseString + apiSecret).digest("hex");
};

export const getCloudinarySignature = async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: "Missing Cloudinary configuration" });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const requestedFolder =
    typeof req.body?.folder === "string" ? req.body.folder : CLOUDINARY_UPLOAD_FOLDER;
  const folder = ALLOWED_UPLOAD_FOLDERS.has(requestedFolder)
    ? requestedFolder
    : CLOUDINARY_UPLOAD_FOLDER;
  const signature = buildCloudinarySignature({ folder, timestamp }, apiSecret);

  return res.status(200).json({
    success: true,
    data: {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
    },
  });
};

export const getRequestImages = async (req, res) => {
  const { id } = req.params;

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const rows = await findRequestImages(id);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching images for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addRequestImage = async (req, res) => {
  const { id } = req.params;
  const { image_url } = req.body;

  if (!image_url) {
    return res.status(400).json({ error: "Missing required field: image_url" });
  }

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const created = await insertRequestImage(id, image_url);

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error(`Error adding image for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteRequestImage = async (req, res) => {
  const { id, image_id } = req.params;

  try {
    const requestOk = await requestExists(id);
    if (!requestOk) {
      return res.status(404).json({ error: "Request not found" });
    }

    const deleted = await deleteRequestImageById(id, image_id);

    if (!deleted) {
      return res.status(404).json({ error: "Request image not found" });
    }

    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error(`Error deleting image ${image_id} for request ${id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
