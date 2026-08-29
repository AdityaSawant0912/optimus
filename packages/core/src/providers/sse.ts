import type { FlagProvider, FlagRemoteState } from "../types";
import { getGlobalEventSourceCtor, type EventSourceCtor, type EventSourceLike } from "./platform";
import { parseRemoteStateResponse } from "./response-shape";

export interface SseProviderOptions {
  url: string;
  eventSourceFactory?: () => EventSourceLike;
}

/**
 * getRemoteState() returns the last-known pushed state ([] before the first
 * message) rather than performing a network fetch — a flag with no
 * confirmed state evaluates against its code default until the provider
 * proves otherwise, the same fail-safe shape already used by merge.ts.
 *
 * Consequence, not worked around here: FlagsClient.init() calls
 * provider.init() -> refresh() -> subscribe() in that order, so for an
 * SseProvider-only client the very first refresh() always sees [] because
 * the connection hasn't opened yet. Seed from another provider, or expect
 * data only after the first push (which flows through onProviderPush
 * automatically).
 *
 * No self-implemented reconnect: both the browser's native EventSource and
 * the `eventsource` npm package already auto-reconnect per the SSE spec.
 * onerror is a deliberate no-op — a second reconnect loop on top would race
 * the transport's own retry timer.
 */
export class SseProvider implements FlagProvider {
  name = "sse";

  private readonly url: string;
  private readonly eventSourceFactory: (() => EventSourceLike) | undefined;
  private lastKnownState: FlagRemoteState[] = [];
  private source: EventSourceLike | undefined;

  constructor(options: SseProviderOptions) {
    this.url = options.url;
    this.eventSourceFactory = options.eventSourceFactory;
  }

  async init(): Promise<void> {
    // Config validation only — the connection opens in subscribe().
  }

  async getRemoteState(keys?: string[]): Promise<FlagRemoteState[]> {
    return keys ? this.lastKnownState.filter((s) => keys.includes(s.key)) : this.lastKnownState;
  }

  subscribe(onUpdate: (state: FlagRemoteState[]) => void): () => void {
    const source = this.resolveEventSource();
    this.source = source;
    let stopped = false;

    source.onmessage = (event) => {
      if (stopped) return;
      let parsed: FlagRemoteState[];
      try {
        parsed = parseRemoteStateResponse(JSON.parse(event.data));
      } catch {
        return; // malformed message: dropped, connection untouched
      }
      this.lastKnownState = parsed;
      onUpdate(parsed);
    };
    source.onerror = null;

    return () => {
      stopped = true;
      source.onmessage = null;
      source.onerror = null;
      source.close();
    };
  }

  private resolveEventSource(): EventSourceLike {
    if (this.eventSourceFactory) return this.eventSourceFactory();

    const Ctor: EventSourceCtor | undefined = getGlobalEventSourceCtor();
    if (!Ctor) {
      throw new Error(
        "SseProvider: no eventSourceFactory provided and no global EventSource is available " +
          "(e.g. in Node, pass a factory wrapping the 'eventsource' npm package)",
      );
    }
    return new Ctor(this.url);
  }
}
