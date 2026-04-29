# Passto Builder Test Layout

## Test groups

### Fast workflow-focused tests
These should stay lightweight and use seams where appropriate:
- `builder-contracts.test.mjs`
- `executor-bridge.test.mjs`
- `fast-workflow.test.mjs`

### Medium workflow/vertical-slice tests
These validate more real behavior but should still remain part of normal local validation when practical:
- `builder-workflow.test.mjs`
- `vertical-slice.test.mjs`

### Heavy manual-surface / integration-style tests
These may exercise slower runtime-import paths or real file-output flows through public entry surfaces:
- `command-tool.test.mjs`
- `json-command.test.mjs`

## Current policy

- fast and medium tests should generally stay enabled by default
- heavy tests may be skipped selectively when they become too slow for the default loop
- heavy tests still remain important because they validate current project-driver ergonomics
