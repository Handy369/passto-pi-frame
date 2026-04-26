import * as fs from "node:fs";
import * as path from "node:path";

export interface RuntimeProfileSummary {
  name: string;
  description: string;
  filePath: string;
}

const RUNTIME_AGENTS_DIR = path.resolve(
  process.cwd(),
  "../../lib/passto-agent-runtime/agents",
);

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = match?.[1] ?? "";
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return meta;
}

export function listRuntimeProfileSummaries(): RuntimeProfileSummary[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(RUNTIME_AGENTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const filePath = path.join(RUNTIME_AGENTS_DIR, entry.name);
      const raw = fs.readFileSync(filePath, "utf-8");
      const meta = parseFrontmatter(raw);
      return {
        name: meta.name || path.basename(entry.name, ".md"),
        description: meta.description || "(no description)",
        filePath,
      };
    })
    .filter((profile) => profile.description !== "(no description)");
}

export function formatRuntimeProfilesForPrompt(
  profiles: RuntimeProfileSummary[],
): string {
  if (profiles.length === 0) {
    return "- No runtime profiles were discovered.";
  }
  return profiles
    .map(
      (profile) =>
        `- **${profile.name}**: ${profile.description} (${profile.filePath})`,
    )
    .join("\n");
}
