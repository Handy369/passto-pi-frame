export type LoopEngineId = "ralph-loop";

export type LoopEngineProgress = {
  engineId: LoopEngineId;
  status: "starting" | "running" | "completed" | "blocked" | "failed";
  summary: string;
};

export type LoopEngineResult = {
  engineId: LoopEngineId;
  finalStatus: "completed" | "blocked" | "failed";
  summary: string;
};
