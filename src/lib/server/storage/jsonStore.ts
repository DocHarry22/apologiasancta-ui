import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");

export class JsonStore<T> {
  private readonly filePath: string;

  constructor(fileName: string, private readonly fallback: T) {
    this.filePath = path.join(DATA_DIR, fileName);
  }

  async read(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "ENOENT") return structuredClone(this.fallback);
      throw error;
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

