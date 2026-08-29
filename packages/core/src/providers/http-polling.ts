import type { FlagProvider, FlagRemoteState } from "../types";
import { cancelTimeout, getGlobalFetch, scheduleTimeout, type FetchLike } from "./platform";
import { parseRemoteStateResponse } from "./response-shape";

export interface HttpPollingProviderOptions {
  url: string;
  /** Steady-state poll interval, ms. Default 30_000. */
  intervalMs?: number;
  fetchImpl?: FetchLike;
  headers?: Record<string, string>;
  /** Test seam. */
  now?: () => number;
  /** Jitter test seam. Default Math.random. */
  random?: () => number;
}

const DEFAULT_INTERVAL_MS = 30_000;

function backoffDelay(intervalMs: number, consecutiveFailures: number, random: () => number): number {
  const cap = Math.min(intervalMs * 10, 300_000);
  const raw = Math.min(cap, intervalMs * 2 ** (consecutiveFailures - 1));
  // Equal Jitter: 50%-100% of raw, so a backed-off retry never degenerates
  // to a near-immediate retry on an unlucky jitter roll.
  return raw / 2 + random() * (raw / 2);
}

/**
 * Polls a single URL for FlagRemoteState[]. init() only resolves the fetch
 * implementation — the first real fetch happens via FlagsClient.init()'s
 * existing refresh() call, not here, to avoid a duplicate initial request.
 */
export class HttpPollingProvider implements FlagProvider {
  name = "http-polling";

  private readonly url: string;
  private readonly intervalMs: number;
  private readonly headers: Record<string, string> | undefined;
  private readonly now: () => number;
  private readonly random: () => number;
  private fetchImpl: FetchLike | undefined;

  private stopped = false;
  private timerHandle: unknown;

  constructor(options: HttpPollingProviderOptions) {
    this.url = options.url;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.headers = options.headers;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.fetchImpl = options.fetchImpl;
  }

  async init(): Promise<void> {
    this.fetchImpl = this.fetchImpl ?? getGlobalFetch();
    if (!this.fetchImpl) {
      throw new Error("HttpPollingProvider: no fetchImpl provided and no global fetch is available");
    }
  }

  async getRemoteState(keys?: string[]): Promise<FlagRemoteState[]> {
    const fetchImpl = this.fetchImpl;
    if (!fetchImpl) throw new Error("HttpPollingProvider: init() must resolve a fetch implementation before use");

    const res = await fetchImpl(this.url, { headers: this.headers });
    if (!res.ok) throw new Error(`HttpPollingProvider: unexpected status ${res.status}`);

    const body = await res.json();
    const states = parseRemoteStateResponse(body);
    return keys ? states.filter((s) => keys.includes(s.key)) : states;
  }

  subscribe(onUpdate: (state: FlagRemoteState[]) => void): () => void {
    this.stopped = false;
    let consecutiveFailures = 0;

    const tick = (): void => {
      if (this.stopped) return;
      this.getRemoteState()
        .then((states) => {
          if (this.stopped) return;
          consecutiveFailures = 0;
          onUpdate(states);
          if (!this.stopped) this.timerHandle = scheduleTimeout(tick, this.intervalMs);
        })
        .catch(() => {
          if (this.stopped) return;
          consecutiveFailures++;
          const delay = backoffDelay(this.intervalMs, consecutiveFailures, this.random);
          if (!this.stopped) this.timerHandle = scheduleTimeout(tick, delay);
        });
    };

    this.timerHandle = scheduleTimeout(tick, this.intervalMs);

    return () => {
      this.stopped = true;
      cancelTimeout(this.timerHandle);
    };
  }
}
