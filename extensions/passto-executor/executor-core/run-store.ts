import fs from "node:fs/promises";
import path from "node:path";
import { readRunIndex, updateRunIndex } from "./store/run-index.ts";
import type { ExecutorInvocation } from "./invocation.ts";
import type { ExecutorRunResult } from "./result.ts";
import type { ExecutorEvent } from "./events.ts";
import type { ResolvedExecutorRunContext } from "./context.ts";

export interface ExecutorRunManifest {
  runId: string;
  invocation: ExecutorInvocation;
  perspective: string;
  workspace: ResolvedExecutorRunContext["workspace"];
  runtimePolicy: ResolvedExecutorRunContext["runtimePolicy"];
  createdAt: string;
}

export interface StoredExecutorEventRecord {
  runId: string;
  event: ExecutorEvent;
  recordedAt: string;
}

export interface StoredExecutorResult {
  runId: string;
  status: ExecutorRunResult["status"];
  summaryText: string;
  usage: ExecutorRunResult["usage"];
  contract?: ExecutorRunResult["contract"];
  failure?: ExecutorRunResult["failure"];
  updatedAt: string;
}

export interface StoredExecutorFailure {
  runId: string;
  status: "failed";
  summaryText: string;
  usage: ExecutorRunResult["usage"];
  contract?: ExecutorRunResult["contract"];
  failure?: ExecutorRunResult["failure"];
  updatedAt: string;
}

export interface ExecutorRunStore {
  createRun(runId: string, manifest: ExecutorRunManifest): Promise<void>;
  appendEvent(runId: string, event: ExecutorEvent): Promise<void>;
  writeResult(runId: string, result: StoredExecutorResult): Promise<void>;
  writeFailure(runId: string, failure: StoredExecutorFailure): Promise<void>;
  getRunManifest?(runId: string): Promise<ExecutorRunManifest | undefined>;
  getRunEvents?(runId: string): Promise<StoredExecutorEventRecord[]>;
  getRunResult?(runId: string): Promise<StoredExecutorResult | StoredExecutorFailure | undefined>;
  listRuns?(): Promise<{ runId: string; createdAt?: string }[]>;
  getRunStatuses?(): Promise<Array<{ runId: string; status: "completed" | "failed" | "unknown"; updatedAt?: string }>>;
}

export interface InMemoryRunStoreSnapshot {
  manifests: Map<string, ExecutorRunManifest>;
  events: Map<string, StoredExecutorEventRecord[]>;
  results: Map<string, StoredExecutorResult>;
  failures: Map<string, StoredExecutorFailure>;
}

export class InMemoryExecutorRunStore implements ExecutorRunStore {
  private manifests = new Map<string, ExecutorRunManifest>();
  private events = new Map<string, StoredExecutorEventRecord[]>();
  private results = new Map<string, StoredExecutorResult>();
  private failures = new Map<string, StoredExecutorFailure>();

  async createRun(runId: string, manifest: ExecutorRunManifest): Promise<void> {
    this.manifests.set(runId, manifest);
  }

  async appendEvent(runId: string, event: ExecutorEvent): Promise<void> {
    const list = this.events.get(runId) ?? [];
    list.push({ runId, event, recordedAt: new Date().toISOString() });
    this.events.set(runId, list);
  }

  async writeResult(runId: string, result: StoredExecutorResult): Promise<void> {
    this.results.set(runId, result);
  }

  async writeFailure(runId: string, failure: StoredExecutorFailure): Promise<void> {
    this.failures.set(runId, failure);
  }

  async getRunManifest(runId: string): Promise<ExecutorRunManifest | undefined> {
    return this.manifests.get(runId);
  }

  async getRunEvents(runId: string): Promise<StoredExecutorEventRecord[]> {
    return [...(this.events.get(runId) ?? [])];
  }

  async getRunResult(runId: string): Promise<StoredExecutorResult | StoredExecutorFailure | undefined> {
    return this.results.get(runId) ?? this.failures.get(runId);
  }

  async listRuns(): Promise<{ runId: string; createdAt?: string }[]> {
    return Array.from(this.manifests.values()).map((manifest) => ({ runId: manifest.runId, createdAt: manifest.createdAt }));
  }

  async getRunStatuses(): Promise<Array<{ runId: string; status: "completed" | "failed" | "unknown"; updatedAt?: string }>> {
    const runIds = new Set([...this.manifests.keys(), ...this.results.keys(), ...this.failures.keys()]);
    return Array.from(runIds).sort().map((runId) => {
      const result = this.results.get(runId);
      if (result) return { runId, status: "completed" as const, updatedAt: result.updatedAt };
      const failure = this.failures.get(runId);
      if (failure) return { runId, status: "failed" as const, updatedAt: failure.updatedAt };
      return { runId, status: "unknown" as const, updatedAt: this.manifests.get(runId)?.createdAt };
    });
  }

  getSnapshot(): InMemoryRunStoreSnapshot {
    return {
      manifests: new Map(this.manifests),
      events: new Map(Array.from(this.events.entries(), ([key, value]) => [key, value.map((item) => ({ ...item }))])),
      results: new Map(this.results),
      failures: new Map(this.failures),
    };
  }
}

export interface FileExecutorRunStoreOptions {
  rootDir: string;
}

