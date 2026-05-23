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
    "  node ./scripts/domain-json-to-excalidraw.mjs <input> [output]",
    "",
    "Input must be passto-desk-domain-json/v2 or v3.",
    "If output is omitted, the script writes <basename>.excalidraw next to the input file.",
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
  return path.join(dir, `${base}.excalidraw`);
}

function makeId(prefix, index) {
  return `${prefix}-${index}`;
}

function makeNonce(index) {
  return 100000000 + index * 7919;
}

function makeSeed(index) {
  return 200000000 + index * 1543;
}

function wrapText(text, maxCharsPerLine = 16) {
  const source = String(text ?? "").trim();
  if (!source) return "";
  const hardLines = source.split(/\r?\n/);
  const output = [];
  for (const hardLine of hardLines) {
    const line = hardLine.trim();
    if (!line) {
      output.push("");
      continue;
    }
    let current = "";
    for (const char of [...line]) {
      current += char;
      if ([...current].length >= maxCharsPerLine) {
        output.push(current);
        current = "";
      }
    }
    if (current) output.push(current);
  }
  return output.join("\n");
}

function estimateTextBox(text, opts = {}) {
  const fontSize = asNumber(opts.fontSize, 20);
  const minWidth = asNumber(opts.minWidth, 48);
  const maxWidth = asNumber(opts.maxWidth, 220);
  const lineHeight = asNumber(opts.lineHeight, 1.2);
  const lines = String(text ?? "").split("\n");
  const longest = Math.max(1, ...lines.map((line) => [...line].length));
  const width = Math.max(minWidth, Math.min(maxWidth, Math.ceil(longest * fontSize * 0.6 + 16)));
  const height = Math.max(24, Math.ceil(lines.length * fontSize * lineHeight + 8));
  return { width, height, lineCount: lines.length };
}

function normalizeNodeKind(kind, objectType) {
  if (kind === "rectangle" || kind === "diamond" || kind === "ellipse") return kind;
  switch (objectType) {
    case "decision":
      return "diamond";
    case "state":
      return "ellipse";
    case "note":
    case "annotation":
    case "legend":
      return "rectangle";
    default:
      return "rectangle";
  }
}

function normalizeDirection(value, fallback = "LR") {
  const raw = asString(value, fallback);
  if (!raw) return fallback;
  const normalized = raw.trim().toUpperCase();
  if (["LR", "RL", "LEFT_TO_RIGHT", "RIGHT", "LEFT", "HORIZONTAL"].includes(normalized)) return "LR";
  if (["TB", "BT", "TOP_TO_BOTTOM", "DOWN", "UP", "BOTTOM", "TOP", "VERTICAL"].includes(normalized)) return "TB";
  return fallback;
}

function sidePoint(node, side) {
  const geometry = isRecord(node.geometry) ? node.geometry : node;
  const x = asNumber(geometry.x);
  const y = asNumber(geometry.y);
  const width = asNumber(geometry.width);
  const height = asNumber(geometry.height);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  switch (side) {
    case "top":
      return { x: centerX, y };
    case "right":
      return { x: x + width, y: centerY };
    case "bottom":
      return { x: centerX, y: y + height };
    case "left":
    default:
      return { x, y: centerY };
  }
}

function relationMidpoint(edge, fromNode, toNode, direction) {
  const routed = routeEdge(edge, fromNode, toNode, direction, []);
  const points = Array.isArray(routed.points) ? routed.points : [[0, 0], [routed.width, routed.height]];
  const pivotIndex = points.length >= 3 ? 1 : Math.max(0, points.length - 1);
  const pivot = Array.isArray(points[pivotIndex]) ? points[pivotIndex] : [routed.width, routed.height];
  return {
    x: routed.x + asNumber(pivot[0]),
    y: routed.y + asNumber(pivot[1]),
  };
}

function overlaps(boxA, boxB, padding = 0) {
  return !(
    boxA.x + boxA.width + padding < boxB.x ||
    boxA.x > boxB.x + boxB.width + padding ||
    boxA.y + boxA.height + padding < boxB.y ||
    boxA.y > boxB.y + boxB.height + padding
  );
}

function boxDistance(boxA, boxB) {
  const dx = Math.max(0, Math.max(boxA.x - (boxB.x + boxB.width), boxB.x - (boxA.x + boxA.width)));
  const dy = Math.max(0, Math.max(boxA.y - (boxB.y + boxB.height), boxB.y - (boxA.y + boxA.height)));
  return Math.hypot(dx, dy);
}

function avoidOccupiedBox(candidate, occupied, preferredAxis = "y", options = {}) {
  const adjusted = { ...candidate };
  const padding = asNumber(options.padding, 8);
  const priorities = {
    node: 4,
    "edge-label": 3,
    annotation: 2,
    "title-zone": 1,
    unknown: 0,
  };
  const items = [...occupied].sort((a, b) => (priorities[asString(b.kind, "unknown")] ?? 0) - (priorities[asString(a.kind, "unknown")] ?? 0));
  for (const box of items) {
    if (!overlaps(adjusted, box, padding)) continue;
    if (preferredAxis === "x") {
      adjusted.x = box.x + box.width + 18;
    } else {
      adjusted.y = box.y + box.height + 18;
    }
  }
  return adjusted;
}

function resolveEdgeLabelAnchor(arrow, direction, layoutHints = null) {
  const preferredAnchor = isRecord(layoutHints?.anchor) ? layoutHints.anchor : null;
  if (preferredAnchor) {
    return {
      x: asNumber(preferredAnchor.x),
      y: asNumber(preferredAnchor.y),
    };
  }
  const points = Array.isArray(arrow.points) ? arrow.points : [];
  const routedMidpoint = isRecord(arrow.customData?.routingMidpoint) ? arrow.customData.routingMidpoint : null;
  if (routedMidpoint) {
    return {
      x: asNumber(routedMidpoint.x),
      y: asNumber(routedMidpoint.y),
    };
  }
  const pivotIndex = points.length >= 4 ? 2 : points.length >= 3 ? 1 : Math.max(0, points.length - 1);
  const pivot = Array.isArray(points[pivotIndex]) ? points[pivotIndex] : [asNumber(arrow.width) / 2, asNumber(arrow.height) / 2];
  let x = asNumber(arrow.x) + asNumber(pivot[0]);
  let y = asNumber(arrow.y) + asNumber(pivot[1]);
  if (direction === "LR" && points.length >= 4) y -= 8;
  if (direction === "TB" && points.length >= 4) x += 8;
  return { x, y };
}

