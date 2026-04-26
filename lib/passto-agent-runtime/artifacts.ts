import * as fs from "node:fs";
import * as path from "node:path";
import type { ArtifactItem, ArtifactManifest, ArtifactUrlStrategy } from "./types.ts";

export function createArtifactManifest(runId: string, producer: string, items: ArtifactItem[] = []): ArtifactManifest {
  return {
    runId,
    createdAt: new Date().toISOString(),
    producer,
    items: [...items],
  };
}

export function addArtifactItem(manifest: ArtifactManifest, item: ArtifactItem): ArtifactManifest {
  manifest.items.push(item);
  return manifest;
}

export function writeArtifactManifest(filePath: string, manifest: ArtifactManifest): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

export function readArtifactManifest(filePath: string): ArtifactManifest {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ArtifactManifest;
}

export function resolveArtifactUrl(item: ArtifactItem, strategy: ArtifactUrlStrategy): string | undefined {
  switch (strategy.type) {
    case "none":
      return undefined;
    case "file":
      return `file://${item.path}`;
    case "local-server": {
      const base = strategy.baseUrl.replace(/\/+$/, "");
      const normalized = item.path.startsWith("/") ? item.path : `/${item.path}`;
      return `${base}${normalized}`;
    }
    case "custom":
      return strategy.resolve(item);
  }
}

export function resolveArtifactLinks(manifest: ArtifactManifest, strategy: ArtifactUrlStrategy): Array<ArtifactItem & { url?: string }> {
  return manifest.items.map((item) => ({ ...item, url: resolveArtifactUrl(item, strategy) }));
}
