import test from "node:test";
import assert from "node:assert/strict";
import { showPasstoAgentPreviewPanel } from "../src/preview-ui.ts";

test("preview panel falls back to notify when custom UI is unavailable", async () => {
  const notifications = [];

  await showPasstoAgentPreviewPanel(
    {
      title: "Optional inferred fields",
      message: "- executor.type: codex-cli",
    },
    {
      hasUI: false,
      ui: {
        notify(message) {
          notifications.push(message);
        },
      },
    },
  );

  assert.equal(notifications.length, 1);
  assert.match(notifications[0] ?? "", /Optional inferred fields/);
  assert.match(notifications[0] ?? "", /executor\.type/);
});