function candidateAnnotationAnchorsForObjectTarget(targetNode, annotationNode, direction, preferredSide = null) {
  const targetX = asNumber(targetNode.geometry.x);
  const targetY = asNumber(targetNode.geometry.y);
  const targetWidth = asNumber(targetNode.geometry.width);
  const targetHeight = asNumber(targetNode.geometry.height);
  const noteWidth = asNumber(annotationNode.geometry.width);
  const noteHeight = asNumber(annotationNode.geometry.height);
  const candidatesBySide = {
    right: {
      x: targetX + targetWidth + 28,
      y: targetY + Math.max(0, (targetHeight - noteHeight) / 2),
      axis: "y",
      side: "right",
    },
    left: {
      x: targetX - noteWidth - 28,
      y: targetY + Math.max(0, (targetHeight - noteHeight) / 2),
      axis: "y",
      side: "left",
    },
    bottom: {
      x: targetX + Math.max(0, (targetWidth - noteWidth) / 2),
      y: targetY + targetHeight + 28,
      axis: "x",
      side: "bottom",
    },
    top: {
      x: targetX + Math.max(0, (targetWidth - noteWidth) / 2),
      y: targetY - noteHeight - 28,
      axis: "x",
      side: "top",
    },
  };
  const baseOrder = direction === "TB" ? ["bottom", "right", "left", "top"] : ["right", "bottom", "top", "left"];
  const order = preferredSide && baseOrder.includes(preferredSide) ? [preferredSide, ...baseOrder.filter((side) => side !== preferredSide)] : baseOrder;
  return order.map((side) => candidatesBySide[side]);
}

function candidateAnnotationAnchorsForRelationTarget(midpoint, annotationNode, direction, preferredSide = null) {
  const noteWidth = asNumber(annotationNode.geometry.width);
  const noteHeight = asNumber(annotationNode.geometry.height);
  const candidatesBySide = {
    right: { x: midpoint.x + 24, y: midpoint.y - noteHeight / 2, axis: "y", side: "right" },
    left: { x: midpoint.x - noteWidth - 24, y: midpoint.y - noteHeight / 2, axis: "y", side: "left" },
    top: { x: midpoint.x - noteWidth / 2, y: midpoint.y - noteHeight - 20, axis: "x", side: "top" },
    bottom: { x: midpoint.x - noteWidth / 2, y: midpoint.y + 20, axis: "x", side: "bottom" },
  };
  const baseOrder = direction === "TB" ? ["right", "bottom", "top", "left"] : ["top", "right", "left", "bottom"];
  const order = preferredSide && baseOrder.includes(preferredSide) ? [preferredSide, ...baseOrder.filter((side) => side !== preferredSide)] : baseOrder;
  return order.map((side) => candidatesBySide[side]);
}

function anchorReferencePoint(candidate, geometry) {
  return {
    x: asNumber(candidate.x) + asNumber(geometry.width) / 2,
    y: asNumber(candidate.y) + asNumber(geometry.height) / 2,
  };
}

function inferAnchorSide(anchor, geometry, targetPoint) {
  if (!targetPoint) return null;
  const center = anchorReferencePoint(anchor, geometry);
  const dx = center.x - asNumber(targetPoint.x);
  const dy = center.y - asNumber(targetPoint.y);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
}

function chooseBestAnchor(candidates, occupied, geometry, targetPoint = null) {
  const evaluated = candidates.map((candidate) => {
    const box = { x: candidate.x, y: candidate.y, width: geometry.width, height: geometry.height };
    const overlapCount = occupied.filter((item) => overlaps(box, item, 10)).length;
    const minDistance = occupied.length > 0 ? Math.min(...occupied.map((item) => boxDistance(box, item))) : Infinity;
    const reference = anchorReferencePoint(candidate, geometry);
    const targetDistance = targetPoint ? Math.hypot(reference.x - asNumber(targetPoint.x), reference.y - asNumber(targetPoint.y)) : 0;
    return { candidate, overlapCount, minDistance, targetDistance };
  });
  evaluated.sort((a, b) => a.overlapCount - b.overlapCount || a.targetDistance - b.targetDistance || b.minDistance - a.minDistance);
  return evaluated[0]?.candidate ?? candidates[0] ?? null;
}

function shiftBox(box, axis, delta) {
  return axis === "x" ? { ...box, x: box.x + delta } : { ...box, y: box.y + delta };
}

function tryAxisOffsets(baseBox, occupied, axis, deltas, padding = 8) {
  for (const delta of deltas) {
    const candidate = shiftBox(baseBox, axis, delta);
    const collides = occupied.some((item) => overlaps(candidate, item, padding));
    if (!collides) return candidate;
  }
  return null;
}

function resolveEdgeLabelAndAnnotationCollision(labelBox, annotationBoxes = []) {
  if (!labelBox) return null;
  const adjusted = { ...labelBox };
  for (const box of annotationBoxes) {
    if (!overlaps(adjusted, box, 6)) continue;
    adjusted.y = box.y - adjusted.height - 12;
  }
  return adjusted;
}

function placeAnnotationNearTarget(node, object, nodesById, relationsById, direction, occupied) {
  const targetType = asString(object.target?.targetType);
  const targetId = asString(object.target?.targetId);
  if (!targetType || !targetId) return node;

  let anchor = null;
  let targetPoint = null;
  const preferredSide = asString(object.layout?.chosenAnchor?.side, asString(object.raw?.chosenAnchor?.side, null));
  const preferredAnchorMeta = isRecord(object.layout?.chosenAnchor) ? object.layout.chosenAnchor : isRecord(object.raw?.chosenAnchor) ? object.raw.chosenAnchor : null;
  if (targetType === "object") {
    const targetNode = nodesById.get(targetId);
    if (targetNode) {
      const candidates = candidateAnnotationAnchorsForObjectTarget(targetNode, node, direction, preferredSide);
      targetPoint = {
        x: asNumber(targetNode.geometry.x) + asNumber(targetNode.geometry.width) / 2,
        y: asNumber(targetNode.geometry.y) + asNumber(targetNode.geometry.height) / 2,
      };
      anchor = chooseBestAnchor(candidates, occupied, {
        width: asNumber(node.geometry.width),
        height: asNumber(node.geometry.height),
      }, targetPoint);
    }
  }

  if (targetType === "relation") {
    const relation = relationsById.get(targetId);
    if (relation) {
      const fromNode = nodesById.get(asString(relation.from?.elementId, ""));
      const toNode = nodesById.get(asString(relation.to?.elementId, ""));
      if (fromNode && toNode) {
        const midpoint = relationMidpoint(relation, fromNode, toNode, direction);
        const candidates = candidateAnnotationAnchorsForRelationTarget(midpoint, node, direction, preferredSide);
        targetPoint = midpoint;
        anchor = chooseBestAnchor(candidates, occupied, {
          width: asNumber(node.geometry.width),
          height: asNumber(node.geometry.height),
        }, targetPoint);
      }
    }
  }

  if (!anchor) return node;
  const candidate = { x: anchor.x, y: anchor.y, width: asNumber(node.geometry.width), height: asNumber(node.geometry.height) };
  const adjusted = avoidOccupiedBox(candidate, occupied, anchor.axis, { padding: 10 });
  return {
    ...node,
    raw: {
      ...(isRecord(node.raw) ? node.raw : {}),
      chosenAnchor: {
        axis: anchor.axis,
        side: inferAnchorSide(anchor, { width: asNumber(node.geometry.width), height: asNumber(node.geometry.height) }, targetPoint),
        x: anchor.x,
        y: anchor.y,
        targetType,
        targetId,
        source: preferredAnchorMeta && preferredSide === anchor.side ? "reused" : "inferred",
        confidence: preferredAnchorMeta && preferredSide === anchor.side ? asString(preferredAnchorMeta.confidence, "reused") : "inferred",
      },
    },
    geometry: {
      ...node.geometry,
      x: adjusted.x,
      y: adjusted.y,
      centerX: adjusted.x + asNumber(node.geometry.width) / 2,
      centerY: adjusted.y + asNumber(node.geometry.height) / 2,
    },
  };
}

