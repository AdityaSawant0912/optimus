import type { FlagProvider, FlagRemoteState } from "../types";

/** Static/in-memory provider — no network. Used for tests and local dev. */
export class LocalProvider implements FlagProvider {
  name = "local";

  constructor(private readonly state: FlagRemoteState[]) {}

  async init(): Promise<void> {
    // nothing to initialize
  }

  async getRemoteState(keys?: string[]): Promise<FlagRemoteState[]> {
    if (!keys) return this.state;
    return this.state.filter((s) => keys.includes(s.key));
  }
}
