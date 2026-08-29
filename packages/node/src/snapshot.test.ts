import { describe, expect, it } from "vitest";
import { SNAPSHOT_VERSION, hydrateSnapshot, serializeSnapshot } from "./snapshot";
import type { EvaluatedFlag } from "@useoptimus/core";

function fixture(): Record<string, EvaluatedFlag<unknown>> {
  return {
    "plain-bool": { key: "plain-bool", value: false, reason: "default", stale: false, variantKey: undefined },
    "stale-bool": { key: "stale-bool", value: true, reason: "fallbackError", stale: true, variantKey: undefined },
    experiment: { key: "experiment", value: "treatment", reason: "rollout", stale: false, variantKey: "treatment" },
    targeted: {
      key: "targeted",
      value: true,
      reason: "targetingMatch",
      stale: false,
      variantKey: undefined,
      ruleMatched: "rule-1",
    },
    config: {
      key: "config",
      value: { maxItems: 10, nested: { enabled: true } },
      reason: "override",
      stale: false,
      variantKey: undefined,
    },
  };
}

describe("serializeSnapshot", () => {
  it("stamps the configured version and injected generatedAt", () => {
    const snapshot = serializeSnapshot(fixture(), () => 1_700_000_000_000);
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.generatedAt).toBe(1_700_000_000_000);
  });

  it("defaults generatedAt to (roughly) Date.now() when no clock is injected", () => {
    const before = Date.now();
    const snapshot = serializeSnapshot(fixture());
    expect(typeof snapshot.generatedAt).toBe("number");
    expect(snapshot.generatedAt).toBeGreaterThanOrEqual(before);
  });

  it("omits variantKey/ruleMatched entirely when absent, rather than keeping them as undefined", () => {
    const snapshot = serializeSnapshot(fixture());
    expect("variantKey" in snapshot.flags["plain-bool"]!).toBe(false);
    expect("ruleMatched" in snapshot.flags["plain-bool"]!).toBe(false);
    expect(snapshot.flags["experiment"]!.variantKey).toBe("treatment");
    expect(snapshot.flags["targeted"]!.ruleMatched).toBe("rule-1");
  });

  it("produces output with no hidden undefined values a real JSON round-trip would strip", () => {
    const snapshot = serializeSnapshot(fixture(), () => 1_700_000_000_000);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("hydrateSnapshot", () => {
  it("round-trips serializeSnapshot's output back to the original evaluated flags", () => {
    const evaluated = fixture();
    const snapshot = serializeSnapshot(evaluated, () => 1_700_000_000_000);
    expect(hydrateSnapshot(snapshot)).toEqual(evaluated);
  });

  it("survives an actual JSON.stringify/parse wire round-trip too", () => {
    const evaluated = fixture();
    const wire = JSON.parse(JSON.stringify(serializeSnapshot(evaluated, () => 1_700_000_000_000)));
    expect(hydrateSnapshot(wire)).toEqual(evaluated);
  });

  it("returns a copy — mutating the result does not affect the source snapshot", () => {
    const snapshot = serializeSnapshot(fixture());
    const hydrated = hydrateSnapshot(snapshot);
    hydrated["plain-bool"]!.value = true;
    expect(snapshot.flags["plain-bool"]!.value).toBe(false);
  });

  it("throws on an unsupported version instead of hydrating leniently", () => {
    const snapshot = serializeSnapshot(fixture());
    expect(() => hydrateSnapshot({ ...snapshot, version: 999 as typeof SNAPSHOT_VERSION })).toThrow(
      /unsupported snapshot version/,
    );
  });
});
