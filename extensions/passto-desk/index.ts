import { execFile } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const execFileAsync = promisify(execFile);
const TOOL_NAME = "passto_desk";
const COMMAND_NAME = "passto-desk";
const BINDING_ENTRY_TYPE = "passto-desk-binding";
const EXTENSION_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.join(EXTENSION_ROOT, "files");
const OPEN_WAIT_MS = 6_000;
const PASTE_SETTLE_MS = 2_500;
const RELOAD_WAIT_MS = 7_000;
const PERSISTENCE_INITIAL_WAIT_MS = 15_000;
const PERSISTENCE_RETRY_DELAY_MS = 5_000;
const PERSISTENCE_MAX_ATTEMPTS = 4;
const READ_RETRY_DELAY_MS = 1_500;
const READ_MAX_ATTEMPTS = 6;
const AGENT_BROWSER_TIMEOUT_MS = 120_000;
const ROOM_ID_LENGTH = 20;
const ROOM_KEY_LENGTH = 22;

const RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

type Action =
  | "get_binding"
  | "create_room"
  | "bind_room"
  | "unbind_room"
  | "read_scene"
  | "export_scene_json"
  | "export_domain_json"
  | "append_elements"
  | "import_scene_json"
  | "import_domain_json"
  | "paste_clipboard_payload"
  | "save";

interface RoomBindingState {
  customType: typeof BINDING_ENTRY_TYPE;
  bound: boolean;
  roomId: string | null;
  roomUrl: string | null;
  boundAt: string;
}

interface ParsedRoomUrl {
  roomId: string;
  roomKey?: string;
  roomUrl: string;
}

interface SceneSnapshot {
  roomId: string;
  roomUrl: string;
  sceneHash: string;
  elementCount: number;
  elements: unknown[];
  appState: Record<string, unknown>;
  sceneJson: string;
}

const ActionSchema = Type.Union([
  Type.Literal("get_binding"),
  Type.Literal("create_room"),
  Type.Literal("bind_room"),
  Type.Literal("unbind_room"),
  Type.Literal("read_scene"),
  Type.Literal("export_scene_json"),
  Type.Literal("export_domain_json"),
  Type.Literal("append_elements"),
  Type.Literal("import_scene_json"),
  Type.Literal("import_domain_json"),
  Type.Literal("paste_clipboard_payload"),
  Type.Literal("save"),
]);

