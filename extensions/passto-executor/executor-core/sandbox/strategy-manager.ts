import type { SandboxCreateParams, SandboxHandle, SandboxManager } from "../sandbox.ts";

export interface NamedSandboxStrategy {
  name: string;
  manager: SandboxManager;
}

export interface StrategySandboxManagerOptions {
  defaultStrategy: string;
  strategies: NamedSandboxStrategy[];
}

export class StrategySandboxManager implements SandboxManager {
  private readonly defaultStrategy: string;
  private readonly strategies: Map<string, SandboxManager>;

  constructor(options: StrategySandboxManagerOptions) {
    this.defaultStrategy = options.defaultStrategy;
    this.strategies = new Map(options.strategies.map((item) => [item.name, item.manager]));
  }

  async createPerspectiveSandbox(params: SandboxCreateParams & { strategy?: string }): Promise<SandboxHandle> {
    const strategy = params.strategy ?? this.defaultStrategy;
    const manager = this.strategies.get(strategy);
    if (!manager) throw new Error(`Unknown sandbox strategy: ${strategy}`);
    const handle = await manager.createPerspectiveSandbox(params);
    return {
      ...handle,
      metadata: {
        ...handle.metadata,
        strategy,
      },
    };
  }
}