export function getProjectPasstoAiDir(projectRoot: string): string {
  return path.join(projectRoot, ".passto-ai");
}

export function getExecutorWorkspaceRoot(projectRoot: string): string {
  return path.join(getProjectPasstoAiDir(projectRoot), "executor");
}

export class FileExecutorRunStore implements ExecutorRunStore {
  private options: FileExecutorRunStoreOptions;

  constructor(options: FileExecutorRunStoreOptions) {
    this.options = options;
  }

  private getRunDir(runId: string): string {
    return path.join(this.options.rootDir, runId);
  }

  private async ensureRunDir(runId: string): Promise<string> {
    const dir = this.getRunDir(runId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async createRun(runId: string, manifest: ExecutorRunManifest): Promise<void> {
    const dir = await this.ensureRunDir(runId);
    await fs.writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    await updateRunIndex(this.options.rootDir, { runId, createdAt: manifest.createdAt, status: "unknown", updatedAt: manifest.createdAt });
  }

  async appendEvent(runId: string, event: ExecutorEvent): Promise<void> {
    const dir = await this.ensureRunDir(runId);
    const record: StoredExecutorEventRecord = { runId, event, recordedAt: new Date().toISOString() };
    await fs.appendFile(path.join(dir, "events.jsonl"), `${JSON.stringify(record)}\n`, "utf-8");
  }

  async writeResult(runId: string, result: StoredExecutorResult): Promise<void> {
    const dir = await this.ensureRunDir(runId);
    await fs.writeFile(path.join(dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf-8");
    const manifest = await this.getRunManifest(runId);
    await updateRunIndex(this.options.rootDir, { runId, createdAt: manifest?.createdAt, status: "completed", updatedAt: result.updatedAt });
  }

  async writeFailure(runId: string, failure: StoredExecutorFailure): Promise<void> {
    const dir = await this.ensureRunDir(runId);
    await fs.writeFile(path.join(dir, "failure.json"), `${JSON.stringify(failure, null, 2)}\n`, "utf-8");
    const manifest = await this.getRunManifest(runId);
    await updateRunIndex(this.options.rootDir, { runId, createdAt: manifest?.createdAt, status: "failed", updatedAt: failure.updatedAt });
  }

  async getRunManifest(runId: string): Promise<ExecutorRunManifest | undefined> {
    return this.readJsonFile<ExecutorRunManifest>(path.join(this.getRunDir(runId), "manifest.json"));
  }

  async getRunEvents(runId: string): Promise<StoredExecutorEventRecord[]> {
    const filePath = path.join(this.getRunDir(runId), "events.jsonl");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as StoredExecutorEventRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async getRunResult(runId: string): Promise<StoredExecutorResult | StoredExecutorFailure | undefined> {
    return (await this.readJsonFile<StoredExecutorResult>(path.join(this.getRunDir(runId), "result.json")))
      ?? (await this.readJsonFile<StoredExecutorFailure>(path.join(this.getRunDir(runId), "failure.json")));
  }

  async listRuns(): Promise<{ runId: string; createdAt?: string }[]> {
    const index = await readRunIndex(this.options.rootDir);
    if (index.length > 0) return index.map((item) => ({ runId: item.runId, createdAt: item.createdAt }));

    try {
      const entries = await fs.readdir(this.options.rootDir, { withFileTypes: true });
      const runIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
      const manifests = await Promise.all(runIds.map(async (runId) => ({ runId, manifest: await this.getRunManifest(runId) })));
      return manifests.map(({ runId, manifest }) => ({ runId, createdAt: manifest?.createdAt }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async getRunStatuses(): Promise<Array<{ runId: string; status: "completed" | "failed" | "unknown"; updatedAt?: string }>> {
    const index = await readRunIndex(this.options.rootDir);
    if (index.length > 0) {
      return index.map((item) => ({ runId: item.runId, status: item.status ?? "unknown", updatedAt: item.updatedAt }));
    }

    const runs = await this.listRuns();
    return Promise.all(runs.map(async ({ runId, createdAt }) => {
      const result = await this.getRunResult(runId);
      if (!result) return { runId, status: "unknown" as const, updatedAt: createdAt };
      return { runId, status: result.status, updatedAt: result.updatedAt };
    }));
  }

  private async readJsonFile<T>(filePath: string): Promise<T | undefined> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}

export function buildRunManifest(params: {
  runId: string;
  invocation: ExecutorInvocation;
  perspective: string;
  workspace: ResolvedExecutorRunContext["workspace"];
  runtimePolicy: ResolvedExecutorRunContext["runtimePolicy"];
}): ExecutorRunManifest {
  return {
    ...params,
    createdAt: new Date().toISOString(),
  };
}

export function resultToStoredRecord(result: ExecutorRunResult): StoredExecutorResult | StoredExecutorFailure {
  const base = {
    runId: result.runId,
    status: result.status,
    summaryText: result.summaryText,
    usage: result.usage,
    contract: result.contract,
    failure: result.failure,
    updatedAt: new Date().toISOString(),
  };

  if (result.status === "failed") {
    return {
      ...base,
      status: "failed",
    } satisfies StoredExecutorFailure;
  }

  return base satisfies StoredExecutorResult;
}