function defaultPaletteForType(objectType) {
  switch (objectType) {
    case "decision":
      return { strokeColor: "#8a6700", backgroundColor: "#fff4cc" };
    case "state":
      return { strokeColor: "#0b6e4f", backgroundColor: "#eaf7ea" };
    case "note":
      return { strokeColor: "#8a6d00", backgroundColor: "#fff8db" };
    case "annotation":
      return { strokeColor: "#8a6d00", backgroundColor: "#fff8db" };
    case "legend":
      return { strokeColor: "#475569", backgroundColor: "#f8fafc" };
    case "group":
      return { strokeColor: "#4b5563", backgroundColor: "#f3f4f6" };
    default:
      return { strokeColor: "#1e1e1e", backgroundColor: "#e8f0fe" };
  }
}

/** Normalize bounding box: ensure x, y, width, height are always positive */
function normalizeBBox(startX, startY, points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    const px = p[0], py = p[1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const shiftedPoints = points.map(p => [p[0] - minX, p[1] - minY]);
  return {
    x: startX + minX,
    y: startY + minY,
    width: maxX - minX,
    height: maxY - minY,
    points: shiftedPoints,
  };
}

function routeEdge(edge, fromNode, toNode, direction, occupied = []) {
  const fromSide = asString(edge.from?.side, direction === "LR" ? "right" : "bottom");
  const toSide = asString(edge.to?.side, direction === "LR" ? "left" : "top");
  const start = sidePoint(fromNode, fromSide);
  const end = sidePoint(toNode, toSide);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const elbowed = edge.elbowed === true || (direction === "LR" ? Math.abs(dy) > 8 : Math.abs(dx) > 8);
  if (!elbowed) {
    return normalizeBBox(start.x, start.y, [[0, 0], [dx, dy]]);
  }

  const fromId = edge.from?.elementId ?? "";
  const toId = edge.to?.elementId ?? "";

  if (direction === "LR") {
    if (dx <= 0) {
      const raw = normalizeBBox(start.x, start.y, [[0, 0], [0, dy], [dx, dy]]);
      return { ...raw, elbowed: true };
    }
    let step = Math.max(40, Math.min(120, Math.round(dx * 0.2)));
    const maxStep = Math.round(dx * 0.6);

    for (const box of occupied) {
      if (box.id === fromId || box.id === toId) continue;
      const bandY = start.y + dy / 2;
      const hitsBand = bandY >= box.y - 8 && bandY <= box.y + box.height + 8;
      const crossesX = start.x <= box.x + box.width && end.x >= box.x;
      if (hitsBand && crossesX) {
        const needed = box.x + box.width + 36 - start.x;
        if (needed > step && needed < dx && needed <= maxStep) step = needed;
      }
    }
    if (step > dx) step = dx;
    const raw4 = normalizeBBox(start.x, start.y, [[0, 0], [step, 0], [step, dy], [dx, dy]]);
    return { ...raw4, elbowed: true };
  }

  if (dy <= 0) {
    const rawTB = normalizeBBox(start.x, start.y, [[0, 0], [dx, 0], [dx, dy]]);
    return { ...rawTB, elbowed: true };
  }
  let step = Math.max(40, Math.min(120, Math.round(dy * 0.2)));
  const maxStep = Math.round(dy * 0.6);

  for (const box of occupied) {
    if (box.id === fromId || box.id === toId) continue;
    const bandX = start.x + dx / 2;
    const hitsBand = bandX >= box.x - 8 && bandX <= box.x + box.width + 8;
    const crossesY = start.y <= box.y + box.height && end.y >= box.y;
    if (hitsBand && crossesY) {
      const needed = box.y + box.height + 36 - start.y;
      if (needed > step && needed < dy && needed <= maxStep) step = needed;
    }
  }
  if (step > dy) step = dy;
  const rawTB2 = normalizeBBox(start.x, start.y, [[0, 0], [0, step], [dx, step], [dx, dy]]);
  return { ...rawTB2, elbowed: true };
}

/**
 * Layout nodes using GLOBAL column alignment, not per-lane independent positions.
 * All nodes are ordered by global priority. Their X position = column * spacing,
 * where column = global order index. This ensures arrows between prior N and N+1
 * always have dx > 0 (forward arrows).
 * Y position = lane position, with lane heights computed dynamically.
 */
function layoutFlowNodes(objects, members, laneDefs, direction, layoutPolicy) {
  const laneIdOrder = laneDefs.map((lane, index) => asString(lane.id, `lane-${index + 1}`));
  const laneIndexById = new Map(laneIdOrder.map((id, index) => [id, index]));
  const primarySpacingX = asNumber(layoutPolicy.primarySpacingX, 280);
  const laneGap = asNumber(layoutPolicy.laneGap, 80);
  const noteOffsetX = asNumber(layoutPolicy.noteOffsetX, 220);
  const noteOffsetY = asNumber(layoutPolicy.noteOffsetY, 110);
  const startX = 120;
  const startY = 120;
  const membersByLane = new Map();

  for (const member of members) {
    const laneId = asString(member.laneId, laneIdOrder[0] ?? "default");
    const list = membersByLane.get(laneId) ?? [];
    list.push(member);
    membersByLane.set(laneId, list);
  }
  for (const list of membersByLane.values()) {
    list.sort((a, b) => asNumber(a.priority, 0) - asNumber(b.priority, 0));
  }

  // Compute max node height per lane for dynamic Y positioning
  const laneMaxHeights = {};
  laneIdOrder.forEach((laneId) => {
    const list = membersByLane.get(laneId) ?? [];
    let maxH = 88;
    list.forEach((member) => {
      const object = objects.get(asString(member.objectId, "")) ?? member;
      const title = asString(object.title, asString(object.name, asString(object.label, asString(object.id, ""))));
      const isAux = ["note", "annotation", "legend"].includes(asString(object.type, ""));
      const maxChars = asNumber(object.visual?.maxCharsPerLine, isAux ? 24 : 14);
      const wrapped = wrapText(title, maxChars);
      const fontSize = asNumber(object.visual?.fontSize, 20);
      const textMetrics = estimateTextBox(wrapped, { fontSize, maxWidth: isAux ? 320 : 190 });
      const h = Math.max(asNumber(member.height, isAux ? 120 : 88), textMetrics.height + 28);
      if (h > maxH) maxH = h;
    });
    laneMaxHeights[laneId] = maxH;
  });

  // Dynamic lane Y: each lane starts after previous lane's tallest node + gap
  const laneStartY = {};
  let currentY = startY;
  laneIdOrder.forEach((laneId, idx) => {
    laneStartY[laneId] = currentY;
    if (idx < laneIdOrder.length - 1) {
      currentY += laneMaxHeights[laneId] + laneGap;
    }
  });

  // Global priority-based column order for X positioning
  const globalSorted = [...members].sort((a, b) => asNumber(a.priority, 0) - asNumber(b.priority, 0));
  const globalIndexByObjectId = new Map();
  globalSorted.forEach((member, idx) => {
    globalIndexByObjectId.set(asString(member.objectId, ""), idx);
  });

  return members.map((member, index) => {
    const object = objects.get(asString(member.objectId, "")) ?? member;
    const laneId = asString(member.laneId, laneIdOrder[0] ?? "default");
    const laneIndex = laneIndexById.get(laneId) ?? 0;
    const title = asString(object.title, asString(object.name, asString(object.label, asString(object.id, `Object ${index + 1}`))));
    const isAux = ["note", "annotation", "legend"].includes(asString(object.type, ""));
    const maxChars = asNumber(object.visual?.maxCharsPerLine, isAux ? 24 : 14);
    const wrapped = wrapText(title, maxChars);
    const fontSize = asNumber(object.visual?.fontSize, 20);
    const textMetrics = estimateTextBox(wrapped, { fontSize, maxWidth: isAux ? 320 : 190 });
    const width = Math.max(asNumber(member.width, isAux ? 260 : 180), textMetrics.width + 28);
    const height = Math.max(asNumber(member.height, isAux ? 120 : 88), textMetrics.height + 28);

    // X = global column position * primarySpacingX (all lanes share the same column grid)
    const globalPos = globalIndexByObjectId.get(asString(object.id, "")) ?? index;
    let x = startX + globalPos * primarySpacingX;
    // Y = dynamic lane start position
    let y = laneStartY[laneId] ?? startY + laneIndex * (180 + laneGap);

    if (object.type === "note") {
      x += direction === "LR" ? 0 : noteOffsetX;
      y += direction === "LR" ? noteOffsetY : 0;
    }
    if (object.type === "annotation") {
      x += direction === "LR" ? primarySpacingX / 2 : noteOffsetX;
      y += direction === "LR" ? noteOffsetY : 0;
    }

    const raw = { semanticObjectId: asString(object.id), laneId };
    if (object.type === "annotation") {
      const targetType = asString(object.target?.targetType);
      const targetId = asString(object.target?.targetId);
      if (targetType && targetId) {
        raw.annotationTargetType = targetType;
        raw.annotationTargetId = targetId;
      }
    }

    return {
      id: asString(object.id, makeId("node", index + 1)),
      objectType: asString(object.type, "action"),
      kind: normalizeNodeKind(asString(object.visual?.shape), asString(object.type)),
      geometry: { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2, angle: 0 },
      label: {
        text: title,
        textElementId: `${asString(object.id, makeId("node", index + 1))}-label`,
        binding: "bound",
        containerId: asString(object.id, makeId("node", index + 1)),
        fontSize,
        maxCharsPerLine: maxChars,
      },
      style: {
        ...defaultPaletteForType(asString(object.type)),
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: object.type === "annotation" || object.type === "group" ? "dashed" : "solid",
        roughness: 0,
        opacity: 100,
        roundness: { type: 3 },
        ...(isRecord(object.visual?.style) ? object.visual.style : {}),
      },
      raw,
    };
  });
}

function buildLaneFrames(nodes, laneDefs, direction) {
  if (!Array.isArray(laneDefs) || laneDefs.length === 0 || nodes.length === 0) return [];
  const laneNodes = new Map();
  for (const lane of laneDefs) laneNodes.set(asString(lane.id, ""), []);
  for (const node of nodes) {
    const laneId = asString(node.raw?.laneId, "");
    if (!laneNodes.has(laneId)) continue;
    if (["note", "annotation", "legend"].includes(asString(node.objectType, ""))) continue;
    laneNodes.get(laneId).push(node);
  }
  const frames = [];
  laneDefs.forEach((lane, index) => {
    const laneId = asString(lane.id, `lane-${index + 1}`);
    const list = laneNodes.get(laneId) ?? [];
    if (list.length === 0) return;
    const minX = Math.min(...list.map((node) => asNumber(node.geometry.x)));
    const minY = Math.min(...list.map((node) => asNumber(node.geometry.y)));
    const maxX = Math.max(...list.map((node) => asNumber(node.geometry.x) + asNumber(node.geometry.width)));
    const maxY = Math.max(...list.map((node) => asNumber(node.geometry.y) + asNumber(node.geometry.height)));
    const gap = direction === "TB" ? 24 : 40;
    frames.push({
      id: `lane-frame-${laneId}`,
      laneId,
      title: asString(lane.title, laneId),
      geometry: {
        x: minX - gap,
        y: minY - gap,
        width: maxX - minX + gap * 2,
        height: maxY - minY + gap * 2,
      },
      style: {
        strokeColor: "#cbd5e1",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        roundness: { type: 3 },
      },
      label: { text: asString(lane.title, laneId), textElementId: `lane-frame-${laneId}-label`, fontSize: 18 },
      raw: { containerRole: "lane", sourceLaneId: laneId },
    });
  });
  return frames;
}

function buildGroupContainers(groupDefs, memberNodeMap) {
  if (!Array.isArray(groupDefs) || groupDefs.length === 0) return [];
  const containers = [];
  groupDefs.forEach((group, index) => {
    if (!isRecord(group)) return;
    const memberIds = Array.isArray(group.memberObjectIds) ? group.memberObjectIds.map((item) => asString(item, "")).filter(Boolean) : [];
    const nodes = memberIds.map((id) => memberNodeMap.get(id)).filter(Boolean);
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map((node) => asNumber(node.geometry.x)));
    const minY = Math.min(...nodes.map((node) => asNumber(node.geometry.y)));
    const maxX = Math.max(...nodes.map((node) => asNumber(node.geometry.x) + asNumber(node.geometry.width)));
    const maxY = Math.max(...nodes.map((node) => asNumber(node.geometry.y) + asNumber(node.geometry.height)));
    containers.push({
      id: asString(group.id, `group-${index + 1}`),
      title: asString(group.title, asString(group.id, `Group ${index + 1}`)),
      geometry: { x: minX - 20, y: minY - 20, width: maxX - minX + 40, height: maxY - minY + 40 },
      style: {
        strokeColor: "#94a3b8",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "dashed",
        roughness: 0,
        opacity: 100,
        roundness: { type: 3 },
      },
      label: { text: asString(group.title, ""), textElementId: `${asString(group.id, `group-${index + 1}`)}-label`, fontSize: 18 },
      raw: { containerRole: "group", sourceGroupId: asString(group.id, `group-${index + 1}`) },
    });
  });
  return containers;
}

