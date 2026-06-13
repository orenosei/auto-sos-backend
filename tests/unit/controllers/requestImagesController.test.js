import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockResponse } from "../../helpers/http.js";

const entityRepository = vi.hoisted(() => ({
  requestExists: vi.fn(),
}));

const requestImageRepository = vi.hoisted(() => ({
  deleteRequestImageById: vi.fn(),
  findRequestImages: vi.fn(),
  insertRequestImage: vi.fn(),
}));

vi.mock("../../../src/repositories/entityRepository.js", () => entityRepository);
vi.mock("../../../src/repositories/requestImageRepository.js", () => requestImageRepository);

const {
  addRequestImage,
  deleteRequestImage,
  getCloudinarySignature,
  getRequestImages,
} = await import("../../../src/controllers/requestImagesController.js");

describe("requestImagesController", () => {
  const cloudinaryEnv = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    entityRepository.requestExists.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = cloudinaryEnv.cloudName;
    process.env.CLOUDINARY_API_KEY = cloudinaryEnv.apiKey;
    process.env.CLOUDINARY_API_SECRET = cloudinaryEnv.apiSecret;
  });

  it("requires Cloudinary configuration", async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    const res = createMockResponse();

    await getCloudinarySignature({ body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("builds a signature for allowed folders and falls back for unknown folders", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-13T10:00:00.000Z"));
    const res = createMockResponse();

    await getCloudinarySignature({ body: { folder: "rescuesos/avatars" } }, res);

    const timestamp = Math.floor(new Date("2026-06-13T10:00:00.000Z").getTime() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`folder=rescuesos/avatars&timestamp=${timestamp}secret`)
      .digest("hex");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        cloudName: "demo",
        apiKey: "key",
        timestamp,
        folder: "rescuesos/avatars",
        signature,
      },
    });

    vi.useRealTimers();
  });

  it("lists, adds, and deletes request images", async () => {
    const rows = [{ image_id: 1 }];
    const created = { image_id: 2 };
    const deleted = { image_id: 2 };
    requestImageRepository.findRequestImages.mockResolvedValue(rows);
    requestImageRepository.insertRequestImage.mockResolvedValue(created);
    requestImageRepository.deleteRequestImageById.mockResolvedValue(deleted);

    const listRes = createMockResponse();
    await getRequestImages({ params: { id: "10" } }, listRes);

    const addRes = createMockResponse();
    await addRequestImage({ params: { id: "10" }, body: { image_url: "https://img" } }, addRes);

    const deleteRes = createMockResponse();
    await deleteRequestImage({ params: { id: "10", image_id: "2" } }, deleteRes);

    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(addRes.status).toHaveBeenCalledWith(201);
    expect(deleteRes.status).toHaveBeenCalledWith(200);
  });

  it("validates image_url and missing delete targets", async () => {
    const addRes = createMockResponse();
    await addRequestImage({ params: { id: "10" }, body: {} }, addRes);

    requestImageRepository.deleteRequestImageById.mockResolvedValue(null);
    const deleteRes = createMockResponse();
    await deleteRequestImage({ params: { id: "10", image_id: "2" } }, deleteRes);

    expect(addRes.status).toHaveBeenCalledWith(400);
    expect(deleteRes.status).toHaveBeenCalledWith(404);
  });
});
