import test from "node:test";
import assert from "node:assert/strict";
import { parseExecutionContractName, ralphLoopContractVerifier } from "../executor-core/contracts.ts";

test("parseExecutionContractName recognizes ralph-loop contract", () => {
  assert.equal(parseExecutionContractName("ralph-loop"), "ralph-loop");
  assert.equal(parseExecutionContractName("unknown"), null);
});

test("ralphLoopContractVerifier can report unsatisfied contract without implying runtime parity", () => {
  const result = ralphLoopContractVerifier.verify({
    task: "Run a Ralph loop",
    cwd: "/tmp/nonexistent-ralph-fixture",
    rawEvents: [],
  });

  assert.equal(result.name, "ralph-loop");
  assert.equal(typeof result.satisfied, "boolean");
  assert.ok(result.reason);
});