const ToolParameters = Type.Object({
  action: ActionSchema,
  roomUrl: Type.Optional(Type.String({ description: "Excalidraw shared room URL" })),
  elements: Type.Optional(Type.Array(Type.Unknown(), { description: "Elements to append to the current shared room via clipboard payload" })),
  files: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Optional Excalidraw files map" })),
  sceneJson: Type.Optional(Type.String({ description: "Serialized Excalidraw scene JSON used by import_scene_json (replace semantics)" })),
  domainJson: Type.Optional(Type.String({ description: "Serialized passto-desk-domain-json/v2 or v3 JSON used by import_domain_json; v3 is preferred for runtime-oriented structural updates" })),
  clipboardJson: Type.Optional(Type.String({ description: "Raw excalidraw/clipboard JSON string used by paste_clipboard_payload (append semantics)" })),
  verifyPersistence: Type.Optional(Type.Boolean({ description: "Verify persistence by opening a fresh verification session and re-reading the room after write/replace" })),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function randomString(length: number, alphabet: string): string {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += alphabet[randomInt(0, alphabet.length)];
  }
  return result;
}

function createRoomBinding(): RoomBindingState {
  const roomId = randomString(ROOM_ID_LENGTH, RANDOM_ALPHABET);
  const roomKey = randomString(ROOM_KEY_LENGTH, RANDOM_KEY_ALPHABET);
  return {
    customType: BINDING_ENTRY_TYPE,
    bound: true,
    roomId,
    roomUrl: `https://excalidraw.com/#room=${roomId},${roomKey}`,
    boundAt: new Date().toISOString(),
  };
}

function parseRoomUrl(roomUrl: string): ParsedRoomUrl | null {
  try {
    const url = new URL(roomUrl.trim());
    const rawHash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const hashMatch = rawHash.match(/(?:^|&)room=([^,&#]+),([^&#]+)/);
    if (hashMatch) {
      const [, roomId, roomKey] = hashMatch;
      return {
        roomId,
        roomKey,
        roomUrl: `https://excalidraw.com/#room=${roomId},${roomKey}`,
      };
    }

    const roomId = url.searchParams.get("roomId") ?? url.searchParams.get("room");
    if (roomId) {
      return {
        roomId,
        roomUrl: url.toString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function buildSessionName(roomId: string): string {
  const digest = createHash("sha256").update(roomId).digest("hex").slice(0, 16);
  return `passto-desk-${digest}`;
}

function hashScene(elements: unknown[]): string {
  const json = JSON.stringify(elements);
  return `scene-${createHash("sha256").update(json).digest("hex").slice(0, 12)}`;
}

function sanitizeElements(elements: unknown[]): unknown[] {
  return elements.map((element) => {
    if (!isRecord(element)) return element;
    const copy = JSON.parse(JSON.stringify(element)) as Record<string, unknown>;
    delete copy.versionNonce;
    delete copy.updated;
    delete copy.seed;
    return copy;
  });
}

function formatSaveFileName(date = new Date()): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const runId = randomString(8, RANDOM_ALPHABET);
  return `${yyyy}${mm}${dd}-${runId}.excalidraw`;
}

function buildReadSceneScript(): string {
  return `(() => {
    const root = document.querySelector('#root');
    if (!root) return { ok: false, error: 'NO_ROOT' };

    const reactKey = Object.getOwnPropertyNames(root).find((key) => key.startsWith('__reactContainer$'));
    const current = reactKey ? root[reactKey]?.stateNode?.current : null;
    if (!current) return { ok: false, error: 'NO_REACT_CURRENT' };

    const stack = [current];
    const seen = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (!node || seen.has(node)) continue;
      seen.add(node);

      const typeName = typeof node.type === 'string'
        ? node.type
        : (node.type?.name || node.elementType?.name || node.type?.displayName || null);

      const api = node.memoizedProps?.value;
      if (
        typeName === 'ExcalidrawAPIContext' &&
        api &&
        typeof api.getSceneElements === 'function' &&
        typeof api.getAppState === 'function'
      ) {
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        return {
          ok: true,
          elements,
          appState: {
            name: appState?.name ?? null,
            theme: appState?.theme ?? null,
            viewBackgroundColor: appState?.viewBackgroundColor ?? null,
          },
        };
      }

      if (node.child) stack.push(node.child);
      if (node.sibling) stack.push(node.sibling);
    }

    return { ok: false, error: 'NO_API_CONTEXT' };
  })()`;
}

function buildSetClipboardPayloadScript(payload: unknown): string {
  const jsonLiteral = JSON.stringify(JSON.stringify(payload));
  return `(() => {
    document.body.dataset.piClipboardPayload = ${jsonLiteral};
    return { ok: true, payloadLength: document.body.dataset.piClipboardPayload.length };
  })()`;
}

function buildPasteClipboardScript(): string {
  return `(() => {
    const payload = JSON.parse(document.body.dataset.piClipboardPayload || 'null');
    if (!payload) return { ok: false, error: 'NO_PAYLOAD' };

    const text = JSON.stringify(payload);
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    dt.setData('application/json', text);

    const target = document.querySelector('canvas') || document.body;
    target.focus?.();
    const ev = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(ev);

    return {
      ok: true,
      target: target.tagName,
      textLength: text.length,
      clipboardType: payload?.type ?? null,
      elementCount: Array.isArray(payload?.elements) ? payload.elements.length : null,
    };
  })()`;
}

function buildSessionProbeScript(): string {
  return `(() => ({
    href: location.href,
    title: document.title || null,
    readyState: document.readyState,
    hasRoot: !!document.querySelector('#root')
  }))()`;
}

async function ensureFilesDir(): Promise<void> {
  await mkdir(FILES_DIR, { recursive: true });
}

async function writeSceneFile(fileName: string, sceneJson: string): Promise<string> {
  await ensureFilesDir();
  const filePath = path.join(FILES_DIR, fileName);
  await writeFile(filePath, sceneJson, "utf8");
  return filePath;
}

async function convertDomainJsonToSceneJson(domainJson: string): Promise<{ sceneJson: string; tempDomainPath: string; tempScenePath: string }> {
  await ensureFilesDir();
  const tempBase = `domain-${Date.now()}-${randomString(6, RANDOM_ALPHABET)}`;
  const tempDomainPath = path.join(FILES_DIR, `${tempBase}.domain.json`);
  const tempScenePath = path.join(FILES_DIR, `${tempBase}.excalidraw`);
  await writeFile(tempDomainPath, domainJson, "utf8");
  await execFileAsync("node", [path.join(EXTENSION_ROOT, "scripts", "domain-json-to-excalidraw.mjs"), tempDomainPath, tempScenePath], {
    cwd: EXTENSION_ROOT,
    timeout: AGENT_BROWSER_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });
  const sceneJson = await readFile(tempScenePath, "utf8");
  return { sceneJson, tempDomainPath, tempScenePath };
}

async function convertSceneJsonToDomainJson(sceneJson: string): Promise<{ domainJson: string; tempScenePath: string; tempDomainPath: string }> {
  await ensureFilesDir();
  const tempBase = `scene-${Date.now()}-${randomString(6, RANDOM_ALPHABET)}`;
  const tempScenePath = path.join(FILES_DIR, `${tempBase}.excalidraw`);
  const tempDomainPath = path.join(FILES_DIR, `${tempBase}.domain.json`);
  await writeFile(tempScenePath, sceneJson, "utf8");
  await execFileAsync("node", [path.join(EXTENSION_ROOT, "scripts", "excalidraw-to-domain-json.mjs"), tempScenePath, tempDomainPath], {
    cwd: EXTENSION_ROOT,
    timeout: AGENT_BROWSER_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });
  const domainJson = await readFile(tempDomainPath, "utf8");
  return { domainJson, tempScenePath, tempDomainPath };
}

async function runAgentBrowser(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync("agent-browser", args, {
    cwd,
    timeout: AGENT_BROWSER_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function agentBrowserEval(sessionName: string, script: string, cwd?: string): Promise<Record<string, unknown>> {
  const { stdout } = await runAgentBrowser(["--session", sessionName, "eval", script], cwd);
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("agent-browser eval returned empty stdout");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("eval result is not an object");
    }
    return parsed;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to parse agent-browser eval JSON: ${reason}; stdout=${trimmed.slice(0, 500)}`);
  }
}

async function waitInBrowser(sessionName: string, ms: number, cwd?: string): Promise<void> {
  await runAgentBrowser(["--session", sessionName, "wait", String(ms)], cwd);
}

async function probeExistingRoomSession(sessionName: string, cwd?: string): Promise<Record<string, unknown> | null> {
  try {
    return await agentBrowserEval(sessionName, buildSessionProbeScript(), cwd);
  } catch {
    return null;
  }
}

async function openRoom(binding: RoomBindingState, cwd?: string, sessionNameOverride?: string): Promise<void> {
  if (!binding.bound || !binding.roomId || !binding.roomUrl) {
    throw new Error("当前没有绑定的 room。请先创建或绑定共享 room。");
  }

  const sessionName = sessionNameOverride ?? buildSessionName(binding.roomId);
  try {
    await runAgentBrowser(["--session", sessionName, "open", binding.roomUrl], cwd);
    await waitInBrowser(sessionName, OPEN_WAIT_MS, cwd);
    return;
  } catch (error) {
    const probe = await probeExistingRoomSession(sessionName, cwd);
    const currentHref = readString(probe?.href);
    const currentRoom = currentHref ? parseRoomUrl(currentHref) : null;
    const sameRoom = currentRoom?.roomId === binding.roomId;
    const hasRoot = probe?.hasRoot === true;
    if (sameRoom && hasRoot) {
      return;
    }
    throw error;
  }
}

async function readSceneCurrentSession(binding: RoomBindingState, cwd?: string, sessionNameOverride?: string): Promise<{ elements: unknown[]; appState: Record<string, unknown> }> {
  if (!binding.bound || !binding.roomId) {
    throw new Error("当前没有绑定的 room。请先创建或绑定共享 room。");
  }

  const sessionName = sessionNameOverride ?? buildSessionName(binding.roomId);
  for (let attempt = 1; attempt <= READ_MAX_ATTEMPTS; attempt += 1) {
    const result = await agentBrowserEval(sessionName, buildReadSceneScript(), cwd);
    if (result.ok === true) {
      const rawElements = Array.isArray(result.elements) ? result.elements : [];
      return {
        elements: sanitizeElements(rawElements),
        appState: isRecord(result.appState) ? result.appState : {},
      };
    }

    if (attempt < READ_MAX_ATTEMPTS) {
      await waitInBrowser(sessionName, READ_RETRY_DELAY_MS, cwd);
      continue;
    }

    throw new Error(`read_scene failed: ${readString(result.error) ?? "UNKNOWN_ERROR"}`);
  }

  throw new Error("read_scene exhausted retries");
}

async function readScene(binding: RoomBindingState, cwd: string): Promise<SceneSnapshot> {
  if (!binding.bound || !binding.roomId || !binding.roomUrl) {
    throw new Error("当前没有绑定的 room。请先创建或绑定共享 room。");
  }

  await openRoom(binding, cwd);
  const { elements, appState } = await readSceneCurrentSession(binding, cwd);
  const sceneObject = {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState,
    files: {},
  };

  return {
    roomId: binding.roomId,
    roomUrl: binding.roomUrl,
    sceneHash: hashScene(elements),
    elementCount: elements.length,
    elements,
    appState,
    sceneJson: JSON.stringify(sceneObject, null, 2),
  };
}

async function replaceSceneInRoom(binding: RoomBindingState, sceneJson: string, cwd: string, verifyPersistence: boolean): Promise<Record<string, unknown>> {
  if (!binding.bound || !binding.roomId) {
    throw new Error("当前没有绑定的 room。请先创建或绑定共享 room。");
  }

  const parsedScene = parseSceneJson(sceneJson);
  await openRoom(binding, cwd);
  const sessionName = buildSessionName(binding.roomId);
  await agentBrowserEval(sessionName, `(() => {
    const root = document.querySelector('#root');
    if (!root) return { ok: false, error: 'NO_ROOT' };

    const reactKey = Object.getOwnPropertyNames(root).find((key) => key.startsWith('__reactContainer$'));
    const current = reactKey ? root[reactKey]?.stateNode?.current : null;
    if (!current) return { ok: false, error: 'NO_REACT_CURRENT' };

    const stack = [current];
    const seen = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (!node || seen.has(node)) continue;
      seen.add(node);

      const typeName = typeof node.type === 'string'
        ? node.type
        : (node.type?.name || node.elementType?.name || node.type?.displayName || null);

      const api = node.memoizedProps?.value;
      if (
        typeName === 'ExcalidrawAPIContext' &&
        api &&
        typeof api.updateScene === 'function'
      ) {
        api.updateScene({
          elements: ${JSON.stringify(parsedScene.elements)},
          appState: ${JSON.stringify(parsedScene.appState)},
          commitToHistory: true,
        });
        if (typeof api.addFiles === 'function') {
          api.addFiles(${JSON.stringify(parsedScene.files)});
        }
        return {
          ok: true,
          elementCount: Array.isArray(${JSON.stringify(parsedScene.elements)}) ? ${JSON.stringify(parsedScene.elements)}.length : null,
          hasAddFiles: typeof api.addFiles === 'function',
        };
      }

      if (node.child) stack.push(node.child);
      if (node.sibling) stack.push(node.sibling);
    }

    return { ok: false, error: 'NO_API_CONTEXT' };
  })()`, cwd);
  await waitInBrowser(sessionName, PASTE_SETTLE_MS, cwd);

  const afterReplace = await readSceneCurrentSession(binding, cwd);
  const result: Record<string, unknown> = {
    mode: "replace-scene",
    sceneHash: hashScene(afterReplace.elements),
    elementCount: afterReplace.elements.length,
    appState: afterReplace.appState,
    elements: afterReplace.elements,
    expectedElementCount: parsedScene.elements.length,
  };

  if (verifyPersistence) {
    const verifySessionName = `${sessionName}-verify`;
    await waitInBrowser(sessionName, PERSISTENCE_INITIAL_WAIT_MS, cwd);
    await openRoom(binding, cwd, verifySessionName);
    await waitInBrowser(verifySessionName, RELOAD_WAIT_MS, cwd);

    const attempts: Array<Record<string, unknown>> = [];
    let persisted = await readSceneCurrentSession(binding, cwd, verifySessionName);
    attempts.push({
      attempt: 1,
      sessionName: verifySessionName,
      sceneHash: hashScene(persisted.elements),
      elementCount: persisted.elements.length,
    });

    const expectedMinimum = parsedScene.elements.length;
    for (let attempt = 2; attempt <= PERSISTENCE_MAX_ATTEMPTS; attempt += 1) {
      const hasRecovered = persisted.elements.length >= expectedMinimum || (expectedMinimum === 0 && persisted.elements.length === 0);
      if (hasRecovered) {
        break;
      }
      await waitInBrowser(verifySessionName, PERSISTENCE_RETRY_DELAY_MS, cwd);
      persisted = await readSceneCurrentSession(binding, cwd, verifySessionName);
      attempts.push({
        attempt,
        sessionName: verifySessionName,
        sceneHash: hashScene(persisted.elements),
        elementCount: persisted.elements.length,
      });
    }

    result.persistenceCheck = {
      verificationMode: "fresh-session-open",
      verificationSessionName: verifySessionName,
      sceneHash: hashScene(persisted.elements),
      elementCount: persisted.elements.length,
      elements: persisted.elements,
      appState: persisted.appState,
      expectedMinimum,
      attempts,
      persisted: persisted.elements.length >= expectedMinimum,
    };
  }

  return result;
}

async function pastePayloadToRoom(binding: RoomBindingState, payload: unknown, cwd: string, verifyPersistence: boolean): Promise<Record<string, unknown>> {
  if (!binding.bound || !binding.roomId) {
    throw new Error("当前没有绑定的 room。请先创建或绑定共享 room。");
  }

  await openRoom(binding, cwd);
  const sessionName = buildSessionName(binding.roomId);
  const setResult = await agentBrowserEval(sessionName, buildSetClipboardPayloadScript(payload), cwd);
  const pasteResult = await agentBrowserEval(sessionName, buildPasteClipboardScript(), cwd);
  await waitInBrowser(sessionName, PASTE_SETTLE_MS, cwd);

  const afterPaste = await readSceneCurrentSession(binding, cwd);
  const result: Record<string, unknown> = {
    setPayload: setResult,
    paste: pasteResult,
    sceneHash: hashScene(afterPaste.elements),
    elementCount: afterPaste.elements.length,
    appState: afterPaste.appState,
    elements: afterPaste.elements,
  };

  if (verifyPersistence) {
    const verifySessionName = `${sessionName}-verify`;
    await waitInBrowser(sessionName, PERSISTENCE_INITIAL_WAIT_MS, cwd);
    await openRoom(binding, cwd, verifySessionName);
    await waitInBrowser(verifySessionName, RELOAD_WAIT_MS, cwd);

    const attempts: Array<Record<string, unknown>> = [];
    let persisted = await readSceneCurrentSession(binding, cwd, verifySessionName);
    attempts.push({
      attempt: 1,
      sessionName: verifySessionName,
      sceneHash: hashScene(persisted.elements),
      elementCount: persisted.elements.length,
    });

    const expectedMinimum = afterPaste.elements.length;
    for (let attempt = 2; attempt <= PERSISTENCE_MAX_ATTEMPTS; attempt += 1) {
      const hasRecovered = persisted.elements.length >= expectedMinimum || (expectedMinimum === 0 && persisted.elements.length === 0);
      if (hasRecovered) {
        break;
      }
      await waitInBrowser(verifySessionName, PERSISTENCE_RETRY_DELAY_MS, cwd);
      persisted = await readSceneCurrentSession(binding, cwd, verifySessionName);
      attempts.push({
        attempt,
        sessionName: verifySessionName,
        sceneHash: hashScene(persisted.elements),
        elementCount: persisted.elements.length,
      });
    }

    result.persistenceCheck = {
      verificationMode: "fresh-session-open",
      verificationSessionName: verifySessionName,
      sceneHash: hashScene(persisted.elements),
      elementCount: persisted.elements.length,
      elements: persisted.elements,
      appState: persisted.appState,
      expectedMinimum,
      attempts,
      persisted: persisted.elements.length >= expectedMinimum,
    };
  }

  return result;
}

function resolveBindingFromBranch(ctx: ExtensionContext): RoomBindingState | null {
  const latest = [...ctx.sessionManager.getBranch()]
    .reverse()
    .find((entry) => entry.type === "custom" && entry.customType === BINDING_ENTRY_TYPE);

  if (!latest || !("data" in latest) || !isRecord(latest.data)) {
    return null;
  }

  const bound = latest.data.bound === true;
  const boundAt = readString(latest.data.boundAt) ?? new Date().toISOString();
  const roomId = readString(latest.data.roomId) ?? null;
  const roomUrl = readString(latest.data.roomUrl) ?? null;

  return {
    customType: BINDING_ENTRY_TYPE,
    bound,
    roomId,
    roomUrl,
    boundAt,
  };
}

function persistBinding(pi: ExtensionAPI, binding: RoomBindingState | null): RoomBindingState {
  const entry = binding ?? {
    customType: BINDING_ENTRY_TYPE,
    bound: false,
    roomId: null,
    roomUrl: null,
    boundAt: new Date().toISOString(),
  };

  pi.appendEntry(BINDING_ENTRY_TYPE, entry);
  return entry;
}

function createBoundRoom(pi: ExtensionAPI): RoomBindingState {
  return persistBinding(pi, createRoomBinding());
}

function bindRoomUrl(roomUrl: string, pi: ExtensionAPI): RoomBindingState {
  const parsed = parseRoomUrl(roomUrl);
  if (!parsed) {
    throw new Error(`无法解析 Excalidraw room URL：${roomUrl}`);
  }

  return persistBinding(pi, {
    customType: BINDING_ENTRY_TYPE,
    bound: true,
    roomId: parsed.roomId,
    roomUrl: parsed.roomUrl,
    boundAt: new Date().toISOString(),
  });
}

function parseSceneJson(sceneJson: string): { elements: unknown[]; files: Record<string, unknown>; appState: Record<string, unknown> } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sceneJson);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`sceneJson 不是合法 JSON：${reason}`);
  }

  if (!isRecord(parsed)) {
    throw new Error("sceneJson 必须是对象");
  }

  return {
    elements: Array.isArray(parsed.elements) ? parsed.elements : [],
    files: isRecord(parsed.files) ? parsed.files : {},
    appState: isRecord(parsed.appState) ? parsed.appState : {},
  };
}

function buildClipboardPayloadFromSceneJson(sceneJson: string): Record<string, unknown> {
  const { elements, files } = parseSceneJson(sceneJson);
  return {
    type: "excalidraw/clipboard",
    elements,
    files,
  };
}

function buildClipboardPayloadFromElements(elements: unknown[], files?: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "excalidraw/clipboard",
    elements,
    files: files ?? {},
  };
}

function createTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function sendVisibleMessage(pi: ExtensionAPI, content: string, details?: Record<string, unknown>): void {
  pi.sendMessage({
    customType: "passto-desk",
    content,
    display: true,
    details: details ?? {},
  });
}

export default function passtoDeskExtension(pi: ExtensionAPI) {
  let currentBinding: RoomBindingState | null = null;

  function requireBinding(): RoomBindingState {
    if (!currentBinding?.bound || !currentBinding.roomId || !currentBinding.roomUrl) {
      throw new Error("当前没有绑定的 room。请先创建新 room 或绑定现有 room。");
    }
    return currentBinding;
  }

  pi.on("session_start", async (_event, ctx) => {
    currentBinding = resolveBindingFromBranch(ctx);
    await ensureFilesDir();
  });

  pi.registerCommand(COMMAND_NAME, {
    description: "Create/bind/unbind/save the current Passto Desk shared Excalidraw room; structural read/write should prefer export_domain_json -> modify domain v3 -> import_domain_json",
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      const [subcommand, ...rest] = trimmed.split(/\s+/).filter(Boolean);

      try {
        if (!subcommand) {
          currentBinding = createBoundRoom(pi);
          sendVisibleMessage(pi, `已创建并绑定新的共享 room：${currentBinding.roomUrl}`, {
            action: "create_room",
            roomId: currentBinding.roomId,
            roomUrl: currentBinding.roomUrl,
          });
          return;
        }

        if (subcommand === "bind") {
          const roomUrl = rest.join(" ").trim();
          if (!roomUrl) {
            ctx.ui.notify(`用法：/${COMMAND_NAME} bind <excalidraw room url>`, "warning");
            return;
          }
          currentBinding = bindRoomUrl(roomUrl, pi);
          sendVisibleMessage(pi, `已绑定共享 room：${currentBinding.roomUrl}`, {
            action: "bind_room",
            roomId: currentBinding.roomId,
            roomUrl: currentBinding.roomUrl,
          });
          return;
        }

        if (subcommand === "unbind") {
          const previous = currentBinding;
          currentBinding = persistBinding(pi, null);
          sendVisibleMessage(pi, previous?.roomUrl ? `已解绑共享 room：${previous.roomUrl}` : "当前没有绑定 room，已保持未绑定状态。", {
            action: "unbind_room",
            previousBinding: previous,
          });
          return;
        }

        if (subcommand === "save") {
          const binding = requireBinding();
          const snapshot = await readScene(binding, ctx.cwd);
          const fileName = formatSaveFileName();
          const filePath = await writeSceneFile(fileName, snapshot.sceneJson);
          sendVisibleMessage(pi, `已保存当前画布到 ${filePath}`, {
            action: "save",
            roomId: snapshot.roomId,
            roomUrl: snapshot.roomUrl,
            filePath,
            fileName,
            sceneHash: snapshot.sceneHash,
            elementCount: snapshot.elementCount,
          });
          return;
        }

        ctx.ui.notify(`未知子命令：${subcommand}。可用：/${COMMAND_NAME}、/${COMMAND_NAME} bind <url>、/${COMMAND_NAME} unbind、/${COMMAND_NAME} save`, "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerTool({
    name: TOOL_NAME,
    label: "Passto Desk",
    description: "Manage the current shared Excalidraw room as a Passto Desk runtime workbench: bind rooms, read/export scene or domain state, prefer domain-v3 structural updates, use import_* as replace, use append/paste only for lightweight incremental additions, and save local .excalidraw snapshots.",
    promptSnippet: "创建或绑定当前 Passto Desk 共享 room，读取共享画板与 domain 结构状态；默认优先 export_domain_json -> 修改 semantic/view/mapping/visual -> import_domain_json。import_scene_json / import_domain_json 是 replace，append_elements / paste_clipboard_payload 是 append，并可用 verifyPersistence 做新 session 回读校验。",
    promptGuidelines: [
      "当需要一个新的共享白板时，使用 passto_desk 的 create_room。",
      "当用户给出 Excalidraw room URL 并要求绑定时，使用 bind_room。",
      "当需要解绑时，使用 unbind_room。",
      "当需要把当前共享画布保存为本地 .excalidraw 文件时，使用 save。",
      "当需要读取当前结构主状态时，优先使用 export_domain_json，而不是只读 scene elements。",
      "当需要把当前共享画布导出为 passto-desk-domain-json/v3 时，使用 export_domain_json。",
      "当需要 agent 主导的结构更新时，优先使用 export_domain_json -> 修改 semantic/view/mapping/visual -> import_domain_json。",
      "import_scene_json 与 import_domain_json 是 replace 语义，不是 append。",
      "append_elements 与 paste_clipboard_payload 是 append 语义，只用于低复杂度增量补充。",
      "当需要验证写入是否真正持久化时，可开启 verifyPersistence；它会通过 fresh verification session 回读，而不是同 session 立刻 reload。",
      "当需要写图时，优先使用 export_domain_json -> 修改语义/结构/映射/视觉层 -> import_domain_json，而不是模拟鼠标画图或直接手拼 elements。",
    ],
    parameters: ToolParameters,
    async execute(_toolCallId, input, _signal, _onUpdate, ctx) {
      const action = input.action as Action;

      if (action === "get_binding") {
        return createTextResult(
          currentBinding?.bound && currentBinding.roomId
            ? `当前已绑定 room：${currentBinding.roomId}`
            : "当前没有已绑定 room",
          { binding: currentBinding },
        );
      }

      if (action === "create_room") {
        currentBinding = createBoundRoom(pi);
        return createTextResult(`已创建并绑定新的共享 room：${currentBinding.roomUrl}`, {
          binding: currentBinding,
        });
      }

      if (action === "bind_room") {
        if (!input.roomUrl?.trim()) {
          throw new Error("bind_room 必须提供 roomUrl。");
        }
        currentBinding = bindRoomUrl(input.roomUrl.trim(), pi);
        return createTextResult(`已绑定共享 room：${currentBinding.roomUrl}`, {
          binding: currentBinding,
        });
      }

      if (action === "unbind_room") {
        const previous = currentBinding;
        currentBinding = persistBinding(pi, null);
        return createTextResult(previous?.roomUrl ? `已解绑共享 room：${previous.roomUrl}` : "当前没有绑定 room。", {
          previousBinding: previous,
          binding: currentBinding,
        });
      }

      const binding = requireBinding();

      if (action === "read_scene" || action === "export_scene_json") {
        const snapshot = await readScene(binding, ctx.cwd);
        return createTextResult(
          `已读取 room ${snapshot.roomId}，共 ${snapshot.elementCount} 个元素。`,
          {
            action,
            roomId: snapshot.roomId,
            roomUrl: snapshot.roomUrl,
            sceneHash: snapshot.sceneHash,
            elementCount: snapshot.elementCount,
            elements: snapshot.elements,
            appState: snapshot.appState,
            sceneJson: snapshot.sceneJson,
          },
        );
      }

      if (action === "export_domain_json") {
        const snapshot = await readScene(binding, ctx.cwd);
        const converted = await convertSceneJsonToDomainJson(snapshot.sceneJson);

        let parsedDomain: unknown;
        try {
          parsedDomain = JSON.parse(converted.domainJson);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`export_domain_json 转换成功但结果不是合法 JSON：${reason}`);
        }

        const domainObject = isRecord(parsedDomain) ? parsedDomain : {};
        const nodes = Array.isArray(domainObject.nodes) ? domainObject.nodes : [];
        const edges = Array.isArray(domainObject.edges) ? domainObject.edges : [];
        const freeTexts = Array.isArray(domainObject.freeTexts) ? domainObject.freeTexts : [];
        const warnings = Array.isArray(domainObject.warnings) ? domainObject.warnings : [];
        const version = readString(domainObject.version) ?? null;

        return createTextResult(`已从 room ${snapshot.roomId} 导出 domainJson。`, {
          action,
          roomId: snapshot.roomId,
          roomUrl: snapshot.roomUrl,
          sceneHash: snapshot.sceneHash,
          elementCount: snapshot.elementCount,
          tempScenePath: converted.tempScenePath,
          tempDomainPath: converted.tempDomainPath,
          version,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          freeTextCount: freeTexts.length,
          warningCount: warnings.length,
          domainJson: converted.domainJson,
          domainObject: parsedDomain,
        });
      }

      if (action === "save") {
        const snapshot = await readScene(binding, ctx.cwd);
        const fileName = formatSaveFileName();
        const filePath = await writeSceneFile(fileName, snapshot.sceneJson);
        return createTextResult(`已保存当前画布到 ${filePath}`, {
          action,
          roomId: snapshot.roomId,
          roomUrl: snapshot.roomUrl,
          sceneHash: snapshot.sceneHash,
          elementCount: snapshot.elementCount,
          filePath,
          fileName,
        });
      }

      if (action === "append_elements") {
        if (!Array.isArray(input.elements) || input.elements.length === 0) {
          throw new Error("append_elements 必须提供非空 elements 数组。");
        }
        const payload = buildClipboardPayloadFromElements(input.elements, isRecord(input.files) ? input.files : {});
        const result = await pastePayloadToRoom(binding, payload, ctx.cwd, input.verifyPersistence === true);
        return createTextResult(`已向 room ${binding.roomId} 粘贴 ${input.elements.length} 个元素。`, {
          action,
          roomId: binding.roomId,
          roomUrl: binding.roomUrl,
          payload,
          result,
        });
      }

      if (action === "import_scene_json") {
        if (!input.sceneJson?.trim()) {
          throw new Error("import_scene_json 必须提供 sceneJson。");
        }
        const parsedScene = parseSceneJson(input.sceneJson);
        const result = await replaceSceneInRoom(binding, input.sceneJson, ctx.cwd, input.verifyPersistence === true);
        return createTextResult(`已将 sceneJson 导入 room ${binding.roomId}。`, {
          action,
          roomId: binding.roomId,
          roomUrl: binding.roomUrl,
          sceneSummary: {
            elementCount: parsedScene.elements.length,
            fileCount: Object.keys(parsedScene.files).length,
          },
          result,
        });
      }

      if (action === "import_domain_json") {
        if (!input.domainJson?.trim()) {
          throw new Error("import_domain_json 必须提供 domainJson。");
        }
        const converted = await convertDomainJsonToSceneJson(input.domainJson);
        const parsedScene = parseSceneJson(converted.sceneJson);
        const result = await replaceSceneInRoom(binding, converted.sceneJson, ctx.cwd, input.verifyPersistence === true);
        return createTextResult(`已将 domainJson 导入 room ${binding.roomId}。`, {
          action,
          roomId: binding.roomId,
          roomUrl: binding.roomUrl,
          tempDomainPath: converted.tempDomainPath,
          tempScenePath: converted.tempScenePath,
          sceneSummary: {
            elementCount: parsedScene.elements.length,
            fileCount: Object.keys(parsedScene.files).length,
          },
          result,
        });
      }

      if (action === "paste_clipboard_payload") {
        if (!input.clipboardJson?.trim()) {
          throw new Error("paste_clipboard_payload 必须提供 clipboardJson。");
        }
        let payload: unknown;
        try {
          payload = JSON.parse(input.clipboardJson);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`clipboardJson 不是合法 JSON：${reason}`);
        }
        const result = await pastePayloadToRoom(binding, payload, ctx.cwd, input.verifyPersistence === true);
        return createTextResult(`已将 clipboard payload 粘贴到 room ${binding.roomId}。`, {
          action,
          roomId: binding.roomId,
          roomUrl: binding.roomUrl,
          payload,
          result,
        });
      }

      throw new Error(`不支持的 action: ${String(action)}`);
    },
  });
}
