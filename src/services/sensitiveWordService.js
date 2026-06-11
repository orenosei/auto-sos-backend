import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SENSITIVE_WORDS_FILE = path.resolve(__dirname, "../config/sensitive_words.txt");

const readSensitiveWords = async () => {
  try {
    const raw = await fs.readFile(SENSITIVE_WORDS_FILE, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

export const findSensitiveWords = async (...parts) => {
  const words = await readSensitiveWords();
  if (words.length === 0) return [];

  const content = parts.join(" ").toLocaleLowerCase("vi-VN");
  return words.filter((word) => content.includes(word.toLocaleLowerCase("vi-VN")));
};
