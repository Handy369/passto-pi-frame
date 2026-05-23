# browser-observe Recovery Plan

## Current finding

The repository currently references a real non-mock harness at `./browser-observe`, but that directory is missing.

Evidence:
- `package.json` scripts point to `npm --prefix ./browser-observe ...`
- Existing artifacts reference scenario paths under `/Users/handy/dev/passto-ai/browser-observe/scenarios/...`
- Existing real-run request.json shows the intended server command:
  - `npx -y chrome-devtools-mcp@latest --headless --isolated --no-usage-statistics --executablePath /Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- The restored `browser-test ` path currently contains only Playwright profile data and no runnable harness code.

## Conclusion

`browser_runtime_observe` is not fundamentally broken as an orchestrator. The immediate capability gap comes from the missing real low-level toolchain/harness directory that the repo expects to exist as `browser-observe/`.

## Required recovery

1. Restore or recreate `browser-observe/` as the real smoke / proof harness.
2. Keep runtime public routing in:
   - skill: `browser-runtime-observation`
   - extension: `extensions/browser-runtime-observation`
3. Keep `chrome-devtools-mcp` as low-level reference.
4. Do **not** use `browser-test ` as the final public location; that path is both malformed (trailing space) and currently only contains browser profile state.

## Recommended target structure

```text
browser-observe/
  package.json
  README.md
  scripts/
    real-smoke.mjs
  scenarios/
    public-homepage.json
    wikipedia-homepage.json
    email2ai-local-review-runtime.json
  artifacts/            # gitignored runtime outputs
```

## Why not move into ~/.claude/skills directly

Skill directories should hold routing / workflow / references, not heavy executable harness state.
The real executable harness belongs in the repo, while the skill should reference it clearly.
What should be moved or mirrored into skill-owned docs is:
- usage docs
- boundary docs
- recovery notes
- exact invocation examples

Not recommended to move into skill dir:
- Playwright profiles
- runtime artifacts
- scenario execution harness code that is part of repo tests/CI

## Immediate code policy already applied

`browser_runtime_observe` now hard-rejects `ready_via_agent_browser`.
This prevents false success paths and forces either:
- proper `agent-browser` routing, or
- proper restoration of the devtools-compatible toolchain.
