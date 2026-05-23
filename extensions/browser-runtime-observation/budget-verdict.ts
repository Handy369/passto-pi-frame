import type { NormalizedModeEvidence } from "./mode-evidence";

export interface RuntimeBudgetConfig {
  maxConsoleErrors?: number;
  maxConsoleWarnings?: number;
  maxConsoleIssues?: number;
  maxFailedRequests?: number;
  minAccessibilityScore?: number;
  minSeoScore?: number;
  minBestPracticesScore?: number;
  lighthousePerformanceMin?: number;
  maxLcpMs?: number;
  maxCls?: number;
  maxInpMs?: number;
  maxTotalBlockingTimeMs?: number;
  maxRetainedSizeMb?: number;
}

export interface BudgetCheck {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  budget: number | string;
  actual: number | string | null;
  reason: string;
}

export interface BudgetVerdict {
  status: "PENDING" | "PASS" | "FAIL" | "NOT_EVALUATED";
  summary: string;
  checks: BudgetCheck[];
  evaluatedAt: string;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareMax(name: string, actual: number | null, budget: number): BudgetCheck {
  if (actual === null) {
    return { name, status: "SKIP", budget, actual, reason: "actual metric missing" };
  }
  return {
    name,
    status: actual <= budget ? "PASS" : "FAIL",
    budget,
    actual,
    reason: actual <= budget ? `actual <= budget (${actual} <= ${budget})` : `actual > budget (${actual} > ${budget})`,
  };
}

function compareMin(name: string, actual: number | null, budget: number): BudgetCheck {
  if (actual === null) {
    return { name, status: "SKIP", budget, actual, reason: "actual metric missing" };
  }
  return {
    name,
    status: actual >= budget ? "PASS" : "FAIL",
    budget,
    actual,
    reason: actual >= budget ? `actual >= budget (${actual} >= ${budget})` : `actual < budget (${actual} < ${budget})`,
  };
}

export function buildPendingVerdict(): BudgetVerdict {
  return {
    status: "PENDING",
    summary: "Budget verdict pending until the observation request is finalized.",
    checks: [],
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluateBudgets(budgets: RuntimeBudgetConfig, normalizedEvidence: NormalizedModeEvidence): BudgetVerdict {
  const checks: BudgetCheck[] = [];
  const metrics = normalizedEvidence.metrics;

  if (typeof budgets.maxConsoleErrors === "number") {
    checks.push(compareMax("console-errors", toNumber(metrics.consoleErrors), budgets.maxConsoleErrors));
  }
  if (typeof budgets.maxConsoleWarnings === "number") {
    checks.push(compareMax("console-warnings", toNumber(metrics.consoleWarnings), budgets.maxConsoleWarnings));
  }
  if (typeof budgets.maxConsoleIssues === "number") {
    checks.push(compareMax("console-issues", toNumber(metrics.consoleIssues), budgets.maxConsoleIssues));
  }
  if (typeof budgets.maxFailedRequests === "number") {
    checks.push(compareMax("failed-requests", toNumber(metrics.failedRequests), budgets.maxFailedRequests));
  }
  if (typeof budgets.minAccessibilityScore === "number") {
    checks.push(compareMin("accessibility-score", toNumber(metrics.accessibility), budgets.minAccessibilityScore));
  }
  if (typeof budgets.minSeoScore === "number") {
    checks.push(compareMin("seo-score", toNumber(metrics.seo), budgets.minSeoScore));
  }
  if (typeof budgets.minBestPracticesScore === "number") {
    checks.push(compareMin("best-practices-score", toNumber(metrics.bestPractices), budgets.minBestPracticesScore));
  }
  if (typeof budgets.maxLcpMs === "number") {
    checks.push(compareMax("lcp-ms", toNumber(metrics.lcpMs), budgets.maxLcpMs));
  }
  if (typeof budgets.maxCls === "number") {
    checks.push(compareMax("cls", toNumber(metrics.cls), budgets.maxCls));
  }
  if (typeof budgets.maxInpMs === "number") {
    checks.push(compareMax("inp-ms", toNumber(metrics.inpMs), budgets.maxInpMs));
  }
  if (typeof budgets.maxTotalBlockingTimeMs === "number") {
    checks.push(compareMax("tbt-ms", toNumber(metrics.totalBlockingTimeMs), budgets.maxTotalBlockingTimeMs));
  }
  if (typeof budgets.maxRetainedSizeMb === "number") {
    checks.push(compareMax("retained-size-mb", toNumber(metrics.retainedSizeMb), budgets.maxRetainedSizeMb));
  }
  if (typeof budgets.lighthousePerformanceMin === "number") {
    checks.push({
      name: "lighthouse-performance-score",
      status: "SKIP",
      budget: budgets.lighthousePerformanceMin,
      actual: null,
      reason: "lighthouse_audit from chrome-devtools-mcp does not currently expose performance score; use maxLcpMs/maxCls/maxInpMs instead.",
    });
  }

  if (checks.length === 0) {
    return {
      status: "NOT_EVALUATED",
      summary: "No runtime budgets were configured for this observation request.",
      checks,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const failCount = checks.filter((check) => check.status === "FAIL").length;
  const passCount = checks.filter((check) => check.status === "PASS").length;
  const skipCount = checks.filter((check) => check.status === "SKIP").length;

  const status = failCount > 0 ? "FAIL" : passCount > 0 ? "PASS" : "NOT_EVALUATED";
  const summary =
    status === "FAIL"
      ? `Runtime budgets failed: ${failCount} check(s) failed, ${passCount} passed, ${skipCount} skipped.`
      : status === "PASS"
        ? `Runtime budgets passed: ${passCount} check(s) passed, ${skipCount} skipped.`
        : `Runtime budgets were not evaluable: ${skipCount} check(s) skipped.`;

  return {
    status,
    summary,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}
