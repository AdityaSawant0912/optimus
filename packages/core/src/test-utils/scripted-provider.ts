import type { FlagProvider, FlagRemoteState } from "../types";

type Step = { state: FlagRemoteState[] } | { throws: unknown };

export interface ScriptedProviderOptions {
  initBehavior?: "ok" | { throws: unknown };
  /** Consumed in order, one per getRemoteState() call. The last step repeats
   *  once exhausted, so a test doesn't have to pad out every call. */
  steps: Step[];
}

export class ScriptedProvider implements FlagProvider {
  name = "scripted";

  private readonly initBehavior: "ok" | { throws: unknown };
  private readonly steps: Step[];
  private callIndex = 0;

  constructor(options: ScriptedProviderOptions) {
    this.initBehavior = options.initBehavior ?? "ok";
    this.steps = options.steps;
  }

  async init(): Promise<void> {
    if (this.initBehavior !== "ok") throw this.initBehavior.throws;
  }

  async getRemoteState(keys?: string[]): Promise<FlagRemoteState[]> {
    const step = this.steps[Math.min(this.callIndex, this.steps.length - 1)];
    this.callIndex++;
    if (!step) return [];
    if ("throws" in step) throw step.throws;
    return keys ? step.state.filter((s) => keys.includes(s.key)) : step.state;
  }
}

export class PushCapableScriptedProvider extends ScriptedProvider {
  private updateHandler: ((state: FlagRemoteState[]) => void) | undefined;

  subscribe(onUpdate: (state: FlagRemoteState[]) => void): () => void {
    this.updateHandler = onUpdate;
    return () => {
      this.updateHandler = undefined;
    };
  }

  /** Test-only: simulate a provider push, including malformed payloads. */
  simulatePush(state: FlagRemoteState[] | unknown): void {
    this.updateHandler?.(state as FlagRemoteState[]);
  }
}
