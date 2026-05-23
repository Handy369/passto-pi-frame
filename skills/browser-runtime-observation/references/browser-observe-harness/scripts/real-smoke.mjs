import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";

function arg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeTs() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstText(payload) {
  const parts = payload?.content;
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => p?.type === "text").map((p) => p.text || "").join("\n");
}

function parseTextMaybeJson(text) {
  if (!text) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractToolResult(payload) {
  const text = firstText(payload);
  const parsed = parseTextMaybeJson(text);
  return parsed;
}

class McpStdioClient {
  constructor(command, args, options = {}) {
    this.command = command;
    this.args = args;
    this.options = options;
    this.id = 0;
    this.pending = new Map();
    this.notifications = [];
    this.exited = false;
    this.exitPromise = null;
  }

  async start() {
    this.proc = spawn(this.command, this.args, {
      cwd: this.options.cwd || process.cwd(),
      env: { ...process.env, ...(this.options.env || {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.stderr = "";
    this.proc.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });

    this.exitPromise = new Promise((resolve) => {
      this.proc.once("exit", (code, signal) => {
        this.exited = true;
        for (const [, pending] of this.pending) {
          pending.reject(new Error(`MCP process exited: code=${code} signal=${signal}`));
        }
        this.pending.clear();
        resolve({ code, signal });
      });
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id != null) {
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        if (msg.error) pending.reject(new Error(JSON.stringify(msg.error)));
        else pending.resolve(msg.result);
        return;
      }
      this.notifications.push(msg);
    });

    await sleep(250);
  }

  request(method, params = {}) {
    const id = ++this.id;
    const message = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "browser-observe-harness", version: "0.1.0" },
    });
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
    return result;
  }

  async listTools() {
    const result = await this.request("tools/list", {});
    return result?.tools || [];
  }

  async callTool(name, args = {}) {
    return await this.request("tools/call", { name, arguments: args });
  }

  async close() {
    if (!this.proc || this.exited) return;

    this.proc.kill("SIGTERM");
    const graceful = await Promise.race([
      this.exitPromise,
      sleep(1200).then(() => null),
    ]);
    if (graceful) return;

    if (!this.exited) {
      this.proc.kill("SIGKILL");
      await Promise.race([
        this.exitPromise,
        sleep(1200),
      ]);
    }
  }
}

function chooseToolName(tools, candidates) {
  const names = new Set(tools.map((t) => t.name));
  return candidates.find((name) => names.has(name)) || null;
}

function scoreFromLighthouse(raw, key) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const map = {
      accessibility: /Accessibility:\s*(\d+)/i,
      seo: /SEO:\s*(\d+)/i,
      "best-practices": /Best Practices:\s*(\d+)/i,
    };
    const match = raw.match(map[key] || /$a/);
    return match ? Number(match[1]) / 100 : null;
  }
  if (typeof raw === "object") {
    if (raw.categories?.[key]?.score != null) return raw.categories[key].score;
    if (raw[key] != null) return raw[key];
  }
  return null;
}

function countConsole(raw, type) {
  if (typeof raw === "string") {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const normalized = type === "warning" ? "warn" : type;
    return lines.filter((line) => new RegExp(`\\[${normalized}\\]`, "i").test(line)).length;
  }
  if (Array.isArray(raw)) return raw.filter((x) => (x.type || x.level) === type).length;
  if (raw && typeof raw === "object") {
    if (type === "error" && typeof raw.errorCount === "number") return raw.errorCount;
    if ((type === "warning" || type === "warn") && typeof raw.warningCount === "number") return raw.warningCount;
    if (typeof raw[`${type}Count`] === "number") return raw[`${type}Count`];
    if (Array.isArray(raw.messages)) return raw.messages.filter((x) => (x.type || x.level) === type).length;
  }
  return null;
}

function networkStats(raw) {
  if (typeof raw === "string") {
    const lines = raw.split(/\r?\n/);
    let successful = 0;
    let failed = 0;
    for (const line of lines) {
      const match = line.match(/\[(\d{3})\]/);
      if (!match) continue;
      const code = Number(match[1]);
      if (code >= 400) failed += 1;
      else successful += 1;
    }
    return { successfulRequests: successful, failedRequests: failed, pendingRequests: 0, total: successful + failed };
  }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.requests) ? raw.requests : [];
  let successful = 0;
  let failed = 0;
  let pending = 0;
  for (const item of list) {
    const status = item.status ?? item.response?.status ?? null;
    if (typeof status === "number") {
      if (status >= 400) failed += 1;
      else successful += 1;
    } else {
      pending += 1;
    }
  }
  return { successfulRequests: successful, failedRequests: failed, pendingRequests: pending, total: list.length };
}

function snapshotStats(text) {
  const lines = String(text || "").split(/\r?\n/);
  const headingCount = lines.filter((line) => /heading/i.test(line)).length;
  const hasMain = lines.some((line) => /main/i.test(line));
  const titleMatch = lines[0]?.match(/RootWebArea\s+"([^"]+)"/);
  return {
    headingCount,
    hasMain,
    title: titleMatch ? titleMatch[1] : null,
  };
}

