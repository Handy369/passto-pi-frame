#!/usr/bin/env node

import {
  commitTransformResult,
  createEmptySharedSemanticState,
} from "./runtime-contracts.mjs";

const baseState = createEmptySharedSemanticState({
  semantic: {
    objects: [{ id: "obj-a", type: "action", title: "Start" }],
    relations: [],
    ambiguities: [],
    warnings: [],
  },
  view: {
    mode: "workbench",
    visibleObjectIds: ["obj-a"],
    visibleRelationIds: [],
    primaryPath: ["obj-a"],
  },
  control: {
    transformDirection: "forward",
    currentRoundGoal: "initial",
    validationStatus: "pass",
    nextRoundHint: "continue",
  },
});

const transformOutput = {
  semanticDelta: {
    objects: [
      { id: "obj-a", type: "action", title: "Start updated" },
      { id: "obj-b", type: "decision", title: "Review" },
    ],
    relations: [
      { id: "rel-a", from: "obj-a", to: "obj-b", label: "go" },
    ],
  },
  viewDelta: {
    visibleObjectIds: ["obj-a", "obj-b"],
    visibleRelationIds: ["rel-a"],
    primaryPath: ["obj-a", "obj-b"],
  },
  mappingDelta: {
    objectToNode: [
      { id: "map-obj-a", objectId: "obj-a", nodeId: "node-a" },
      { id: "map-obj-b", objectId: "obj-b", nodeId: "node-b" },
    ],
    relationToEdge: [
      { id: "map-rel-a", relationId: "rel-a", edgeId: "edge-a" },
    ],
  },
  visualDelta: {
    layoutPolicy: { direction: "LR", primarySpacingX: 240 },
    mechanismHints: [{ code: "MECH_FORWARD" }],
    readabilityHints: [{ code: "READ_FORWARD" }],
  },
  sceneProposal: {
    type: "excalidraw",
    elementCount: 6,
  },
  ambiguities: [],
  warnings: [{ code: "WARN_FORWARD", message: "demo warning" }],
  conflicts: [],
  confidence: { overall: "medium" },
  recommendedAction: "persist",
};

const result = commitTransformResult({
  baseState,
  transformOutput,
  transformDirection: "forward",
  mode: "workbench",
  truthSources: [{ type: "demo-input" }],
  currentRoundGoal: "demo-commit",
  validationStatus: "pass",
  nextRoundHint: "continue",
  persistedArtifacts: [{ type: "demo-scene" }],
  injectionSummary: { via: "runtime-commit-smoke" },
});

console.log(JSON.stringify(result, null, 2));
