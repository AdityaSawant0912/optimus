import { describe, expect, it } from "vitest";
import { avalanche, computeBucket, isInRollout, resolveBucketingKey } from "./bucketing";
import type { EvaluationContext } from "./types";

const N = 20000;

function popcount(x: number): number {
  let count = 0;
  let n = x;
  while (n) {
    count += n & 1;
    n >>>= 1;
  }
  return count;
}

describe("avalanche (MurmurHash3 fmix32 finalizer)", () => {
  it("matches pinned regression values — catches accidental changes to the constants", () => {
    expect(avalanche(0)).toBe(0);
    expect(avalanche(1)).toBe(1364076727);
    expect(avalanche(0x811c9dc5)).toBe(2872998923);
  });

  it("exhibits strong avalanche: flipping one input bit flips ~half the output bits", () => {
    let totalDiffBits = 0;
    const trials = 2000;
    for (let t = 0; t < trials; t++) {
      const x = Math.floor(Math.random() * 0xffffffff) >>> 0;
      const bit = Math.floor(Math.random() * 32);
      const y = (x ^ (1 << bit)) >>> 0;
      totalDiffBits += popcount((avalanche(x) ^ avalanche(y)) >>> 0);
    }
    const avgDiffBits = totalDiffBits / trials;
    // ideal is 16 of 32 bits; generous band since this is a randomized test
    expect(avgDiffBits).toBeGreaterThan(13);
    expect(avgDiffBits).toBeLessThan(19);
  });
});

function syntheticKeys(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `user-${i}`);
}

describe("resolveBucketingKey", () => {
  it("prefers explicit bucketingKey over the resolver chain", () => {
    const ctx: EvaluationContext = {
      bucketingKey: "explicit",
      userId: "u1",
      deviceId: "d1",
    };
    expect(resolveBucketingKey(ctx)).toBe("explicit");
  });

  it("follows userId -> deviceId -> sessionId -> anonymousId precedence", () => {
    expect(resolveBucketingKey({ userId: "u1", deviceId: "d1" })).toBe("u1");
    expect(resolveBucketingKey({ deviceId: "d1", sessionId: "s1" })).toBe("d1");
    expect(resolveBucketingKey({ sessionId: "s1", anonymousId: "a1" })).toBe("s1");
    expect(resolveBucketingKey({ anonymousId: "a1" })).toBe("a1");
  });

  it("returns undefined when nothing is present", () => {
    expect(resolveBucketingKey({})).toBeUndefined();
  });
});

describe("computeBucket distribution", () => {
  it("is roughly uniform across [0, 10000) over many keys", () => {
    const keys = syntheticKeys(N);
    const bucketCounts = new Array(10).fill(0); // 10 deciles
    for (const key of keys) {
      const bucket = computeBucket(key, "flag-a");
      bucketCounts[Math.floor(bucket / 1000)]++;
    }
    const expectedPerDecile = N / 10;
    for (const count of bucketCounts) {
      // within 15% of expected — generous tolerance for a hash-based test
      expect(count).toBeGreaterThan(expectedPerDecile * 0.85);
      expect(count).toBeLessThan(expectedPerDecile * 1.15);
    }
  });

  it("is deterministic: same key+flag always yields the same bucket", () => {
    expect(computeBucket("user-1", "flag-a")).toBe(computeBucket("user-1", "flag-a"));
  });

  it("gives different keys different buckets in general (not constant)", () => {
    const buckets = new Set(syntheticKeys(100).map((k) => computeBucket(k, "flag-a")));
    expect(buckets.size).toBeGreaterThan(50);
  });
});

describe("salting independence", () => {
  it("does not correlate rollout membership across two unrelated flags", () => {
    const keys = syntheticKeys(N);
    const pA = 20;
    const pB = 30;
    let bothIn = 0;
    for (const key of keys) {
      const inA = isInRollout(computeBucket(key, "flag-a"), pA);
      const inB = isInRollout(computeBucket(key, "flag-b"), pB);
      if (inA && inB) bothIn++;
    }
    const observed = bothIn / N;
    const expectedIfIndependent = (pA / 100) * (pB / 100); // 0.06
    expect(observed).toBeGreaterThan(expectedIfIndependent * 0.7);
    expect(observed).toBeLessThan(expectedIfIndependent * 1.3);
  });

  it("changes bucket assignment for the same key+flag when bucketingSeed differs", () => {
    const keys = syntheticKeys(200);
    let differentCount = 0;
    for (const key of keys) {
      const unseeded = computeBucket(key, "flag-a");
      const seeded = computeBucket(key, "flag-a", "relaunch-1");
      if (unseeded !== seeded) differentCount++;
    }
    // overwhelming majority of assignments should shift with a new seed
    expect(differentCount).toBeGreaterThan(keys.length * 0.9);
  });
});

describe("isInRollout", () => {
  it("handles boundary percentages", () => {
    expect(isInRollout(0, 0)).toBe(false);
    expect(isInRollout(9999, 100)).toBe(true);
    expect(isInRollout(0, 100)).toBe(true);
  });
});
