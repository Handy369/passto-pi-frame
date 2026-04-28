import fs from "node:fs/promises";
import path from "node:path";

export interface StoredRunIndexRecord {
  runId: string;
  createdAt?: string;
  updatedAt?: string;
  status?: "completed" | "failed" | "unknown";
}

export async function readRunIndex(rootDir: string): Promise<StoredRunIndexRecord[]> {
  const filePath = path.join(rootDir, "run-index.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as StoredRunIndexRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeRunIndex(rootDir: string, records: StoredRunIndexRecord[]): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true });
  const filePath = path.join(rootDir, "run-index.json");
  await fs.writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf-8");
}

export async function updateRunIndex(rootDir: string, record: StoredRunIndexRecord): Promise<void> {
  const records = await readRunIndex(rootDir);
  const next = records.filter((item) => item.runId !== record.runId);
  next.push(record);
  next.sort((a, b) => a.runId.localeCompare(b.runId));
  await writeRunIndex(rootDir, next);
}
