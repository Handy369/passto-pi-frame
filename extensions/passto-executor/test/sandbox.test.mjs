import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NoopSandboxManager } from "../executor-core/sandbox.ts";
import { TempCopySandboxManager, toSandboxDebugUrl } from "../executor-core/sandbox/temp-copy-sandbox.ts";

test("NoopSandboxManager returns project-root handle with metadata", async () => {
  const manager = new NoopSandboxManager();
  const handle = await manager.createPerspectiveSandbox({
    runId: "run-noop",
    perspective: "builder",
    projectRoot: "/tmp/project",
    cleanupPolicy: "never",
  });
  assert.equal(handle.root, "/tmp/project");
  assert.equal(handle.metadata.strategy, "noop");
  assert.equal(handle.metadata.cleanupPolicy, "never");
  await handle.cleanup({ success: true });
});

test("TempCopySandboxManager creates isolated copy and cleans it up", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-project-"));
  await fs.writeFile(path.join(projectRoot, "hello.txt"), "hello sandbox\n", "utf-8");

  const manager = new TempCopySandboxManager();
  const handle = await manager.createPerspectiveSandbox({
    runId: "run-copy",
    perspective: "reviewer",
    projectRoot,
  });

  assert.notEqual(handle.root, projectRoot);
  assert.equal(await fs.readFile(path.join(handle.root, "hello.txt"), "utf-8"), "hello sandbox\n");
  assert.equal(handle.metadata.strategy, "temp-copy");
  assert.match(toSandboxDebugUrl(handle.root), /^file:\/\//);

  await handle.cleanup({ success: true });
  await assert.rejects(() => fs.access(handle.root));
  await fs.rm(projectRoot, { recursive: true, force: true });
});

test("TempCopySandboxManager preserves sandbox on failure when configured", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-project-"));
  await fs.writeFile(path.join(projectRoot, "hello.txt"), "hello sandbox\n", "utf-8");

  const manager = new TempCopySandboxManager();
  const handle = await manager.createPerspectiveSandbox({
    runId: "run-copy-preserve",
    perspective: "reviewer",
    projectRoot,
    cleanupPolicy: "on-failure",
  });

  await handle.cleanup({ success: false });
  await fs.access(handle.root);

  await fs.rm(handle.metadata.sandboxBase ?? path.dirname(handle.root), { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});
