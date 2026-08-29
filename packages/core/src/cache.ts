import type { FlagsClient, FlagStateCache, FlagStateEntry } from "./client";
import { scheduleTimeout } from "./providers/platform";

export type CacheStaleness = "fresh" | "stale" | "unknown";

export interface TtlFlagStateCacheOptions {
  /** Age (ms) past which an entry is considered stale. Default 30_000. */
  ttlMs?: number;
  /** How long past ttlMs a stale entry is still served as last-known-good
   *  before failureMode fallbacks would need to take over. This cache does
   *  not itself drop data at this boundary — see class doc. Default 300_000. */
  staleWhileRevalidateMs?: number;
  /** Minimum time between onStale triggers for the same key, independent of
   *  set() calls. Default = ttlMs. See class doc for why this must not be
   *  "cleared on next set()" instead. */
  retriggerCooldownMs?: number;
  now?: () => number;
  onStale?: (key: string) => void;
}

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_SWR_MS = 300_000;

/**
 * A FlagStateCache that adds TTL-based staleness *notification* on top of a
 * plain in-memory store. `get()`/`set()` are pure passthroughs — TTL age
 * never changes what's returned, never synthesizes a `lastError`, and never
 * evicts data. Dropping this in for the default in-memory cache changes
 * zero observable evaluate()/evaluateAll() output by itself; the only
 * effect is the `onStale` side-channel (see `wireAutoRevalidation`) and the
 * `isStale`/`getStaleness` introspection methods.
 *
 * Staleness suppression is cooldown-based (`retriggerCooldownMs` since the
 * last trigger), not "cleared on the next set()" — a *failed* refresh still
 * calls `set()` (preserving the old fetchedAt, only setting lastError), so
 * clearing suppression on any set() would re-arm and re-fire on every
 * failed attempt during a sustained outage, busy-looping onStale.
 */
export class TtlFlagStateCache implements FlagStateCache {
  private readonly store = new Map<string, FlagStateEntry>();
  private readonly lastTriggerAt = new Map<string, number>();

  private readonly ttlMs: number;
  private readonly staleWhileRevalidateMs: number;
  private readonly retriggerCooldownMs: number;
  private readonly now: () => number;
  private onStaleHandler: ((key: string) => void) | undefined;

  constructor(options: TtlFlagStateCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.staleWhileRevalidateMs = options.staleWhileRevalidateMs ?? DEFAULT_SWR_MS;
    this.retriggerCooldownMs = options.retriggerCooldownMs ?? this.ttlMs;
    this.now = options.now ?? Date.now;
    this.onStaleHandler = options.onStale;
  }

  get(key: string): FlagStateEntry | undefined {
    const entry = this.store.get(key);
    this.maybeTriggerStale(key, entry);
    return entry;
  }

  set(key: string, entry: FlagStateEntry): void {
    this.store.set(key, entry);
  }

  isStale(key: string): boolean {
    return this.getStaleness(key) === "stale";
  }

  getStaleness(key: string): CacheStaleness {
    const entry = this.store.get(key);
    if (entry?.fetchedAt === undefined) return "unknown";
    return this.now() - entry.fetchedAt >= this.ttlMs ? "stale" : "fresh";
  }

  setOnStale(handler: ((key: string) => void) | undefined): void {
    this.onStaleHandler = handler;
  }

  private maybeTriggerStale(key: string, entry: FlagStateEntry | undefined): void {
    if (!this.onStaleHandler) return;
    if (entry?.fetchedAt === undefined) return;

    const age = this.now() - entry.fetchedAt;
    if (age < this.ttlMs) return;

    const last = this.lastTriggerAt.get(key) ?? -Infinity;
    if (this.now() - last < this.retriggerCooldownMs) return;

    this.lastTriggerAt.set(key, this.now());
    try {
      this.onStaleHandler(key);
    } catch {
      // never let a bad handler break a cache read
    }
  }
}

/**
 * Wires cache staleness to client.refresh() without modifying client.ts.
 * All keys that go stale in the same synchronous tick (e.g. one
 * evaluateAll() call right after a shared fetchedAt crosses the TTL
 * boundary) are batched into a single refresh([...keys]) call instead of
 * one refresh per key.
 */
export function wireAutoRevalidation(
  cache: TtlFlagStateCache,
  client: Pick<FlagsClient, "refresh">,
): () => void {
  let pendingKeys: string[] | undefined;

  cache.setOnStale((key) => {
    if (pendingKeys) {
      pendingKeys.push(key);
      return;
    }
    pendingKeys = [key];
    scheduleTimeout(() => {
      const keys = pendingKeys;
      pendingKeys = undefined;
      if (keys) void client.refresh(keys);
    }, 0);
  });

  return () => cache.setOnStale(undefined);
}
