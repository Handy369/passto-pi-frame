# Sample Builder CLI Input

Use the JSON example in `sample-builder-input.json` as the structured input source.

Minimal equivalent values:
- goal: Create a short implementation note
- task: Write a short implementation note into the workspace describing the current builder bootstrap status.
- cwd: target project directory
- expectedOutputs:
  - A short implementation note file
- sandboxStrategy: temp-copy
- executionEngine: ralph-loop
