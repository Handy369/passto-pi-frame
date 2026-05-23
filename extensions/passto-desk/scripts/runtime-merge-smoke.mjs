#!/usr/bin/env node

import {
  buildSharedStateSnapshot,
  createEmptySharedSemanticState,
  mergeSharedStateSnapshot,
  validateSharedSemanticState,
} from "./runtime-contracts.mjs";

const baseState = createEmptySharedSemanticState({
  semantic: {
    objects: [{ id: "obj-a", type: "action", title: "Start" }],
    relations: [{ id: "rel-a", from: "obj-a", to: "obj-b", label: "next" }],
    ambiguities: [],
    warnings: [{ code: "BASE_WARNING", message: "from base" }],
  },
  view: {
    mode: "workbench",
    visibleObjectIds: ["obj-a"],
    visibleRelationIds: ["rel-a"],
    primaryPath: ["obj-a"],
  },
  mapping: {
    objectToNode: [{ id: "map-obj-a", objectId: "obj-a", nodeId: "node-a" }],
    relationToEdge: [{ id: "map-rel-a", relationId: "rel-a", edgeId: "edge-a" }],
    labelOwnership: [],
  },
  control: {
    transformDirection: "forward",
    currentRoundGoal: "base",
    validationStatus: "pass",
    nextRoundHint: "continue",
  },
  persistence: {
    truthSources: [{ type: "base" }],
    persistedArtifacts: [{ type: "base-artifact" }],
    injectionSummary: { source: "base" },
  },
});

const nextTransformOutput = {
  semanticDelta: {
    objects: [
      { id: "obj-a", type: "action", title: "Start updated" },
      { id: "obj-b", type: "action", title: "Next" }
    ],
    relations: [
      { id: "rel-a", from: "obj-a", to: "obj-b", label: "next-updated" },
      { id: "rel-b", from: "obj-b", to: "obj-c", label: "continue" }
    ]
  },
  viewDelta: {
    visibleObjectIds: ["obj-a", "obj-b"],
    visibleRelationIds: ["rel-a", "rel-b"],
    primaryPath: ["obj-a", "obj-b"]
  },
  mappingDelta: {
    objectToNode: [
      { id: "map-obj-a", objectId: "obj-a", nodeId: "node-a2" },
      { id: "map-obj-b", objectId: "obj-b", nodeId: "node-b" }
    ],
    relationToEdge: [
      { id: "map-rel-a", relationId: "rel-a", edgeId: "edge-a2" },
      { id: "map-rel-b", relationId: "rel-b", edgeId: "edge-b" }
    ]
  },
  visualDelta: {
    layoutPolicy: { direction: "LR", primarySpacingX: 240 },
    mechanismHints: [{ code: "MECH_1" }],
    readabilityHints: [{ code: "READ_1" }]
  },
  ambiguities: [{ code: "AMB_1", message: "test ambiguity" }],
  warnings: [{ code: "WARN_1", message: "test warning" }]
};

const nextSnapshot = buildSharedStateSnapshot({
  transformDirection: "reverse",
  mode: "workbench",
  transformOutput: nextTransformOutput,
  truthSources: [{ type: "scene" }],
  persistedArtifacts: [{ type: "scene-artifact" }],
  validationStatus: "soft-fail",
  nextRoundHint: "review",
});

const merged = mergeSharedStateSnapshot(baseState, nextSnapshot);
const validation = validateSharedSemanticState(merged);

console.log(JSON.stringify({
  ok: validation.ok,
  errors: validation.errors,
  summary: {
    objectCount: merged.semantic.objects.length,
    relationCount: merged.semantic.relations.length,
    ambiguityCount: merged.semantic.ambiguities.length,
    warningCount: merged.semantic.warnings.length,
    visibleObjectIds: merged.view.visibleObjectIds,
    visibleRelationIds: merged.view.visibleRelationIds,
    control: merged.control,
    truthSourcesCount: merged.persistence.truthSources.length,
    persistedArtifactsCount: merged.persistence.persistedArtifacts.length,
  }
}, null, 2));
