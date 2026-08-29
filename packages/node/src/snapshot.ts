import type { EvaluatedFlag } from "@useoptimus/core";

export const SNAPSHOT_VERSION = 1;

export interface SerializedSnapshot {
  version: typeof SNAPSHOT_VERSION;
  /** ms epoch — matches the now?:()=>number seams used in client.ts/cache.ts. */
  generatedAt: number;
  flags: Record<string, EvaluatedFlag<unknown>>;
}

/**
 * engine.ts always sets EvaluatedFlag.variantKey/ruleMatched to explicit
 * `undefined` when absent, never omits them. A snapshot that preserved that
 * verbatim wouldn't actually be JSON-safe until JSON.stringify silently
 * dropped those keys later — this strips them to omitted keys up front so
 * SerializedSnapshot is JSON-safe by construction, not by accident.
 *
 * Takes `EvaluatedFlag<unknown>` (rather than the bare, boolean-defaulted
 * `EvaluatedFlag`) so it accepts FlagsClient.evaluateAll()'s output as-is,
 * plus any heterogeneously-typed flag map, with no cast at the call site.
 */
export function serializeSnapshot(
  evaluated: Record<string, EvaluatedFlag<unknown>>,
  now: () => number = Date.now,
): SerializedSnapshot {
  const flags: Record<string, EvaluatedFlag<unknown>> = {};
  for (const [key, flag] of Object.entries(evaluated)) {
    const entry: EvaluatedFlag<unknown> = { key: flag.key, value: flag.value, reason: flag.reason, stale: flag.stale };
    if (flag.variantKey !== undefined) entry.variantKey = flag.variantKey;
    if (flag.ruleMatched !== undefined) entry.ruleMatched = flag.ruleMatched;
    flags[key] = entry;
  }
  return { version: SNAPSHOT_VERSION, generatedAt: now(), flags };
}

/**
 * Takes only the snapshot — no FlagDefinition[], no provider, no context —
 * so re-evaluation is structurally impossible, not just conventionally
 * avoided (PLAN.md Decision #2).
 */
export function hydrateSnapshot(snapshot: SerializedSnapshot): Record<string, EvaluatedFlag<unknown>> {
  if (snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error(
      `hydrateSnapshot: unsupported snapshot version ${snapshot.version} (expected ${SNAPSHOT_VERSION})`,
    );
  }

  const out: Record<string, EvaluatedFlag<unknown>> = {};
  for (const [key, flag] of Object.entries(snapshot.flags)) {
    out[key] = { ...flag };
  }
  return out;
}
