import { beforeEach, describe, expect, it, vi } from "vitest";

const fsPromises = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: fsPromises,
  ...fsPromises,
}));

const { findSensitiveWords } = await import("../../../src/services/sensitiveWordService.js");

describe("sensitiveWordService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores comments and blank lines when reading sensitive words", async () => {
    fsPromises.readFile.mockResolvedValue(`
# comment

cấm
Nguy Hiểm
`);

    const result = await findSensitiveWords("Nội dung này rất nguy hiểm");

    expect(fsPromises.readFile).toHaveBeenCalledWith(
      expect.stringContaining("sensitive_words.txt"),
      "utf8"
    );
    expect(result).toEqual(["Nguy Hiểm"]);
  });

  it("finds words case-insensitively across multiple content parts", async () => {
    fsPromises.readFile.mockResolvedValue("CẤM\nspam");

    const result = await findSensitiveWords("Bài viết", "co spam và nội dung cấm");

    expect(result).toEqual(["CẤM", "spam"]);
  });

  it("returns an empty list when the configured file has no words", async () => {
    fsPromises.readFile.mockResolvedValue("# only comments\n\n");

    await expect(findSensitiveWords("anything")).resolves.toEqual([]);
  });

  it("returns an empty list when the configured file is missing", async () => {
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });
    fsPromises.readFile.mockRejectedValue(error);

    await expect(findSensitiveWords("anything")).resolves.toEqual([]);
  });

  it("rethrows unexpected file read errors", async () => {
    const error = Object.assign(new Error("permission denied"), { code: "EACCES" });
    fsPromises.readFile.mockRejectedValue(error);

    await expect(findSensitiveWords("anything")).rejects.toBe(error);
  });
});
