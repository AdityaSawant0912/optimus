/**
 * Structural, minimal typings for platform APIs (fetch/EventSource/timers)
 * resolved via `globalThis` casts through `unknown`, rather than widening
 * tsconfig `lib` to "DOM" or adding `@types/node`. Either of those would
 * ambiently restore `window`/`document`/`localStorage` (or Node globals)
 * throughout every file in `core`, defeating the compiler guardrail behind
 * CLAUDE.md's "core has zero framework dependencies" rule. Every lookup
 * here reads the global fresh on each call (not captured at import time)
 * so `vi.useFakeTimers()`/`vi.stubGlobal()` work transparently in tests.
 */

export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchLikeResponse>;

export function getGlobalFetch(): FetchLike | undefined {
  return (globalThis as unknown as { fetch?: FetchLike }).fetch;
}

export interface EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}

export type EventSourceCtor = new (url: string) => EventSourceLike;

export function getGlobalEventSourceCtor(): EventSourceCtor | undefined {
  return (globalThis as unknown as { EventSource?: EventSourceCtor }).EventSource;
}

export function scheduleTimeout(fn: () => void, ms: number): unknown {
  return (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => unknown }).setTimeout(fn, ms);
}

export function cancelTimeout(handle: unknown): void {
  (globalThis as unknown as { clearTimeout: (handle: unknown) => void }).clearTimeout(handle);
}
