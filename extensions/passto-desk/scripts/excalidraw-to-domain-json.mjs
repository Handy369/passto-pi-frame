#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  createEmptyTransformOutput,
  validateTransformOutput,
  commitTransformResult,
} from "./runtime-contracts.mjs";

function usage() {
  console.error([
    "Usage:",
    "  node ./scripts/excalidraw-to-domain-json.mjs <input> [output]",
    "  npm run to-domain-json -- <input> [output]",
    "",
    "Input can be:",
    "  - a .excalidraw / scene JSON file containing { elements, appState? }",
    "  - a .json file that is directly an elements[] array",
    "",
    "Output is passto-desk-domain-json/v3.",
  ].join("\n"));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value, fallback = null) {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function deriveOutputPath(inputPath) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext || undefined);
  return path.join(dir, `${base}.domain.json`);
}

function getElementBounds(element) {
  const x = asNumber(element.x);
  const y = asNumber(element.y);
  const width = asNumber(element.width);
  const height = asNumber(element.height);
  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
  };
}

function computeSceneBounds(elements) {
  const active = elements.filter((element) => element.isDeleted !== true);
  if (active.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of active) {
    const bounds = getElementBounds(element);
    minX = Math.min(minX, bounds.left);
    minY = Math.min(minY, bounds.top);
    maxX = Math.max(maxX, bounds.right);
    maxY = Math.max(maxY, bounds.bottom);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function computeTypeCounts(elements) {
  const result = {};
  for (const element of elements) {
    const key = asString(element.type, "unknown");
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function computeAnchors(bounds) {
  return {
    top: { x: bounds.centerX, y: bounds.top },
    right: { x: bounds.right, y: bounds.centerY },
    bottom: { x: bounds.centerX, y: bounds.bottom },
    left: { x: bounds.left, y: bounds.centerY },
  };
}

function absoluteArrowEndpoints(arrow) {
  const points = Array.isArray(arrow.points) ? arrow.points : [];
  const first = Array.isArray(points[0]) ? points[0] : [0, 0];
  const last = Array.isArray(points[points.length - 1]) ? points[points.length - 1] : first;
  const x = asNumber(arrow.x);
  const y = asNumber(arrow.y);
  return {
    start: { x: x + asNumber(first[0]), y: y + asNumber(first[1]) },
    end: { x: x + asNumber(last[0]), y: y + asNumber(last[1]) },
  };
}

function deriveSideFromPoint(bounds, point) {
  const distances = [
    ["top", Math.abs(point.y - bounds.top)],
    ["right", Math.abs(point.x - bounds.right)],
    ["bottom", Math.abs(point.y - bounds.bottom)],
    ["left", Math.abs(point.x - bounds.left)],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}

function pointInsideOrNearBounds(bounds, point, tolerance = 12) {
  return point.x >= bounds.left - tolerance && point.x <= bounds.right + tolerance && point.y >= bounds.top - tolerance && point.y <= bounds.bottom + tolerance;
}

function normalizeBoundElements(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({ id: asString(item.id, ""), type: asString(item.type, "unknown") })).filter((item) => item.id);
}

function normalizeBinding(value) {
  if (!isRecord(value)) return null;
  const elementId = asString(value.elementId);
  if (!elementId) return null;
  return {
    elementId,
    focus: typeof value.focus === "number" ? value.focus : null,
    gap: typeof value.gap === "number" ? value.gap : null,
    fixedPoint: isRecord(value.fixedPoint)
      ? { x: typeof value.fixedPoint.x === "number" ? value.fixedPoint.x : null, y: typeof value.fixedPoint.y === "number" ? value.fixedPoint.y : null }
      : null,
  };
}

function normalizeShapeElement(element) {
  const bounds = getElementBounds(element);
  return {
    id: asString(element.id, ""),
    type: asString(element.type, "unknown"),
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    centerX: bounds.centerX,
    centerY: bounds.centerY,
    angle: asNumber(element.angle),
    groupIds: Array.isArray(element.groupIds) ? element.groupIds : [],
    frameId: asString(element.frameId),
    link: asString(element.link),
    locked: element.locked === true,
    index: asString(element.index),
    customData: isRecord(element.customData) ? element.customData : {},
    style: {
      strokeColor: element.strokeColor ?? null,
      backgroundColor: element.backgroundColor ?? null,
      fillStyle: element.fillStyle ?? null,
      strokeWidth: element.strokeWidth ?? null,
      strokeStyle: element.strokeStyle ?? null,
      roughness: element.roughness ?? null,
      opacity: element.opacity ?? null,
      roundness: element.roundness ?? null,
    },
    raw: { boundElements: normalizeBoundElements(element.boundElements) },
  };
}

function objectTypeFromShape(type, style, text, strokeStyle) {
  const bg = asString(style?.backgroundColor, "") ?? "";
  const content = asString(text, "") ?? "";
  const stroke = asString(strokeStyle, "") ?? "";
  if (bg === "#fff8db" && stroke === "dashed") return "annotation";
  if (bg === "#fff8db") return "note";
  if (bg === "#f8fafc") return "legend";
  if (type === "diamond") return "decision";
  if (type === "ellipse") return "state";
  if (/图例|legend/i.test(content)) return "legend";
  return "action";
}

function inferDirection(nodes) {
  if (nodes.length < 2) return "LR";
  const xs = nodes.map((node) => node.geometry.centerX);
  const ys = nodes.map((node) => node.geometry.centerY);
  return Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? "LR" : "TB";
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function containsBox(outer, inner, tolerance = 0) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

function detectContainers(shapeNodes) {
  const candidates = [];
  for (const node of shapeNodes) {
    const role = asString(node.raw?.containerRole);
    const sourceLaneId = asString(node.raw?.sourceLaneId);
    const sourceGroupId = asString(node.raw?.sourceGroupId);
    const box = { x: node.geometry.x, y: node.geometry.y, width: node.geometry.width, height: node.geometry.height };
    if (role === "lane" || role === "group") {
      const inner = shapeNodes.filter((other) => other.id !== node.id && containsBox(box, { x: other.geometry.x, y: other.geometry.y, width: other.geometry.width, height: other.geometry.height }));
      candidates.push({ node, inner, role, sourceLaneId, sourceGroupId, confidence: "explicit", box });
      continue;
    }
    if (node.kind !== "rectangle") continue;
    if (node.geometry.width < 260 && node.geometry.height < 160) continue;
    const inner = shapeNodes.filter((other) => other.id !== node.id && containsBox(box, { x: other.geometry.x, y: other.geometry.y, width: other.geometry.width, height: other.geometry.height }));
    const label = asString(node.label?.text, "") ?? "";
    if (inner.length >= 2 || /lane|泳道|group|组/i.test(label)) {
      candidates.push({ node, inner, role: /lane|泳道/i.test(label) ? "lane" : "group", sourceLaneId: null, sourceGroupId: null, confidence: "inferred", box });
    }
  }
  candidates.sort((a, b) => (a.role === b.role ? b.box.width * b.box.height - a.box.width * a.box.height : a.role === "lane" ? -1 : 1));
  const filtered = [];
  for (const candidate of candidates) {
    const duplicate = filtered.find((existing) => existing.role === candidate.role && overlapArea(existing.box, candidate.box) > Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height) * 0.9);
    if (!duplicate) filtered.push(candidate);
  }
  return filtered;
}

function inferAnchorSide(anchor, geometry, targetPoint) {
  if (!targetPoint) return null;
  const center = anchorReferencePoint(anchor, geometry);
  const dx = center.x - asNumber(targetPoint.x);
  const dy = center.y - asNumber(targetPoint.y);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
}

function assignAnnotationTargets(nodes, relations) {
  const relationGeometries = new Map(relations.map((relation) => [relation.id, relation.raw?.geometry ?? null]));
  return nodes.map((node) => {
    if (node.objectType !== "annotation") return node;
    const customTargetType = asString(node.raw?.annotationTargetType);
    const customTargetId = asString(node.raw?.annotationTargetId);
    if (customTargetType && customTargetId) {
      const chosenAnchor = isRecord(node.raw?.chosenAnchor)
        ? {
            axis: asString(node.raw.chosenAnchor.axis, null),
            x: typeof node.raw.chosenAnchor.x === "number" ? node.raw.chosenAnchor.x : null,
            y: typeof node.raw.chosenAnchor.y === "number" ? node.raw.chosenAnchor.y : null,
            side: asString(node.raw.chosenAnchor.side, null),
            targetType: asString(node.raw.chosenAnchor.targetType, customTargetType),
            targetId: asString(node.raw.chosenAnchor.targetId, customTargetId),
            source: asString(node.raw.chosenAnchor.source, null),
            confidence: asString(node.raw.chosenAnchor.confidence, null),
          }
        : null;
      return { ...node, annotationTarget: { targetType: customTargetType, targetId: customTargetId, confidence: "explicit" }, raw: chosenAnchor ? { ...node.raw, chosenAnchor } : node.raw };
    }
    const center = { x: node.geometry.centerX, y: node.geometry.centerY };
    let best = null;
    for (const targetNode of nodes) {
      if (targetNode.id === node.id) continue;
      if (["note", "annotation", "legend"].includes(targetNode.objectType)) continue;
      const distance = Math.hypot(targetNode.geometry.centerX - center.x, targetNode.geometry.centerY - center.y);
      if (distance <= 260 && (!best || distance < best.distance)) best = { targetType: "object", targetId: targetNode.id, distance, confidence: "inferred" };
    }
    for (const relation of relations) {
      const geometry = relationGeometries.get(relation.id);
      const points = Array.isArray(geometry?.points) ? geometry.points : [];
      if (points.length < 2) continue;
      const absPoints = points.map((point) => [asNumber(point[0]) + asNumber(geometry?.x), asNumber(point[1]) + asNumber(geometry?.y)]);
      for (let i = 0; i < absPoints.length - 1; i += 1) {
        const [x1, y1] = absPoints[i];
        const [x2, y2] = absPoints[i + 1];
        const distance = Math.hypot((x1 + x2) / 2 - center.x, (y1 + y2) / 2 - center.y);
        if (distance <= 220 && (!best || distance < best.distance)) best = { targetType: "relation", targetId: relation.id, distance, confidence: "inferred" };
      }
    }
    return best ? { ...node, annotationTarget: { targetType: best.targetType, targetId: best.targetId, confidence: best.confidence } } : node;
  });
}

async function main() {
  const [, , inputPathArg, outputPathArg] = process.argv;
  if (!inputPathArg) {
    usage();
    process.exit(1);
  }
  const inputPath = path.resolve(inputPathArg);
  const outputPath = path.resolve(outputPathArg ?? deriveOutputPath(inputPath));
  const raw = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw);

  let sourceType = "unknown";
  let elements = [];
  let appState = {};
  if (Array.isArray(parsed)) {
    sourceType = "elements-array";
    elements = parsed;
  } else if (isRecord(parsed) && Array.isArray(parsed.elements)) {
    sourceType = "excalidraw-scene";
    elements = parsed.elements;
    appState = isRecord(parsed.appState) ? parsed.appState : {};
  } else {
    throw new Error("Unsupported input JSON: expected elements[] or { elements, appState? }.");
  }

  const activeElements = elements.filter((element) => isRecord(element) && element.isDeleted !== true);
  const textElements = activeElements.filter((element) => element.type === "text");
  const arrowElements = activeElements.filter((element) => element.type === "arrow");
  const textByContainerId = new Map();
  for (const textElement of textElements) {
    const containerId = asString(textElement.containerId);
    if (!containerId) continue;
    const list = textByContainerId.get(containerId) ?? [];
    list.push(textElement);
    textByContainerId.set(containerId, list);
  }

  const allShapeNodes = activeElements
    .filter((element) => ["rectangle", "diamond", "ellipse"].includes(asString(element.type, "")))
    .map((element) => {
      const normalized = normalizeShapeElement(element);
      const labelElement = (textByContainerId.get(normalized.id) ?? [])[0] ?? null;
      const labelText = labelElement ? asString(labelElement.text, "") : null;
      return {
        id: normalized.id,
        objectType: objectTypeFromShape(normalized.type, normalized.style, labelText, normalized.style?.strokeStyle),
        kind: normalized.type,
        geometry: { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height, centerX: normalized.centerX, centerY: normalized.centerY, angle: normalized.angle },
        anchors: computeAnchors(getElementBounds(element)),
        label: labelElement
          ? { text: asString(labelElement.text, ""), textElementId: asString(labelElement.id, null), binding: "bound", containerId: normalized.id, fontSize: asNumber(labelElement.fontSize, 20) }
          : { text: null, textElementId: null, binding: "none", containerId: null, fontSize: 20 },
        style: normalized.style,
        raw: { ...normalized.raw, ...normalized.customData },
      };
    });

  const containerCandidates = detectContainers(allShapeNodes);
  const containerIds = new Set(containerCandidates.map((item) => item.node.id));
  const groupContainers = containerCandidates.filter((item) => item.role === "group").map((item, index) => ({ id: item.sourceGroupId ?? `group-${index + 1}`, sourceNodeId: item.node.id, title: item.node.label.text ?? `Group ${index + 1}`, memberObjectIds: item.inner.filter((node) => !containerIds.has(node.id)).map((node) => node.id), geometry: item.node.geometry, confidence: item.confidence }));
  const laneContainers = containerCandidates.filter((item) => item.role === "lane").map((item, index) => ({ id: item.sourceLaneId ?? `lane-${index + 1}`, sourceNodeId: item.node.id, title: item.node.label.text ?? `Lane ${index + 1}`, memberObjectIds: item.inner.filter((node) => !containerIds.has(node.id)).map((node) => node.id), geometry: item.node.geometry, confidence: item.confidence }));

  let nodes = allShapeNodes.filter((node) => !containerIds.has(node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const warnings = [];
  const freeTexts = textElements.filter((element) => !asString(element.containerId)).map((element) => ({ id: asString(element.id, ""), text: asString(element.text, ""), x: asNumber(element.x), y: asNumber(element.y), width: asNumber(element.width), height: asNumber(element.height) }));

  for (const textElement of textElements) {
    const textId = asString(textElement.id, "");
    const containerId = asString(textElement.containerId);
    if (!containerId) {
      warnings.push({ code: "FREE_TEXT", severity: "warning", message: `text ${textId} 没有 containerId，不属于 bound text。`, elementIds: [textId] });
      continue;
    }
    if (!nodeById.has(containerId) && !arrowElements.find((arrow) => asString(arrow.id, "") === containerId) && !containerIds.has(containerId)) {
      warnings.push({ code: "MISSING_TEXT_CONTAINER", severity: "error", message: `text ${textId} 引用了不存在的 containerId=${containerId}。`, elementIds: [textId, containerId] });
    }
  }

  const relations = arrowElements.map((element) => {
    const id = asString(element.id, "");
    const points = Array.isArray(element.points) ? element.points : [];
    const endpoints = absoluteArrowEndpoints(element);
    const startBinding = normalizeBinding(element.startBinding);
    const endBinding = normalizeBinding(element.endBinding);
    const fromNode = startBinding ? nodeById.get(startBinding.elementId) ?? null : null;
    const toNode = endBinding ? nodeById.get(endBinding.elementId) ?? null : null;
    const labelElement = (textByContainerId.get(id) ?? [])[0] ?? null;
    if (!startBinding) warnings.push({ code: "UNBOUND_ARROW_START", severity: "error", message: `arrow ${id} 缺少 startBinding，属于视觉连接而不是属性连接。`, elementIds: [id] });
    if (!endBinding) warnings.push({ code: "UNBOUND_ARROW_END", severity: "error", message: `arrow ${id} 缺少 endBinding，属于视觉连接而不是属性连接。`, elementIds: [id] });
    if (startBinding && !fromNode) warnings.push({ code: "MISSING_ARROW_START_NODE", severity: "error", message: `arrow ${id} 的 startBinding 指向不存在的节点 ${startBinding.elementId}。`, elementIds: [id, startBinding.elementId] });
    if (endBinding && !toNode) warnings.push({ code: "MISSING_ARROW_END_NODE", severity: "error", message: `arrow ${id} 的 endBinding 指向不存在的节点 ${endBinding.elementId}。`, elementIds: [id, endBinding.elementId] });
    if (!startBinding || !endBinding) {
      for (const node of nodes) {
        const bounds = { left: node.geometry.x, right: node.geometry.x + node.geometry.width, top: node.geometry.y, bottom: node.geometry.y + node.geometry.height };
        if (pointInsideOrNearBounds(bounds, endpoints.start) || pointInsideOrNearBounds(bounds, endpoints.end)) warnings.push({ code: "VISUAL_ONLY_CONNECTION", severity: "warning", message: `arrow ${id} 看起来连接到了 ${node.id}，但没有完整属性绑定。`, elementIds: [id, node.id] });
      }
    }
    return {
      id,
      type: "transition",
      from: startBinding?.elementId ?? null,
      to: endBinding?.elementId ?? null,
      label: labelElement ? asString(labelElement.text, "") : null,
      visual: {
        fromSide: fromNode ? deriveSideFromPoint({ left: fromNode.geometry.x, right: fromNode.geometry.x + fromNode.geometry.width, top: fromNode.geometry.y, bottom: fromNode.geometry.y + fromNode.geometry.height }, endpoints.start) : null,
        toSide: toNode ? deriveSideFromPoint({ left: toNode.geometry.x, right: toNode.geometry.x + toNode.geometry.width, top: toNode.geometry.y, bottom: toNode.geometry.y + toNode.geometry.height }, endpoints.end) : null,
        fontSize: labelElement ? asNumber(labelElement.fontSize, 16) : 16,
        strokeColor: element.strokeColor ?? null,
        strokeWidth: element.strokeWidth ?? null,
        strokeStyle: element.strokeStyle ?? null,
        elbowed: points.length > 2,
        layout: isRecord(element.customData)
          ? {
              anchor: isRecord(element.customData.anchor) ? element.customData.anchor : null,
              offsetStrategy: isRecord(element.customData.offsetStrategy) ? element.customData.offsetStrategy : null,
              routingMidpoint: isRecord(element.customData.routingMidpoint) ? element.customData.routingMidpoint : null,
            }
          : null,
      },
      raw: { geometry: { x: asNumber(element.x), y: asNumber(element.y), points }, binding: { start: startBinding, end: endBinding }, ...(isRecord(element.customData) ? { customData: element.customData } : {}) },
    };
  });

  nodes = assignAnnotationTargets(nodes, relations);
  const notes = nodes.filter((node) => ["note", "annotation", "legend"].includes(node.objectType)).map((node) => ({ id: node.id, type: node.objectType, title: node.label.text ?? node.id, laneId: asString(node.raw?.laneId, null), target: node.annotationTarget ? { targetType: node.annotationTarget.targetType, targetId: node.annotationTarget.targetId, confidence: node.annotationTarget.confidence } : null, layout: isRecord(node.raw?.chosenAnchor) ? { chosenAnchor: node.raw.chosenAnchor } : null }));
  const pureNodes = nodes.filter((node) => !["note", "annotation", "legend"].includes(node.objectType));
  const objects = nodes.map((node) => ({ id: node.id, type: node.objectType, title: node.label.text ?? node.id, target: node.annotationTarget ? { targetType: node.annotationTarget.targetType, targetId: node.annotationTarget.targetId } : undefined, visual: { shape: node.kind, style: node.style, fontSize: node.label.fontSize }, layout: isRecord(node.raw?.chosenAnchor) ? { chosenAnchor: node.raw.chosenAnchor } : undefined }));

  const direction = inferDirection(pureNodes);
  const laneMembership = new Map();
  laneContainers.forEach((lane) => lane.memberObjectIds.forEach((id) => laneMembership.set(id, lane.id)));
  const members = [...nodes].sort((a, b) => (direction === "LR" ? a.geometry.x - b.geometry.x : a.geometry.y - b.geometry.y)).map((node, index) => ({ objectId: node.id, laneId: laneMembership.get(node.id) ?? null, priority: index + 1, width: node.geometry.width, height: node.geometry.height }));

  const transformOutput = createEmptyTransformOutput({
    semanticDelta: {
      objects,
      relations,
      notes,
      groups: groupContainers.map((group) => ({
        id: group.id,
        title: group.title,
        memberObjectIds: group.memberObjectIds,
        sourceNodeId: group.sourceNodeId,
        confidence: group.confidence,
      })),
      lanes: laneContainers.map((lane) => ({
        id: lane.id,
        title: lane.title,
        memberObjectIds: lane.memberObjectIds,
        sourceNodeId: lane.sourceNodeId,
        confidence: lane.confidence,
      })),
    },
    viewDelta: {
      mode: "workbench",
      visibleObjectIds: nodes.map((node) => node.id),
      visibleRelationIds: relations.map((relation) => relation.id),
      primaryPath: [],
      direction,
    },
    mappingDelta: {
      objectToNode: nodes.map((node) => ({ objectId: node.id, nodeId: node.id, labelTextElementId: node.label.textElementId })),
      relationToEdge: relations.map((relation) => ({ relationId: relation.id, edgeId: relation.id })),
      groupToContainer: groupContainers.map((group) => ({ groupId: group.id, sourceNodeId: group.sourceNodeId })),
      laneToContainer: laneContainers.map((lane) => ({ laneId: lane.id, sourceNodeId: lane.sourceNodeId })),
    },
    visualDelta: {
      layoutPolicy: { direction, primarySpacingX: 240, primarySpacingY: 130, laneGap: 180, preferOrthogonal: true },
      readabilityHints: [],
      mechanismHints: [],
    },
    sceneProposal: {
      sourceType,
      totalElementCount: Array.isArray(elements) ? elements.length : 0,
      activeElementCount: activeElements.length,
    },
    ambiguities: [],
    warnings,
    conflicts: [],
    confidence: {
      overall: warnings.some((warning) => warning.severity === "error") ? "low" : warnings.length > 0 ? "medium" : "high",
    },
    recommendedAction: warnings.some((warning) => warning.severity === "error") ? "human-review" : "persist",
  });

  const transformValidation = validateTransformOutput(transformOutput);
  if (!transformValidation.ok) {
    throw new Error(`Reverse transform output failed runtime validation: ${JSON.stringify(transformValidation.errors)}`);
  }

  const commitResult = commitTransformResult({
    baseState: {},
    transformOutput,
    transformDirection: "reverse",
    mode: "workbench",
    truthSources: [{ type: "scene", sourceType, inputPath }],
    persistedArtifacts: [{ type: "domain-json", outputPath }],
    validationStatus: warnings.some((warning) => warning.severity === "error") ? "soft-fail" : "pass",
    nextRoundHint: warnings.some((warning) => warning.severity === "error") ? "human-review" : "continue",
  });
  if (!commitResult.ok) {
    throw new Error(`Reverse runtime commit failed at ${commitResult.stage}: ${JSON.stringify(commitResult.errors)}`);
  }

  const sharedStateSnapshot = commitResult.nextSnapshot;

  const domainJson = {
    version: "passto-desk-domain-json/v3",
    generatedAt: new Date().toISOString(),
    source: { inputPath, outputPath, sourceType },
    runtime: {
      transformDirection: "reverse",
      transformOutput,
      sharedStateSnapshot,
      validationResult: commitResult.validationResult,
      nextRoundDecision: commitResult.nextRoundDecision,
      mergedState: commitResult.mergedState,
    },
    semantic: { objects, relations, notes },
    view: {
      id: "main",
      kind: "flowchart",
      direction,
      lanes: laneContainers.map((lane) => ({ id: lane.id, title: lane.title, sourceNodeId: lane.sourceNodeId, confidence: lane.confidence })),
      groups: groupContainers.map((group) => ({ id: group.id, title: group.title, memberObjectIds: group.memberObjectIds, sourceNodeId: group.sourceNodeId, confidence: group.confidence })),
      members,
      visibleRelations: relations.map((relation) => relation.id),
    },
    mapping: {
      objectToNode: nodes.map((node) => ({ objectId: node.id, nodeId: node.id, labelTextElementId: node.label.textElementId })),
      relationToEdge: relations.map((relation) => ({ relationId: relation.id, edgeId: relation.id })),
      groupToContainer: groupContainers.map((group) => ({ groupId: group.id, sourceNodeId: group.sourceNodeId })),
      laneToContainer: laneContainers.map((lane) => ({ laneId: lane.id, sourceNodeId: lane.sourceNodeId })),
    },
    visual: {
      theme: appState.theme ?? null,
      palette: {},
      typography: { nodeFontSize: 20, edgeFontSize: 16 },
      layoutPolicy: { direction, primarySpacingX: 240, primarySpacingY: 130, laneGap: 180, preferOrthogonal: true },
    },
    scene: {
      totalElementCount: Array.isArray(elements) ? elements.length : 0,
      activeElementCount: activeElements.length,
      bounds: computeSceneBounds(activeElements),
      typeCounts: computeTypeCounts(activeElements),
      appState: { theme: appState.theme ?? null, viewBackgroundColor: appState.viewBackgroundColor ?? null, name: appState.name ?? null },
    },
    warnings,
    freeTexts,
    raw: {
      unmodeledElementIds: activeElements.map((element) => asString(element.id, "")).filter((id) => id && !nodeById.has(id) && !textElements.find((item) => asString(item.id, "") === id) && !relations.find((relation) => relation.id === id) && !containerIds.has(id)),
    },
    legacy: {
      nodes,
      edges: relations.map((relation) => ({
        id: relation.id,
        kind: "arrow",
        from: relation.from ? { elementId: relation.from, side: relation.visual.fromSide } : { elementId: null, side: null },
        to: relation.to ? { elementId: relation.to, side: relation.visual.toSide } : { elementId: null, side: null },
        label: relation.label ? { text: relation.label, textElementId: `${relation.id}-label`, binding: "bound", containerId: relation.id, fontSize: relation.visual.fontSize } : null,
        style: { strokeColor: relation.visual.strokeColor, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: relation.visual.strokeWidth, strokeStyle: relation.visual.strokeStyle, roughness: 0, opacity: 100, roundness: null },
      })),
    },
  };

  await writeFile(outputPath, JSON.stringify(domainJson, null, 2) + "\n", "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
