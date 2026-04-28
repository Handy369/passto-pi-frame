import test from "node:test";
import assert from "node:assert/strict";

const rootEntrypoint = new URL("../index.ts", import.meta.url);
const executorCoreEntrypoint = new URL("../executor-core/index.ts", import.meta.url);
const compatibilityEntrypoint = new URL("../compatibility/index.ts", import.meta.url);

test("root entrypoint exposes stable public API and omits advanced helpers", async () => {
  const root = await import(rootEntrypoint.href);

  assert.equal(typeof root.executeInvocation, "function");
  assert.equal(typeof root.executeTaskDoc, "function");
  assert.equal(typeof root.taskDocToInvocation, "function");
  assert.equal(typeof root.assembleExecutorContext, "function");
  assert.equal(typeof root.executeLegacyRequest, "function");
  assert.equal(typeof root.legacyRequestToRuntimePolicy, "function");
  assert.equal(typeof root.buildRunExecutorChildParams, "undefined");
  assert.equal(typeof root.StrategySandboxManager, "undefined");
  assert.equal(typeof root.WorktreeSandboxManager, "undefined");
});

test("executor-core entrypoint exposes advanced helpers", async () => {
  const executorCore = await import(executorCoreEntrypoint.href);

  assert.equal(typeof executorCore.executeResolvedContext, "function");
  assert.equal(typeof executorCore.buildRunExecutorChildParams, "function");
  assert.equal(typeof executorCore.StrategySandboxManager, "function");
  assert.equal(typeof executorCore.WorktreeSandboxManager, "function");
});

test("compatibility entrypoint exposes compatibility helpers", async () => {
  const compatibility = await import(compatibilityEntrypoint.href);

  assert.equal(typeof compatibility.legacyRequestToInvocation, "function");
  assert.equal(typeof compatibility.legacyRequestToRuntimePolicy, "function");
  assert.equal(typeof compatibility.legacyRequestToExecuteOptions, "function");
  assert.equal(typeof compatibility.executeLegacyRequest, "function");
});
