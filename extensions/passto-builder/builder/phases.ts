export const BUILDER_PHASES = [
  "prepare",
  "local_plan",
  "execute",
  "verify",
  "summarize",
] as const;

export type BuilderPhaseName = (typeof BUILDER_PHASES)[number];
