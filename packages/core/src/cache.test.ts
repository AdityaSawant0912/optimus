import { describe, expect, it, vi } from "vitest";
import { TtlFlagStateCache, wireAutoRevalidation } from "./cache";
import { FlagsClient } from "./client";
import { ScriptedProvider } from "./test-utils/scripted-provider";
import type { FlagDefinition, FlagRemoteState } from "./types";

function makeClock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

function entry(overrides: Partial<{ remoteState: FlagRemoteState | undefined; fetchedAt: number | undefined; lastError: unknown }>) {
  return { remoteState: undefined, fetchedAt: undefined, lastError: undefined, ...overrides };
}

describe("TtlFlagStateCache — passthrough", () => {
  it("get()/set() never mutate remoteState/lastError/fetchedAt beyond passthrough", () => {
    const cache = new TtlFlagStateCache();
    const stored = entry({ remoteState: { key: "a", enabled: true, updatedAt: "now" }, fetchedAt: 100 });
    cache.set("a", stored);
    expect(cache.get("a")).toEqual(stored);
  });

  it("changing the default in-memory cache for TtlFlagStateCache does not alter what get() returns", () => {
    const clock = makeClock();
    const cache = new TtlFlagStateCache({ now: clock.now });
    const stored = entry({ remoteState: { key: "a", enabled: true, updatedAt: "now" }, fetchedAt: 0 });
    cache.set("a", stored);
    clock.advance(1_000_000); // far past ttl/swr
    expect(cache.get("a")).toEqual(stored); // still returns the same entry, no eviction/synthesis
  });
});

describe("TtlFlagStateCache — staleness", () => {
  it("defaults: fresh below 30s, stale at/after 30s", () => {
    const clock = makeClock();
    const cache = new TtlFlagStateCache({ now: clock.now });
    cache.set("a", entry({ fetchedAt: 0 }));

    clock.advance(29_999);
    expect(cache.getStaleness("a")).toBe("fresh");
    expect(cache.isStale("a")).toBe(false);

    clock.advance(2); // now at 30_001
    expect(cache.getStaleness("a")).toBe("stale");
    expect(cache.isStale("a")).toBe(true);
  });

  it("never-fetched entries are 'unknown', not 'stale'", () => {
    const cache = new TtlFlagStateCache();
    expect(cache.getStaleness("missing")).toBe("unknown");
    cache.set("a", entry({ lastError: new Error("boom") })); // fetchedAt still undefined
    expect(cache.getStaleness("a")).toBe("unknown");
  });
});

describe("TtlFlagStateCache — onStale firing", () => {
  it("fires once when crossing the TTL boundary, then is suppressed for retriggerCooldownMs", () => {
    const clock = makeClock();
    const onStale = vi.fn();
    const cache = new TtlFlagStateCache({ now: clock.now, onStale, ttlMs: 1000, retriggerCooldownMs: 1000 });
    cache.set("a", entry({ fetchedAt: 0 }));

    clock.advance(1000);
    cache.get("a");
    cache.get("a");
    cache.get("a");
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith("a");

    clock.advance(500); // still within cooldown
    cache.get("a");
    expect(onStale).toHaveBeenCalledTimes(1);

    clock.advance(500); // cooldown elapsed (total 1000 since last trigger)
    cache.get("a");
    expect(onStale).toHaveBeenCalledTimes(2);
  });

  it("suppression is NOT cleared by a failed set() (busy-loop regression)", () => {
    const clock = makeClock();
    const onStale = vi.fn();
    const cache = new TtlFlagStateCache({ now: clock.now, onStale, ttlMs: 1000, retriggerCooldownMs: 1000 });
    cache.set("a", entry({ fetchedAt: 0 }));

    clock.advance(1000);
    cache.get("a"); // triggers once
    expect(onStale).toHaveBeenCalledTimes(1);

    // Simulate a failed refresh() call: fetchedAt preserved, lastError set —
    // exactly what client.ts's refresh() catch branch does.
    cache.set("a", entry({ fetchedAt: 0, lastError: new Error("still down") }));
    cache.get("a"); // must NOT re-fire immediately just because set() ran
    expect(onStale).toHaveBeenCalledTimes(1);

    clock.advance(1000); // cooldown elapsed
    cache.get("a");
    expect(onStale).toHaveBeenCalledTimes(2);
  });

  it("does not fire when no handler is configured", () => {
    const clock = makeClock();
    const cache = new TtlFlagStateCache({ now: clock.now, ttlMs: 1000 });
    cache.set("a", entry({ fetchedAt: 0 }));
    clock.advance(2000);
    expect(() => cache.get("a")).not.toThrow();
  });

  it("setOnStale attached after construction still fires on a later stale get()", () => {
    const clock = makeClock();
    const cache = new TtlFlagStateCache({ now: clock.now, ttlMs: 1000 });
    cache.set("a", entry({ fetchedAt: 0 }));
    const onStale = vi.fn();
    cache.setOnStale(onStale);

    clock.advance(1000);
    cache.get("a");
    expect(onStale).toHaveBeenCalledWith("a");
  });

  it("a bad onStale handler never breaks the read", () => {
    const clock = makeClock();
    const cache = new TtlFlagStateCache({
      now: clock.now,
      ttlMs: 1000,
      onStale: () => {
        throw new Error("handler exploded");
      },
    });
    cache.set("a", entry({ fetchedAt: 0 }));
    clock.advance(1000);
    expect(() => cache.get("a")).not.toThrow();
  });
});

describe("wireAutoRevalidation", () => {
  function boolFlag(key: string): FlagDefinition<boolean> {
    return {
      key,
      kind: "release",
      valueType: "boolean",
      defaultValue: false,
      failureMode: "closed",
      sticky: false,
      emitsExposure: false,
    };
  }

  it("batches same-tick stale keys into a single client.refresh([...]) call", async () => {
    vi.useFakeTimers();
    try {
      const clock = makeClock();
      const cache = new TtlFlagStateCache({ now: clock.now, ttlMs: 1000 });
      const provider = new ScriptedProvider({
        steps: [{ state: [{ key: "a", enabled: true, updatedAt: "now" }, { key: "b", enabled: true, updatedAt: "now" }] }],
      });
      const client = new FlagsClient({ definitions: [boolFlag("a"), boolFlag("b")], provider, cache, now: clock.now });
      const refreshSpy = vi.spyOn(client, "refresh");

      await client.init();
      refreshSpy.mockClear(); // discard the unrelated refresh() call init() itself makes
      wireAutoRevalidation(cache, client);

      clock.advance(1000);
      client.evaluate("a");
      client.evaluate("b"); // both go stale in the same synchronous tick

      await vi.runAllTimersAsync();

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith(expect.arrayContaining(["a", "b"]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("unwiring stops future onStale-triggered refreshes", async () => {
    vi.useFakeTimers();
    try {
      const clock = makeClock();
      const cache = new TtlFlagStateCache({ now: clock.now, ttlMs: 1000 });
      const provider = new ScriptedProvider({ steps: [{ state: [{ key: "a", enabled: true, updatedAt: "now" }] }] });
      const client = new FlagsClient({ definitions: [boolFlag("a")], provider, cache, now: clock.now });
      const refreshSpy = vi.spyOn(client, "refresh");

      await client.init();
      refreshSpy.mockClear(); // discard the unrelated refresh() call init() itself makes
      const unwire = wireAutoRevalidation(cache, client);
      unwire();

      clock.advance(1000);
      client.evaluate("a");
      await vi.runAllTimersAsync();

      expect(refreshSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
