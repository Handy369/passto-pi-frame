import type { PlannedPerspectiveExecution } from "./orchestration.ts";

export interface DagValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateExecutionDag(items: PlannedPerspectiveExecution[]): DagValidationResult {
  const names = new Set(items.map((item) => item.perspective.name));
  const errors: string[] = [];

  for (const item of items) {
    for (const dependency of item.dependsOn) {
      if (!names.has(dependency)) {
        errors.push(`Perspective '${item.perspective.name}' depends on unknown perspective '${dependency}'`);
      }
      if (dependency === item.perspective.name) {
        errors.push(`Perspective '${item.perspective.name}' cannot depend on itself`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const itemMap = new Map(items.map((item) => [item.perspective.name, item]));

  function visit(name: string, stack: string[]): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      errors.push(`Dependency cycle detected: ${[...stack, name].join(" -> ")}`);
      return;
    }

    visiting.add(name);
    const item = itemMap.get(name);
    for (const dependency of item?.dependsOn ?? []) {
      if (itemMap.has(dependency)) visit(dependency, [...stack, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const item of items) visit(item.perspective.name, []);

  return {
    ok: errors.length === 0,
    errors,
  };
}