function makeShapeElement(node, index) {
  const kind = normalizeNodeKind(asString(node.kind, "rectangle"), asString(node.objectType));
  const x = asNumber(node.geometry?.x);
  const y = asNumber(node.geometry?.y);
  const width = asNumber(node.geometry?.width, 180);
  const height = asNumber(node.geometry?.height, 88);
  const palette = defaultPaletteForType(asString(node.objectType));
  return {
    id: asString(node.id, makeId("node", index)),
    type: kind,
    x,
    y,
    width,
    height,
    angle: asNumber(node.geometry?.angle),
    strokeColor: node.style?.strokeColor ?? palette.strokeColor,
    backgroundColor: node.style?.backgroundColor ?? palette.backgroundColor,
    fillStyle: node.style?.fillStyle ?? "solid",
    strokeWidth: node.style?.strokeWidth ?? 1,
    strokeStyle: node.style?.strokeStyle ?? "solid",
    roughness: node.style?.roughness ?? 0,
    opacity: node.style?.opacity ?? 100,
    groupIds: Array.isArray(node.groupIds) ? node.groupIds : [],
    frameId: node.frameId ?? null,
    roundness: node.style?.roundness ?? (kind === "rectangle" ? { type: 3 } : null),
    seed: makeSeed(index),
    version: 1,
    versionNonce: makeNonce(index),
    isDeleted: false,
    boundElements: [],
    updated: 1,
    link: node.link ?? null,
    locked: node.locked === true,
    customData: isRecord(node.raw) ? node.raw : undefined,
  };
}

