#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  createSkeletonByKind,
  validateByKind,
} from "./runtime-contracts.mjs";

function usage() {
  console.error([
    "Usage:",
    "  node ./scripts/runtime-state-skeleton.mjs init <kind> [output]",
    "  node ./scripts/runtime-state-skeleton.mjs validate <kind> <input>",
    "",
    "Kinds:",
    "  shared-state",
    "  transform-output",
    "  validation-result",
    "  next-round-decision",
  ].join("\n"));
}

async function main() {
  const [, , command, kind, targetPath] = process.argv;
  if (!command || !kind) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === "init") {
    const payload = createSkeletonByKind(kind);
    const outputPath = targetPath ? path.resolve(targetPath) : path.resolve(process.cwd(), `${kind}.json`);
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ok: true, command, kind, outputPath }, null, 2));
    return;
  }

  if (command === "validate") {
    if (!targetPath) {
      usage();
      process.exitCode = 1;
      return;
    }
    const inputPath = path.resolve(targetPath);
    const raw = await readFile(inputPath, "utf8");
    const value = JSON.parse(raw);
    const result = validateByKind(kind, value);
    console.log(JSON.stringify({ kind, inputPath, ...result }, null, 2));
    if (!result.ok) process.exitCode = 2;
    return;
  }

  usage();
  process.exitCode = 1;
}

const entryHref = process.argv[1] ? new URL(`file://${path.resolve(process.argv[1])}`).href : null;
if (entryHref && import.meta.url === entryHref) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
