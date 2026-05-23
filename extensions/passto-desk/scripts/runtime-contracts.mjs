export const MODE_VALUES = new Set(["explain-first", "workbench"]);
export const TRANSFORM_DIRECTION_VALUES = new Set(["forward", "reverse"]);
export const RECOMMENDED_ACTION_VALUES = new Set(["persist", "retry", "local-rebuild", "full-rebuild", "human-review", "stop"]);
export const NEXT_ROUND_ACTION_VALUES = new Set(["continue", "retry", "local-rebuild", "full-rebuild", "human-review", "stop"]);
export const VALIDATION_STATUS_VALUES = new Set(["pass", "soft-fail", "hard-fail"]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value) {
  return typeof value === "string";
}

function isArray(value) {
  return Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pushError(errors, path, message) {
  errors.push({ path, message });
}

function ensureRecord(value, path, errors) {
  if (!isRecord(value)) {
    pushError(errors, path, "must be an object");
    return null;
  }
  return value;
}

function ensureArray(value, path, errors) {
  if (!isArray(value)) {
    pushError(errors, path, "must be an array");
    return null;
  }
  return value;
}

function ensureString(value, path, errors) {
  if (!isString(value)) {
    pushError(errors, path, "must be a string");
    return null;
  }
  return value;
}

function ensureEnum(value, allowed, path, errors) {
  if (!isString(value) || !allowed.has(value)) {
    pushError(errors, path, `must be one of: ${[...allowed].join(", ")}`);
    return null;
  }
  return value;
}

export function createEmptySharedSemanticState(overrides = {}) {
  return {
    semantic: {
      objects: [],
      relations: [],
      ambiguities: [],
      warnings: [],
    },
    view: {
      mode: "explain-first",
      visibleObjectIds: [],
      visibleRelationIds: [],
      primaryPath: [],
    },
    mapping: {
      objectToNode: [],
      relationToEdge: [],
      labelOwnership: [],
    },
    visual: {
      layoutPolicy: {},
      mechanismHints: [],
      readabilityHints: [],
    },
    control: {
      transformDirection: "forward",
      currentRoundGoal: "",
      validationStatus: "",
      nextRoundHint: "",
    },
    persistence: {
      truthSources: [],
      persistedArtifacts: [],
      injectionSummary: {},
    },
    ...clone(overrides),
  };
}

export function createEmptyTransformOutput(overrides = {}) {
  return {
    semanticDelta: {},
    viewDelta: {},
    mappingDelta: {},
    visualDelta: {},
    sceneProposal: {},
    ambiguities: [],
    warnings: [],
    conflicts: [],
    confidence: {},
    recommendedAction: "persist",
    ...clone(overrides),
  };
}

export function createEmptyValidationResult(overrides = {}) {
  return {
    status: "pass",
    findings: [],
    confidence: {},
    recommendedAction: "persist",
    ...clone(overrides),
  };
}

export function createEmptyNextRoundDecision(overrides = {}) {
  return {
    action: "continue",
    injectionPayload: {},
    nextRoundHint: "",
    carryForwardStateKeys: [],
    ...clone(overrides),
  };
}

export function validateSharedSemanticState(value) {
  const errors = [];
  const root = ensureRecord(value, "$", errors);
  if (!root) return { ok: false, errors };

  const semantic = ensureRecord(root.semantic, "$.semantic", errors);
  if (semantic) {
    ensureArray(semantic.objects, "$.semantic.objects", errors);
    ensureArray(semantic.relations, "$.semantic.relations", errors);
    if (semantic.ambiguities !== undefined) ensureArray(semantic.ambiguities, "$.semantic.ambiguities", errors);
    if (semantic.warnings !== undefined) ensureArray(semantic.warnings, "$.semantic.warnings", errors);
  }

  const view = ensureRecord(root.view, "$.view", errors);
  if (view) {
    ensureEnum(view.mode, MODE_VALUES, "$.view.mode", errors);
    ensureArray(view.visibleObjectIds, "$.view.visibleObjectIds", errors);
    ensureArray(view.visibleRelationIds, "$.view.visibleRelationIds", errors);
    if (view.primaryPath !== undefined) ensureArray(view.primaryPath, "$.view.primaryPath", errors);
  }

  const mapping = ensureRecord(root.mapping, "$.mapping", errors);
  if (mapping) {
    ensureArray(mapping.objectToNode, "$.mapping.objectToNode", errors);
    ensureArray(mapping.relationToEdge, "$.mapping.relationToEdge", errors);
    if (mapping.labelOwnership !== undefined) ensureArray(mapping.labelOwnership, "$.mapping.labelOwnership", errors);
  }

  const visual = ensureRecord(root.visual, "$.visual", errors);
  if (visual) {
    if (visual.layoutPolicy !== undefined) ensureRecord(visual.layoutPolicy, "$.visual.layoutPolicy", errors);
    if (visual.mechanismHints !== undefined) ensureArray(visual.mechanismHints, "$.visual.mechanismHints", errors);
    if (visual.readabilityHints !== undefined) ensureArray(visual.readabilityHints, "$.visual.readabilityHints", errors);
  }

  const control = ensureRecord(root.control, "$.control", errors);
  if (control) {
    ensureEnum(control.transformDirection, TRANSFORM_DIRECTION_VALUES, "$.control.transformDirection", errors);
    if (control.currentRoundGoal !== undefined) ensureString(control.currentRoundGoal, "$.control.currentRoundGoal", errors);
    if (control.validationStatus !== undefined && control.validationStatus !== "") {
      ensureEnum(control.validationStatus, VALIDATION_STATUS_VALUES, "$.control.validationStatus", errors);
    }
    if (control.nextRoundHint !== undefined) ensureString(control.nextRoundHint, "$.control.nextRoundHint", errors);
  }

  const persistence = ensureRecord(root.persistence, "$.persistence", errors);
  if (persistence) {
    if (persistence.truthSources !== undefined) ensureArray(persistence.truthSources, "$.persistence.truthSources", errors);
    if (persistence.persistedArtifacts !== undefined) ensureArray(persistence.persistedArtifacts, "$.persistence.persistedArtifacts", errors);
    if (persistence.injectionSummary !== undefined) ensureRecord(persistence.injectionSummary, "$.persistence.injectionSummary", errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateTransformOutput(value) {
  const errors = [];
  const root = ensureRecord(value, "$", errors);
  if (!root) return { ok: false, errors };

  ensureRecord(root.semanticDelta, "$.semanticDelta", errors);
  if (root.viewDelta !== undefined) ensureRecord(root.viewDelta, "$.viewDelta", errors);
  if (root.mappingDelta !== undefined) ensureRecord(root.mappingDelta, "$.mappingDelta", errors);
  if (root.visualDelta !== undefined) ensureRecord(root.visualDelta, "$.visualDelta", errors);
  if (root.sceneProposal !== undefined) ensureRecord(root.sceneProposal, "$.sceneProposal", errors);
  ensureArray(root.ambiguities, "$.ambiguities", errors);
  ensureArray(root.warnings, "$.warnings", errors);
  if (root.conflicts !== undefined) ensureArray(root.conflicts, "$.conflicts", errors);
  if (root.confidence !== undefined) ensureRecord(root.confidence, "$.confidence", errors);
  ensureEnum(root.recommendedAction, RECOMMENDED_ACTION_VALUES, "$.recommendedAction", errors);

  return { ok: errors.length === 0, errors };
}

export function validateValidationResult(value) {
  const errors = [];
  const root = ensureRecord(value, "$", errors);
  if (!root) return { ok: false, errors };

  ensureEnum(root.status, VALIDATION_STATUS_VALUES, "$.status", errors);
  ensureArray(root.findings, "$.findings", errors);
  if (root.confidence !== undefined) ensureRecord(root.confidence, "$.confidence", errors);
  ensureEnum(root.recommendedAction, RECOMMENDED_ACTION_VALUES, "$.recommendedAction", errors);

  return { ok: errors.length === 0, errors };
}

export function validateNextRoundDecision(value) {
  const errors = [];
  const root = ensureRecord(value, "$", errors);
  if (!root) return { ok: false, errors };

  ensureEnum(root.action, NEXT_ROUND_ACTION_VALUES, "$.action", errors);
  ensureRecord(root.injectionPayload, "$.injectionPayload", errors);
  if (root.nextRoundHint !== undefined) ensureString(root.nextRoundHint, "$.nextRoundHint", errors);
  if (root.carryForwardStateKeys !== undefined) ensureArray(root.carryForwardStateKeys, "$.carryForwardStateKeys", errors);

  return { ok: errors.length === 0, errors };
}

export function validateByKind(kind, value) {
  switch (kind) {
    case "shared-state":
      return validateSharedSemanticState(value);
    case "transform-output":
      return validateTransformOutput(value);
    case "validation-result":
      return validateValidationResult(value);
    case "next-round-decision":
      return validateNextRoundDecision(value);
    default:
      return { ok: false, errors: [{ path: "$.kind", message: `unsupported kind: ${kind}` }] };
  }
}

export function createSkeletonByKind(kind) {
  switch (kind) {
    case "shared-state":
      return createEmptySharedSemanticState();
    case "transform-output":
      return createEmptyTransformOutput();
    case "validation-result":
      return createEmptyValidationResult();
    case "next-round-decision":
      return createEmptyNextRoundDecision();
    default:
      throw new Error(`Unsupported kind: ${kind}`);
  }
}

export function buildSharedStateSnapshot(options = {}) {
  const {
    transformDirection = "forward",
    mode = "workbench",
    transformOutput = {},
    truthSources = [],
    currentRoundGoal = "",
    validationStatus = "",
    nextRoundHint = "",
    persistedArtifacts = [],
    injectionSummary = {},
  } = options;

  const snapshot = createEmptySharedSemanticState({
    semantic: {
      objects: Array.isArray(transformOutput.semanticDelta?.objects) ? clone(transformOutput.semanticDelta.objects) : [],
      relations: Array.isArray(transformOutput.semanticDelta?.relations) ? clone(transformOutput.semanticDelta.relations) : [],
      ambiguities: Array.isArray(transformOutput.ambiguities) ? clone(transformOutput.ambiguities) : [],
      warnings: Array.isArray(transformOutput.warnings) ? clone(transformOutput.warnings) : [],
    },
    view: {
      mode,
      visibleObjectIds: Array.isArray(transformOutput.viewDelta?.visibleObjectIds) ? clone(transformOutput.viewDelta.visibleObjectIds) : [],
      visibleRelationIds: Array.isArray(transformOutput.viewDelta?.visibleRelationIds) ? clone(transformOutput.viewDelta.visibleRelationIds) : [],
      primaryPath: Array.isArray(transformOutput.viewDelta?.primaryPath) ? clone(transformOutput.viewDelta.primaryPath) : [],
    },
    mapping: {
      objectToNode: Array.isArray(transformOutput.mappingDelta?.objectToNode) ? clone(transformOutput.mappingDelta.objectToNode) : [],
      relationToEdge: Array.isArray(transformOutput.mappingDelta?.relationToEdge) ? clone(transformOutput.mappingDelta.relationToEdge) : [],
      labelOwnership: Array.isArray(transformOutput.mappingDelta?.labelOwnership) ? clone(transformOutput.mappingDelta.labelOwnership) : [],
    },
    visual: {
      layoutPolicy: isRecord(transformOutput.visualDelta?.layoutPolicy) ? clone(transformOutput.visualDelta.layoutPolicy) : {},
      mechanismHints: Array.isArray(transformOutput.visualDelta?.mechanismHints) ? clone(transformOutput.visualDelta.mechanismHints) : [],
      readabilityHints: Array.isArray(transformOutput.visualDelta?.readabilityHints) ? clone(transformOutput.visualDelta.readabilityHints) : [],
    },
    control: {
      transformDirection,
      currentRoundGoal,
      validationStatus,
      nextRoundHint,
    },
    persistence: {
      truthSources: Array.isArray(truthSources) ? clone(truthSources) : [],
      persistedArtifacts: Array.isArray(persistedArtifacts) ? clone(persistedArtifacts) : [],
      injectionSummary: isRecord(injectionSummary) ? clone(injectionSummary) : {},
    },
  });

  return snapshot;
}

export function buildValidationResult(options = {}) {
  const {
    transformOutput = {},
    mergedState = null,
    preferredStatus = "",
  } = options;

  const warnings = Array.isArray(transformOutput.warnings) ? clone(transformOutput.warnings) : [];
  const conflicts = Array.isArray(transformOutput.conflicts) ? clone(transformOutput.conflicts) : [];
  const findings = [...warnings, ...conflicts];

  let status = "pass";
  if (preferredStatus && VALIDATION_STATUS_VALUES.has(preferredStatus)) {
    status = preferredStatus;
  } else if (conflicts.length > 0 || transformOutput.recommendedAction === "stop") {
    status = "hard-fail";
  } else if (warnings.length > 0 || transformOutput.recommendedAction === "retry" || transformOutput.recommendedAction === "human-review") {
    status = "soft-fail";
  }

  return createEmptyValidationResult({
    status,
    findings,
    confidence: isRecord(transformOutput.confidence) ? clone(transformOutput.confidence) : {},
    recommendedAction: status === "hard-fail"
      ? "stop"
      : transformOutput.recommendedAction === "persist" || transformOutput.recommendedAction === "retry" || transformOutput.recommendedAction === "local-rebuild" || transformOutput.recommendedAction === "full-rebuild" || transformOutput.recommendedAction === "human-review" || transformOutput.recommendedAction === "stop"
        ? transformOutput.recommendedAction
        : "persist",
    mergedStateSummary: mergedState && isRecord(mergedState)
      ? {
          objectCount: Array.isArray(mergedState.semantic?.objects) ? mergedState.semantic.objects.length : 0,
          relationCount: Array.isArray(mergedState.semantic?.relations) ? mergedState.semantic.relations.length : 0,
        }
      : undefined,
  });
}

export function buildNextRoundDecision(options = {}) {
  const {
    transformOutput = {},
    validationResult = {},
    mergedState = null,
    nextRoundHint = "",
  } = options;

  let action = "continue";
  if (validationResult.status === "hard-fail") {
    action = validationResult.recommendedAction === "full-rebuild" ? "full-rebuild" : validationResult.recommendedAction === "human-review" ? "human-review" : "stop";
  } else if (validationResult.status === "soft-fail") {
    action = validationResult.recommendedAction === "retry" || validationResult.recommendedAction === "local-rebuild" || validationResult.recommendedAction === "full-rebuild" || validationResult.recommendedAction === "human-review"
      ? validationResult.recommendedAction
      : "retry";
  }

  return createEmptyNextRoundDecision({
    action,
    injectionPayload: {
      nextRoundHint,
      recommendedAction: transformOutput.recommendedAction ?? null,
      validationStatus: validationResult.status ?? null,
      objectCount: mergedState && Array.isArray(mergedState.semantic?.objects) ? mergedState.semantic.objects.length : 0,
      relationCount: mergedState && Array.isArray(mergedState.semantic?.relations) ? mergedState.semantic.relations.length : 0,
    },
    nextRoundHint,
    carryForwardStateKeys: ["semantic", "view", "mapping", "visual", "control", "persistence"],
  });
}

function mergeById(baseItems, nextItems) {
  const result = [];
  const indexById = new Map();

  for (const item of Array.isArray(baseItems) ? baseItems : []) {
    const normalized = isRecord(item) ? clone(item) : item;
    const id = isRecord(normalized) && isString(normalized.id) ? normalized.id : null;
    if (id && !indexById.has(id)) {
      indexById.set(id, result.length);
    }
    result.push(normalized);
  }

  for (const item of Array.isArray(nextItems) ? nextItems : []) {
    const normalized = isRecord(item) ? clone(item) : item;
    const id = isRecord(normalized) && isString(normalized.id) ? normalized.id : null;
    if (id && indexById.has(id)) {
      result[indexById.get(id)] = normalized;
    } else {
      if (id) indexById.set(id, result.length);
      result.push(normalized);
    }
  }

  return result;
}

function mergeUniquePrimitiveArrays(baseItems, nextItems) {
  const seen = new Set();
  const output = [];
  for (const item of [...(Array.isArray(baseItems) ? baseItems : []), ...(Array.isArray(nextItems) ? nextItems : [])]) {
    const key = typeof item === "string" || typeof item === "number" || typeof item === "boolean" ? String(item) : JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clone(item));
  }
  return output;
}

export function mergeSharedStateSnapshot(baseState, nextSnapshot) {
  const safeBase = createEmptySharedSemanticState(isRecord(baseState) ? baseState : {});
  const safeNext = createEmptySharedSemanticState(isRecord(nextSnapshot) ? nextSnapshot : {});

  return {
    semantic: {
      objects: mergeById(safeBase.semantic.objects, safeNext.semantic.objects),
      relations: mergeById(safeBase.semantic.relations, safeNext.semantic.relations),
      ambiguities: [...safeBase.semantic.ambiguities, ...safeNext.semantic.ambiguities].map((item) => clone(item)),
      warnings: [...safeBase.semantic.warnings, ...safeNext.semantic.warnings].map((item) => clone(item)),
    },
    view: {
      ...clone(safeBase.view),
      ...clone(safeNext.view),
      visibleObjectIds: mergeUniquePrimitiveArrays(safeBase.view.visibleObjectIds, safeNext.view.visibleObjectIds),
      visibleRelationIds: mergeUniquePrimitiveArrays(safeBase.view.visibleRelationIds, safeNext.view.visibleRelationIds),
      primaryPath: mergeUniquePrimitiveArrays(safeBase.view.primaryPath, safeNext.view.primaryPath),
    },
    mapping: {
      ...clone(safeBase.mapping),
      ...clone(safeNext.mapping),
      objectToNode: mergeById(safeBase.mapping.objectToNode, safeNext.mapping.objectToNode),
      relationToEdge: mergeById(safeBase.mapping.relationToEdge, safeNext.mapping.relationToEdge),
      labelOwnership: mergeById(safeBase.mapping.labelOwnership, safeNext.mapping.labelOwnership),
    },
    visual: {
      ...clone(safeBase.visual),
      ...clone(safeNext.visual),
      layoutPolicy: {
        ...(isRecord(safeBase.visual.layoutPolicy) ? clone(safeBase.visual.layoutPolicy) : {}),
        ...(isRecord(safeNext.visual.layoutPolicy) ? clone(safeNext.visual.layoutPolicy) : {}),
      },
      mechanismHints: [...safeBase.visual.mechanismHints, ...safeNext.visual.mechanismHints].map((item) => clone(item)),
      readabilityHints: [...safeBase.visual.readabilityHints, ...safeNext.visual.readabilityHints].map((item) => clone(item)),
    },
    control: {
      ...clone(safeBase.control),
      ...clone(safeNext.control),
    },
    persistence: {
      ...clone(safeBase.persistence),
      ...clone(safeNext.persistence),
      truthSources: [...safeBase.persistence.truthSources, ...safeNext.persistence.truthSources].map((item) => clone(item)),
      persistedArtifacts: [...safeBase.persistence.persistedArtifacts, ...safeNext.persistence.persistedArtifacts].map((item) => clone(item)),
      injectionSummary: {
        ...(isRecord(safeBase.persistence.injectionSummary) ? clone(safeBase.persistence.injectionSummary) : {}),
        ...(isRecord(safeNext.persistence.injectionSummary) ? clone(safeNext.persistence.injectionSummary) : {}),
      },
    },
  };
}

export function commitTransformResult(options = {}) {
  const {
    baseState = {},
    transformOutput = {},
    transformDirection = "forward",
    mode = "workbench",
    truthSources = [],
    currentRoundGoal = "",
    validationStatus = "",
    nextRoundHint = "",
    persistedArtifacts = [],
    injectionSummary = {},
  } = options;

  const outputValidation = validateTransformOutput(transformOutput);
  if (!outputValidation.ok) {
    return {
      ok: false,
      stage: "transform-output",
      errors: outputValidation.errors,
    };
  }

  const nextSnapshot = buildSharedStateSnapshot({
    transformDirection,
    mode,
    transformOutput,
    truthSources,
    currentRoundGoal,
    validationStatus,
    nextRoundHint,
    persistedArtifacts,
    injectionSummary,
  });

  const snapshotValidation = validateSharedSemanticState(nextSnapshot);
  if (!snapshotValidation.ok) {
    return {
      ok: false,
      stage: "shared-state-snapshot",
      errors: snapshotValidation.errors,
      nextSnapshot,
    };
  }

  const mergedState = mergeSharedStateSnapshot(baseState, nextSnapshot);
  const mergedValidation = validateSharedSemanticState(mergedState);
  if (!mergedValidation.ok) {
    return {
      ok: false,
      stage: "merged-state",
      errors: mergedValidation.errors,
      nextSnapshot,
      mergedState,
    };
  }

  const validationResult = buildValidationResult({
    transformOutput,
    mergedState,
    preferredStatus: validationStatus,
  });
  const validationResultCheck = validateValidationResult(validationResult);
  if (!validationResultCheck.ok) {
    return {
      ok: false,
      stage: "validation-result",
      errors: validationResultCheck.errors,
      nextSnapshot,
      mergedState,
      validationResult,
    };
  }

  const nextRoundDecision = buildNextRoundDecision({
    transformOutput,
    validationResult,
    mergedState,
    nextRoundHint,
  });
  const nextRoundDecisionCheck = validateNextRoundDecision(nextRoundDecision);
  if (!nextRoundDecisionCheck.ok) {
    return {
      ok: false,
      stage: "next-round-decision",
      errors: nextRoundDecisionCheck.errors,
      nextSnapshot,
      mergedState,
      validationResult,
      nextRoundDecision,
    };
  }

  return {
    ok: true,
    stage: "committed",
    nextSnapshot,
    mergedState,
    validationResult,
    nextRoundDecision,
    validations: {
      transformOutput: outputValidation,
      nextSnapshot: snapshotValidation,
      mergedState: mergedValidation,
      validationResult: validationResultCheck,
      nextRoundDecision: nextRoundDecisionCheck,
    },
  };
}
