# Passto Builder Examples

## Current examples

### `sample-builder-input.json`
A minimal structured builder input example.

### `sample-builder-input.md`
A short human-readable explanation of the same input shape.

### `sample-builder-task.md`
A sample task description for the current builder vertical slice.

## Suggested manual bootstrap flow

1. prepare a target `cwd`
2. copy and edit `sample-builder-input.json`
3. use `runBuilderFromJsonFile(path)` as a lightweight bootstrap helper
4. inspect:
   - formatted result summary
   - produced artifacts
   - workspace note output in the target cwd