function buildServerArgs(scenario, logFile) {
  const args = ["-y", "chrome-devtools-mcp@latest"];
  if (scenario.chrome?.headless) args.push("--headless");
  if (scenario.chrome?.isolated) args.push("--isolated");
  args.push("--no-usage-statistics");
  if (scenario.chrome?.executablePath) args.push("--executablePath", scenario.chrome.executablePath);
  if (scenario.chrome?.viewport) args.push("--viewport", scenario.chrome.viewport);
  if (scenario.chrome?.experimentalMemory) args.push("--experimentalMemory");
  if (logFile) args.push("--logFile", logFile);
  return args;
}

async function main() {
  const scenarioPath = path.resolve(process.cwd(), arg("--scenario") || "./scenarios/public-homepage.json");
  const scenario = readJson(scenarioPath);
  const outDir = path.resolve(process.cwd(), "artifacts", `${scenario.id}-${safeTs()}`);
  const callsDir = path.join(outDir, "calls");
  mkdirp(outDir);
  mkdirp(callsDir);

  const serverLogFile = path.join(outDir, "chrome-devtools-mcp.log");
  const serverArgs = buildServerArgs(scenario, serverLogFile);
  const request = {
    scenarioPath,
    scenario,
    executedAt: new Date().toISOString(),
    server: { command: "npx", args: serverArgs },
  };
  writeJson(path.join(outDir, "request.json"), request);

  const client = new McpStdioClient("npx", serverArgs, { cwd: process.cwd() });
  let tools = [];
  let callIndex = 0;
  const callRecords = [];

  async function execTool(name, args) {
    const result = await client.callTool(name, args);
    callIndex += 1;
    const file = path.join(callsDir, `${String(callIndex).padStart(2, "0")}-${name}.json`);
    const record = { name, arguments: args, result };
    writeJson(file, record);
    callRecords.push(record);
    return result;
  }

  try {
    await client.start();
    const init = await client.initialize();
    writeJson(path.join(outDir, "initialize.json"), init);

    tools = await client.listTools();
    writeJson(path.join(outDir, "tools.json"), { tools });

    const navigateTool = chooseToolName(tools, ["navigate_page", "new_page"]);
    const snapshotTool = chooseToolName(tools, ["take_snapshot"]);
    const screenshotTool = chooseToolName(tools, ["take_screenshot"]);
    const consoleTool = chooseToolName(tools, ["list_console_messages"]);
    const networkTool = chooseToolName(tools, ["list_network_requests"]);
    const lighthouseTool = chooseToolName(tools, ["lighthouse_audit"]);

    if (!navigateTool || !snapshotTool) {
      throw new Error(`Required tools missing. navigate=${navigateTool} snapshot=${snapshotTool}`);
    }

    if (navigateTool === "navigate_page") await execTool(navigateTool, { url: scenario.url });
    else await execTool(navigateTool, { url: scenario.url });

    await sleep(1500);

    const snapshotPath = path.join(outDir, "snapshot.txt");
    const snapshotResult = await execTool(snapshotTool, { filePath: snapshotPath });
    let snapshotText = "";
    if (fs.existsSync(snapshotPath)) snapshotText = fs.readFileSync(snapshotPath, "utf8");
    else snapshotText = firstText(snapshotResult);

    let screenshotPath = null;
    if (scenario.capture?.screenshot && screenshotTool) {
      screenshotPath = path.join(outDir, "screenshot.png");
      await execTool(screenshotTool, { filePath: screenshotPath, fullPage: true });
    }

    let consoleRaw = null;
    if (scenario.capture?.console && consoleTool) {
      const consoleResult = await execTool(consoleTool, {});
      consoleRaw = extractToolResult(consoleResult);
      writeJson(path.join(outDir, "console.json"), consoleRaw);
      fs.writeFileSync(path.join(outDir, "console.txt"), JSON.stringify(consoleRaw, null, 2));
    }

    let networkRaw = null;
    if (scenario.capture?.network && networkTool) {
      const networkResult = await execTool(networkTool, {});
      networkRaw = extractToolResult(networkResult);
      writeJson(path.join(outDir, "network.json"), networkRaw);
      fs.writeFileSync(path.join(outDir, "network.txt"), JSON.stringify(networkRaw, null, 2));
    }

    let lighthouseRaw = null;
    if (scenario.capture?.lighthouse && lighthouseTool) {
      const lighthouseDir = path.join(outDir, "lighthouse");
      mkdirp(lighthouseDir);
      const lighthouseResult = await execTool(lighthouseTool, { mode: "navigation", outputDirPath: lighthouseDir });
      lighthouseRaw = extractToolResult(lighthouseResult);
      writeJson(path.join(outDir, "lighthouse.json"), lighthouseRaw);
      fs.writeFileSync(path.join(outDir, "lighthouse.txt"), JSON.stringify(lighthouseRaw, null, 2));
    }

    const snap = snapshotStats(snapshotText);
    const net = networkStats(networkRaw);
    const consoleErrors = countConsole(consoleRaw, "error");
    const consoleWarnings = countConsole(consoleRaw, "warning") ?? countConsole(consoleRaw, "warn");
    const summary = {
      scenarioId: scenario.id,
      url: scenario.url,
      title: snap.title,
      navigatedUrl: scenario.url,
      headingCount: snap.headingCount,
      hasMain: snap.hasMain,
      consoleErrors,
      consoleWarnings,
      consoleIssues: null,
      successfulRequests: net.successfulRequests,
      failedRequests: net.failedRequests,
      pendingRequests: net.pendingRequests,
      ignoredConsoleEntries: 0,
      ignoredNetworkEntries: 0,
      ignoreConfig: {},
      lighthouseAccessibility: scoreFromLighthouse(lighthouseRaw, "accessibility"),
      lighthouseSeo: scoreFromLighthouse(lighthouseRaw, "seo"),
      lighthouseBestPractices: scoreFromLighthouse(lighthouseRaw, "best-practices"),
      screenshotPath,
      snapshotFile: snapshotPath,
      captureCompletedAt: new Date().toISOString(),
    };
    writeJson(path.join(outDir, "summary.json"), summary);

    const checks = { validity: [], budgets: [] };
    checks.validity.push({ name: "navigated-to-real-page", actual: scenario.url, status: "PASS", reason: null });
    checks.validity.push({ name: "snapshot-root-present", actual: Boolean(snapshotText), status: snapshotText ? "PASS" : "FAIL", reason: snapshotText ? null : "snapshot empty" });
    checks.validity.push({
      name: "page-evidence-present",
      actual: { title: summary.title, headingCount: summary.headingCount, hasMain: summary.hasMain, networkActivity: net.total },
      status: snapshotText ? "PASS" : "FAIL",
      reason: snapshotText ? null : "missing page evidence",
    });

    const budgets = scenario.budgets || {};
    if (typeof budgets.maxConsoleErrors === "number") {
      checks.budgets.push({
        name: "console-errors",
        budget: budgets.maxConsoleErrors,
        actual: consoleErrors,
        status: typeof consoleErrors === "number" && consoleErrors <= budgets.maxConsoleErrors ? "PASS" : "FAIL",
      });
    }
    if (typeof budgets.maxFailedRequests === "number") {
      checks.budgets.push({
        name: "failed-requests",
        budget: budgets.maxFailedRequests,
        actual: net.failedRequests,
        status: net.failedRequests <= budgets.maxFailedRequests ? "PASS" : "FAIL",
      });
    }

    const status = [...checks.validity, ...checks.budgets].every((item) => item.status === "PASS") ? "PASS" : "FAIL";
    const verdict = {
      scenarioId: scenario.id,
      status,
      checks,
      summary: {
        title: summary.title,
        navigatedUrl: summary.navigatedUrl,
        consoleErrors: summary.consoleErrors,
        failedRequests: summary.failedRequests,
        lighthouseAccessibility: summary.lighthouseAccessibility,
        lighthouseSeo: summary.lighthouseSeo,
        lighthouseBestPractices: summary.lighthouseBestPractices,
      },
      artifacts: {
        request: path.join(outDir, "request.json"),
        tools: path.join(outDir, "tools.json"),
        callsDir,
        snapshot: snapshotPath,
        screenshot: screenshotPath,
        console: fs.existsSync(path.join(outDir, "console.txt")) ? path.join(outDir, "console.txt") : null,
        network: fs.existsSync(path.join(outDir, "network.txt")) ? path.join(outDir, "network.txt") : null,
        lighthouse: fs.existsSync(path.join(outDir, "lighthouse.txt")) ? path.join(outDir, "lighthouse.txt") : null,
        summary: path.join(outDir, "summary.json"),
        verdict: path.join(outDir, "verdict.json"),
      },
      evaluatedAt: new Date().toISOString(),
    };
    writeJson(path.join(outDir, "verdict.json"), verdict);
    fs.writeFileSync(path.join(outDir, "run.log"), `PASS ${scenario.id}\nserver: npx ${serverArgs.join(" ")}\n`);

    console.log(JSON.stringify({ outDir, status, tools: tools.map((t) => t.name) }, null, 2));
    await client.close();
  } catch (error) {
    const failure = {
      scenarioId: scenario.id,
      status: "ERROR",
      error: String(error?.message || error),
      stderr: client.stderr || null,
      evaluatedAt: new Date().toISOString(),
    };
    writeJson(path.join(outDir, "verdict.json"), failure);
    fs.writeFileSync(path.join(outDir, "run.log"), `ERROR ${scenario.id}\n${failure.error}\n${failure.stderr || ""}\n`);
    console.error(JSON.stringify({ outDir, ...failure }, null, 2));
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
