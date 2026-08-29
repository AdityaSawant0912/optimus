import { describe, expect, it } from "vitest";
import { fnv1a } from "./hash";

describe("fnv1a", () => {
  it("is deterministic for the same input", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
    expect(fnv1a("user-123:flag-a")).toBe(fnv1a("user-123:flag-a"));
  });

  it("produces different hashes for different inputs", () => {
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });

  it("matches known FNV-1a 32-bit test vectors", () => {
    // Reference vectors: http://www.isthe.com/chongo/src/fnv/test_fnv.c
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });

  it("always returns an unsigned 32-bit integer", () => {
    for (const input of ["", "x", "a very long string ".repeat(50)]) {
      const h = fnv1a(input);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