function makeBoundTextElement(node, container, index) {
  const wrapped = wrapText(asString(node.label?.text, "") ?? "", asNumber(node.label?.maxCharsPerLine, 14));
  const metrics = estimateTextBox(wrapped, { fontSize: asNumber(node.label?.fontSize, 20), maxWidth: Math.max(80, asNumber(container.width) - 20) });
  let x = asNumber(container.x) + (asNumber(container.width) - metrics.width) / 2;
  let y = asNumber(container.y) + (asNumber(container.height) - metrics.height) / 2;
  if (node.raw?.containerRole === "lane" || node.raw?.containerRole === "group") {
    x = asNumber(container.x) + 12;
    y = asNumber(container.y) + 8;
  }
  return {
    id: asString(node.label?.textElementId, makeId("label", index)),
    type: "text",
    x,
    y,
    width: metrics.width,
    height: metrics.height,
    angle: 0,
    strokeColor: node.label?.strokeColor ?? container.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: makeSeed(index + 1000),
    version: 1,
    versionNonce: makeNonce(index + 1000),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text: wrapped,
    fontSize: asNumber(node.label?.fontSize, 20),
    fontFamily: 6,
    textAlign: node.raw?.containerRole === "lane" || node.raw?.containerRole === "group" ? "left" : asString(node.label?.textAlign, "center"),
    verticalAlign: "middle",
    baseline: Math.ceil(asNumber(node.label?.fontSize, 20) * 0.9),
    containerId: container.id,
    originalText: wrapped,
    lineHeight: asNumber(node.label?.lineHeight, 1.2),
  };
}

function makeArrowElement(edge, fromNode, toNode, direction, occupied, index) {
  const routed = routeEdge(edge, fromNode, toNode, direction, occupied);
  return {
    id: asString(edge.id, makeId("edge", index)),
    type: "arrow",
    x: routed.x,
    y: routed.y,
    width: routed.width,
    height: routed.height,
    angle: 0,
    strokeColor: edge.style?.strokeColor ?? "#1e1e1e",
    backgroundColor: edge.style?.backgroundColor ?? "transparent",
    fillStyle: edge.style?.fillStyle ?? "solid",
    strokeWidth: edge.style?.strokeWidth ?? 1,
    strokeStyle: edge.style?.strokeStyle ?? "solid",
    roughness: edge.style?.roughness ?? 0,
    opacity: edge.style?.opacity ?? 100,
    groupIds: [],
    frameId: null,
    roundness: edge.style?.roundness ?? null,
    seed: makeSeed(index + 2000),
    version: 1,
    versionNonce: makeNonce(index + 2000),
    isDeleted: false,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    startArrowhead: null,
    endArrowhead: "arrow",
    points: routed.points,
    startBinding: { elementId: fromNode.id, focus: 0, gap: 1, fixedPoint: null },
    endBinding: { elementId: toNode.id, focus: 0, gap: 1, fixedPoint: null },
    elbowed: routed.elbowed,
    customData: isRecord(edge.raw) ? edge.raw : undefined,
  };
}

function makeEdgeLabelElement(edge, arrow, occupiedLabels, index, annotationBoxes = [], direction = "LR") {
  const labelText = asString(edge.label?.text);
  if (!labelText) return null;
  const wrapped = wrapText(labelText, asNumber(edge.label?.maxCharsPerLine, 10));
  const metrics = estimateTextBox(wrapped, { fontSize: asNumber(edge.label?.fontSize, 16), maxWidth: 180 });
  const layoutHints = isRecord(edge.visual?.layout) ? edge.visual.layout : null;
  const anchor = resolveEdgeLabelAnchor(arrow, direction, layoutHints);
  let x = asNumber(anchor.x) - metrics.width / 2;
  let y = asNumber(anchor.y) - metrics.height / 2 - (direction === "TB" ? 6 : 10);
  const baseBox = { x, y, width: metrics.width, height: metrics.height };
  const combinedOccupied = [...occupiedLabels, ...annotationBoxes];
  const primaryAxis = asString(layoutHints?.offsetStrategy?.primaryAxis, direction === "TB" ? "x" : "y");
  const secondaryAxis = asString(layoutHints?.offsetStrategy?.secondaryAxis, primaryAxis === "x" ? "y" : "x");
  const primaryAttempt = tryAxisOffsets(baseBox, combinedOccupied, primaryAxis, [0, 18, -18, 36, -36], 6);
  const resolvedPrimary = primaryAttempt ?? baseBox;
  const secondaryAttempt = tryAxisOffsets(resolvedPrimary, combinedOccupied, secondaryAxis, [0, 14, -14, 28, -28], 6);
  const resolved = resolveEdgeLabelAndAnnotationCollision(secondaryAttempt ?? resolvedPrimary, annotationBoxes);
  x = resolved?.x ?? x;
  y = resolved?.y ?? y;
  return {
    id: asString(edge.label?.textElementId, makeId("edge-label", index)),
    type: "text",
    x,
    y,
    width: metrics.width,
    height: metrics.height,
    angle: 0,
    strokeColor: edge.label?.strokeColor ?? arrow.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: makeSeed(index + 3000),
    version: 1,
    versionNonce: makeNonce(index + 3000),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text: wrapped,
    fontSize: asNumber(edge.label?.fontSize, 16),
    fontFamily: 6,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: Math.ceil(asNumber(edge.label?.fontSize, 16) * 0.9),
    containerId: arrow.id,
    originalText: wrapped,
    lineHeight: asNumber(edge.label?.lineHeight, 1.2),
    customData: {
      anchor: {
        x: asNumber(anchor.x),
        y: asNumber(anchor.y),
        direction,
      },
      offsetStrategy: {
        primaryAxis,
        secondaryAxis,
      },
    },
  };
}

function buildContainerNode(container) {
  return {
    id: container.id,
    objectType: "group",
    kind: "rectangle",
    geometry: {
      x: asNumber(container.geometry.x),
      y: asNumber(container.geometry.y),
      width: asNumber(container.geometry.width),
      height: asNumber(container.geometry.height),
      centerX: asNumber(container.geometry.x) + asNumber(container.geometry.width) / 2,
      centerY: asNumber(container.geometry.y) + asNumber(container.geometry.height) / 2,
      angle: 0,
    },
    label: { text: asString(container.label?.text, ""), textElementId: asString(container.label?.textElementId, `${container.id}-label`), binding: "bound", containerId: container.id, fontSize: asNumber(container.label?.fontSize, 18), maxCharsPerLine: 18 },
    style: container.style,
    raw: container.raw ?? { containerRole: "layout" },
  };
}

function buildV3(parsed) {
  const semantic = isRecord(parsed.semantic) ? parsed.semantic : {};
  const rawObjects = Array.isArray(semantic.objects) ? semantic.objects.filter(isRecord) : [];
  const rawRelations = Array.isArray(semantic.relations) ? semantic.relations.filter(isRecord) : [];
  const rawNotes = Array.isArray(semantic.notes) ? semantic.notes.filter(isRecord) : [];
  const view = isRecord(parsed.view) ? parsed.view : {};
  const visual = isRecord(parsed.visual) ? parsed.visual : {};
  const rawMapping = isRecord(parsed.mapping) ? parsed.mapping : {};
  const layoutPolicy = isRecord(visual.layoutPolicy) ? visual.layoutPolicy : {};
  const direction = normalizeDirection(asString(view.direction, asString(layoutPolicy.direction, "LR")), "LR");
  const laneDefs = Array.isArray(view.lanes) ? view.lanes.filter(isRecord) : [];
  const explicitGroupDefs = Array.isArray(view.groups) ? view.groups.filter(isRecord) : [];
  const groupObjectIds = new Set(explicitGroupDefs.map((g) => asString(g.id, "")).filter(Boolean));
  const memberDefs = Array.isArray(view.members) ? view.members.filter(isRecord) : [];
  const visualNodes = Array.isArray(visual.nodes) ? visual.nodes.filter(isRecord) : [];
  const visualEdges = Array.isArray(visual.edges) ? visual.edges.filter(isRecord) : [];
  const visualCallouts = Array.isArray(visual.callouts) ? visual.callouts.filter(isRecord) : [];
  const objectToNodeMapping = isRecord(rawMapping.objectToNode) ? rawMapping.objectToNode : null;
  const visualNodeById = new Map(visualNodes.map((node) => [asString(node.id, ""), node]).filter(([id]) => id));
  const objectIdByVisualNodeId = new Map();
  if (objectToNodeMapping) {
    for (const [objectId, nodeId] of Object.entries(objectToNodeMapping)) {
      const normalizedObjectId = asString(objectId, "");
      const normalizedNodeId = asString(nodeId, "");
      if (normalizedObjectId && normalizedNodeId) {
        objectIdByVisualNodeId.set(normalizedNodeId, normalizedObjectId);
      }
    }
  }

  const objects = rawObjects
    .filter((object) => !groupObjectIds.has(asString(object.id, "")))
    .map((object, index) => {
    const objectId = asString(object.id, `object-${index + 1}`);
    const mappedVisualNodeId = objectToNodeMapping ? asString(objectToNodeMapping[objectId], null) : null;
    const visualNode = (mappedVisualNodeId && visualNodeById.get(mappedVisualNodeId)) || visualNodeById.get(objectId) || null;
    return {
      ...object,
      id: objectId,
      title: asString(object.title, asString(object.name, asString(visualNode?.label, asString(object.label, objectId)))),
      visual: isRecord(object.visual) ? object.visual : {},
    };
  });

  const legacyMembers = visualNodes
    .map((node, index) => {
      const visualNodeId = asString(node.id, "");
      const objectId = objectIdByVisualNodeId.get(visualNodeId);
      if (!objectId) return null;
      return {
        objectId,
        laneId: asString(node.laneId, null),
        groupId: asString(node.groupId, null),
        priority: index + 1,
      };
    })
    .filter(Boolean);

  const baseMembers = memberDefs.length > 0
    ? memberDefs
    : legacyMembers.length > 0
      ? legacyMembers
      : objects.map((object, index) => ({ objectId: asString(object.id, `object-${index + 1}`), priority: index + 1 }));

  const derivedGroupMembers = new Map();
  for (const member of legacyMembers) {
    const groupId = asString(member.groupId, "");
    if (!groupId) continue;
    const list = derivedGroupMembers.get(groupId) ?? [];
    list.push(asString(member.objectId, ""));
    derivedGroupMembers.set(groupId, list);
  }

  const groupDefs = explicitGroupDefs.length > 0
    ? explicitGroupDefs.map((group, index) => {
        const groupId = asString(group.id, `group-${index + 1}`);
        const explicitMembers = Array.isArray(group.memberObjectIds) ? group.memberObjectIds.map((item) => asString(item, "")).filter(Boolean) : [];
        return {
          ...group,
          id: groupId,
          title: asString(group.title, groupId),
          memberObjectIds: explicitMembers.length > 0 ? explicitMembers : (derivedGroupMembers.get(groupId) ?? []),
        };
      })
    : [...derivedGroupMembers.entries()].map(([groupId, memberObjectIds]) => ({ id: groupId, title: groupId, memberObjectIds }));

  const calloutObjects = visualCallouts.map((callout, index) => {
    const note = rawNotes[index] ?? {};
    const calloutId = asString(callout.id, asString(note.id, `callout-${index + 1}`));
    const targetVisualNodeId = asString(callout.targetId, null);
    const targetObjectId = targetVisualNodeId ? objectIdByVisualNodeId.get(targetVisualNodeId) ?? targetVisualNodeId : null;
    return {
      id: calloutId,
      type: "annotation",
      title: asString(callout.text, asString(note.text, calloutId)),
      target: targetObjectId ? { targetType: "object", targetId: targetObjectId } : undefined,
      visual: {},
      __derivedFromCallout: true,
    };
  });

  const standaloneNoteObjects = visualCallouts.length === 0
    ? rawNotes.map((note, index) => ({
        id: asString(note.id, `note-${index + 1}`),
        type: asString(note.type, "note"),
        title: asString(note.title, asString(note.text, asString(note.id, `note-${index + 1}`))),
        visual: {},
      }))
    : [];

  const supplementalObjects = [...calloutObjects, ...standaloneNoteObjects].filter((object) => !objects.find((item) => asString(item.id, "") === asString(object.id, "")));
  const allObjects = [...objects, ...supplementalObjects];

  const objectById = new Map(allObjects.map((item) => [asString(item.id, ""), item]));
  const targetMemberByObjectId = new Map(baseMembers.map((member) => [asString(member.objectId, ""), member]));
  const nextPriority = baseMembers.reduce((maxValue, member) => Math.max(maxValue, asNumber(member.priority, 0)), 0);
  const supplementalMembers = supplementalObjects.map((object, index) => {
    const targetId = asString(object.target?.targetId, "");
    const targetMember = targetId ? targetMemberByObjectId.get(targetId) : null;
    return {
      objectId: asString(object.id, `supplemental-${index + 1}`),
      laneId: asString(targetMember?.laneId, null),
      priority: nextPriority + index + 1,
    };
  });
  const viewMembers = [...baseMembers, ...supplementalMembers];

  const normalizedRelations = rawRelations.map((relation, index) => {
    const visualEdge = visualEdges[index] ?? null;
    const relationId = asString(relation.id, asString(visualEdge?.id, makeId("edge", index + 1)));
    const relationVisual = isRecord(relation.visual) ? relation.visual : {};
    const edgeLabel = asString(relation.label, asString(visualEdge?.label, asString(relation.condition, asString(visualEdge?.condition, null))));
    return {
      ...relation,
      id: relationId,
      from: asString(relation.from, asString(visualEdge?.from, "")),
      to: asString(relation.to, asString(visualEdge?.to, "")),
      label: edgeLabel,
      visual: {
        ...relationVisual,
        strokeColor: relationVisual.strokeColor ?? visualEdge?.strokeColor ?? "#1e1e1e",
        strokeWidth: relationVisual.strokeWidth ?? visualEdge?.strokeWidth ?? 1,
        strokeStyle: relationVisual.strokeStyle ?? visualEdge?.strokeStyle ?? "solid",
        elbowed: relationVisual.elbowed === true || visualEdge?.elbowed === true,
      },
    };
  });

  const explicitVisibleRelationIds = Array.isArray(view.visibleRelations)
    ? view.visibleRelations.map((item) => asString(item, "")).filter(Boolean)
    : [];
  const visibleRelationIds = new Set(explicitVisibleRelationIds.length > 0 ? explicitVisibleRelationIds : normalizedRelations.map((relation) => asString(relation.id, "")).filter(Boolean));

  let nodes = layoutFlowNodes(objectById, viewMembers, laneDefs, direction, {
    ...layoutPolicy,
    primarySpacingX: asNumber(layoutPolicy.primarySpacingX, 280),
    laneGap: asNumber(layoutPolicy.laneGap, 80),
    noteOffsetX: asNumber(layoutPolicy.noteOffsetX, 220),
    noteOffsetY: asNumber(layoutPolicy.noteOffsetY, 110),
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const relationDrafts = normalizedRelations
    .filter((relation) => visibleRelationIds.has(asString(relation.id, "")))
    .map((relation, index) => {
      const fromId = asString(relation.from, "");
      const toId = asString(relation.to, "");
      const visualHints = isRecord(relation.visual) ? relation.visual : {};
      const fromNode = nodeById.get(fromId);
      const toNode = nodeById.get(toId);
      if (!fromNode || !toNode) return null;
      return {
        id: asString(relation.id, makeId("edge", index + 1)),
        kind: "arrow",
        elbowed: visualHints.elbowed === true,
        from: { elementId: fromId, side: asString(visualHints.fromSide, direction === "LR" ? "right" : "bottom") },
        to: { elementId: toId, side: asString(visualHints.toSide, direction === "LR" ? "left" : "top") },
        raw: { relationId: asString(relation.id, makeId("edge", index + 1)) },
        label: asString(relation.label)
          ? {
              text: asString(relation.label, ""),
              textElementId: `${asString(relation.id, makeId("edge", index + 1))}-label`,
              binding: "bound",
              containerId: asString(relation.id, makeId("edge", index + 1)),
              fontSize: asNumber(visualHints.fontSize, asNumber(visual?.typography?.edgeFontSize, 16)),
              maxCharsPerLine: 10,
            }
          : null,
        style: {
          strokeColor: visualHints.strokeColor ?? "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: visualHints.strokeWidth ?? 1,
          strokeStyle: visualHints.strokeStyle ?? "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
        },
      };
    })
    .filter(Boolean);
  const relationById = new Map(relationDrafts.map((edge) => [edge.id, edge]));
  const occupied = nodes.map((node) => ({
    x: asNumber(node.geometry.x),
    y: asNumber(node.geometry.y),
    width: asNumber(node.geometry.width),
    height: asNumber(node.geometry.height),
    id: node.id,
    kind: node.objectType === "annotation" ? "annotation" : "node",
  }));
  nodes = nodes.map((node) => placeAnnotationNearTarget(node, objectById.get(node.id) ?? {}, nodeById, relationById, direction, occupied));
  const repositionedNodeById = new Map(nodes.map((node) => [node.id, node]));
  const groupContainers = buildGroupContainers(groupDefs, repositionedNodeById);
  const laneFrames = buildLaneFrames(nodes, laneDefs, direction);
  const edges = relationDrafts;
  const mapping = {
    objectToNode: nodes.map((node) => ({ objectId: node.raw?.semanticObjectId ?? node.id, nodeId: node.id, labelTextElementId: node.label.textElementId, laneId: node.raw?.laneId ?? null })),
    relationToEdge: edges.map((edge) => ({ relationId: edge.id, edgeId: edge.id, labelTextElementId: edge.label?.textElementId ?? null })),
    groupToContainer: groupContainers.map((container) => ({ groupId: container.raw?.sourceGroupId ?? container.id, containerId: container.id })),
    laneToContainer: laneFrames.map((frame) => ({ laneId: frame.raw?.sourceLaneId ?? frame.laneId, containerId: frame.id })),
  };
  return {
    scene: {
      appState: {
        theme: asString(parsed.visual?.theme, "light"),
        viewBackgroundColor: asString(parsed.scene?.appState?.viewBackgroundColor, "#ffffff"),
        name: asString(parsed.scene?.appState?.name, null),
      },
    },
    direction,
    nodes,
    edges,
    containers: [...laneFrames.map(buildContainerNode), ...groupContainers.map(buildContainerNode)],
    mapping,
  };
}

function normalizeV2(parsed) {
  return {
    scene: isRecord(parsed.scene) ? parsed.scene : {},
    direction: "LR",
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes.filter(isRecord) : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges.filter(isRecord) : [],
    containers: [],
    mapping: isRecord(parsed.mapping) ? parsed.mapping : null,
  };
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

  if (!isRecord(parsed) || (parsed.version !== "passto-desk-domain-json/v2" && parsed.version !== "passto-desk-domain-json/v3")) {
    throw new Error("Input must be passto-desk-domain-json/v2 or v3.");
  }

  const normalized = parsed.version === "passto-desk-domain-json/v3" ? buildV3(parsed) : normalizeV2(parsed);
  const nodes = [...normalized.containers, ...normalized.nodes];
  const edges = normalized.edges;
  const nodeById = new Map();
  const elements = [];
  const occupiedForRouting = [];
  const occupiedForLabels = [];

  nodes.forEach((node, index) => {
    const shape = makeShapeElement(node, index + 1);
    nodeById.set(shape.id, shape);
    elements.push(shape);
    const isContainer =
      node.objectType === "group" ||
      node.raw?.containerRole === "lane" ||
      node.raw?.containerRole === "group";
    if (!isContainer) {
      occupiedForRouting.push({ x: shape.x, y: shape.y, width: shape.width, height: shape.height, id: shape.id, kind: node.objectType === "annotation" ? "annotation" : "node" });
    }
  });

  const edgeMidpoints = new Map();
  edges.forEach((edge) => {
    const fromNode = nodeById.get(asString(edge.from?.elementId, asString(edge.from, "")));
    const toNode = nodeById.get(asString(edge.to?.elementId, asString(edge.to, "")));
    if (!fromNode || !toNode) return;
    edgeMidpoints.set(edge.id, relationMidpoint(edge, fromNode, toNode, normalized.direction));
  });

  const titleAvoidBoxes = nodes
    .filter((node) => node.raw?.containerRole === "lane" || node.raw?.containerRole === "group")
    .map((node) => ({
      x: asNumber(node.geometry.x),
      y: asNumber(node.geometry.y),
      width: Math.min(asNumber(node.geometry.width), 220),
      height: 42,
      id: `${node.id}-title-zone`,
      kind: "title-zone",
    }));
  const groupTitleAvoidBoxes = titleAvoidBoxes.filter((box) => {
    const sourceNode = nodes.find((n) => n.id === box.id.replace("-title-zone", ""));
    return sourceNode?.raw?.containerRole === "group";
  });
  occupiedForRouting.push(...groupTitleAvoidBoxes);

  const annotationBoxes = nodes
    .filter((node) => node.objectType === "annotation")
    .map((node) => ({
      x: asNumber(node.geometry.x),
      y: asNumber(node.geometry.y),
      width: asNumber(node.geometry.width),
      height: asNumber(node.geometry.height),
      id: node.id,
      kind: "annotation",
    }));

  nodes.forEach((node, index) => {
    const shape = nodeById.get(asString(node.id, ""));
    if (!shape) return;
    const labelText = asString(node.label?.text);
    if (!labelText) return;
    const textElement = makeBoundTextElement(node, shape, index + 1);
    shape.boundElements = [...(Array.isArray(shape.boundElements) ? shape.boundElements : []), { id: textElement.id, type: "text" }];
    elements.push(textElement);
    occupiedForLabels.push({ x: textElement.x, y: textElement.y, width: textElement.width, height: textElement.height, id: textElement.id });
  });

  edges.forEach((edge, index) => {
    const fromId = asString(edge.from?.elementId, asString(edge.from, ""));
    const toId = asString(edge.to?.elementId, asString(edge.to, ""));
    const fromNode = nodeById.get(fromId);
    const toNode = nodeById.get(toId);
    if (!fromNode || !toNode) throw new Error(`Edge ${asString(edge.raw?.relationId, edge.id)} references missing nodes.`);
    const arrow = makeArrowElement(edge, fromNode, toNode, normalized.direction, occupiedForRouting, index + 1);
    if (edgeMidpoints.has(edge.id)) {
      arrow.customData = {
        ...(isRecord(arrow.customData) ? arrow.customData : {}),
        routingMidpoint: edgeMidpoints.get(edge.id),
      };
    }
    fromNode.boundElements = [...(Array.isArray(fromNode.boundElements) ? fromNode.boundElements : []), { id: arrow.id, type: "arrow" }];
    toNode.boundElements = [...(Array.isArray(toNode.boundElements) ? toNode.boundElements : []), { id: arrow.id, type: "arrow" }];
    elements.push(arrow);
    const edgeLabel = makeEdgeLabelElement(edge, arrow, occupiedForLabels, index + 1, annotationBoxes, normalized.direction);
    if (edgeLabel) {
      arrow.boundElements = [...(Array.isArray(arrow.boundElements) ? arrow.boundElements : []), { id: edgeLabel.id, type: "text" }];
      elements.push(edgeLabel);
      occupiedForLabels.push({ x: edgeLabel.x, y: edgeLabel.y, width: edgeLabel.width, height: edgeLabel.height, id: edgeLabel.id });
    }
  });

  const transformOutput = createEmptyTransformOutput({
    semanticDelta: {
      objects: normalized.nodes
        .filter((node) => !["group"].includes(asString(node.objectType, "")))
        .map((node) => ({
          id: asString(node.id, ""),
          type: asString(node.objectType, "action"),
          title: asString(node.label?.text, asString(node.id, "")),
        })),
      relations: normalized.edges.map((edge) => ({
        id: asString(edge.id, ""),
        from: asString(edge.from?.elementId, asString(edge.from, "")),
        to: asString(edge.to?.elementId, asString(edge.to, "")),
        label: asString(edge.label?.text, asString(edge.label, null)),
      })),
    },
    viewDelta: {
      mode: "workbench",
      visibleObjectIds: normalized.nodes.filter((node) => asString(node.objectType, "") !== "group").map((node) => asString(node.id, "")),
      visibleRelationIds: normalized.edges.map((edge) => asString(edge.id, "")),
      primaryPath: [],
      direction: normalized.direction,
    },
    mappingDelta: {
      objectToNode: normalized.nodes
        .filter((node) => asString(node.objectType, "") !== "group")
        .map((node) => ({ objectId: asString(node.id, ""), nodeId: asString(node.id, "") })),
      relationToEdge: normalized.edges.map((edge) => ({ relationId: asString(edge.id, ""), edgeId: asString(edge.id, "") })),
    },
    visualDelta: {
      layoutPolicy: {
        direction: normalized.direction,
      },
      readabilityHints: [],
      mechanismHints: [],
    },
    sceneProposal: {
      type: "excalidraw",
      elementCount: elements.length,
      appState: {
        theme: normalized.scene?.appState?.theme ?? "light",
      },
    },
    ambiguities: [],
    warnings: [],
    conflicts: [],
    confidence: {
      overall: "high",
    },
    recommendedAction: "persist",
  });

  const transformValidation = validateTransformOutput(transformOutput);
  if (!transformValidation.ok) {
    throw new Error(`Forward transform output failed runtime validation: ${JSON.stringify(transformValidation.errors)}`);
  }

  const commitResult = commitTransformResult({
    baseState: {},
    transformOutput,
    transformDirection: "forward",
    mode: "workbench",
    truthSources: [{ type: "domain-json", inputPath, version: parsed.version }],
    persistedArtifacts: [{ type: "excalidraw-scene", outputPath }],
    validationStatus: "pass",
    nextRoundHint: "continue",
  });
  if (!commitResult.ok) {
    throw new Error(`Forward runtime commit failed at ${commitResult.stage}: ${JSON.stringify(commitResult.errors)}`);
  }

  const sharedStateSnapshot = commitResult.nextSnapshot;

  const scene = {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      theme: normalized.scene?.appState?.theme ?? "light",
      viewBackgroundColor: normalized.scene?.appState?.viewBackgroundColor ?? "#ffffff",
      name: normalized.scene?.appState?.name ?? null,
      gridSize: null,
    },
    files: {},
    customData: {
      runtime: {
        transformDirection: "forward",
        transformOutput,
        sharedStateSnapshot,
        validationResult: commitResult.validationResult,
        nextRoundDecision: commitResult.nextRoundDecision,
        mergedState: commitResult.mergedState,
      },
    },
  };

  await writeFile(outputPath, JSON.stringify(scene, null, 2) + "\n", "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
