import { describe, expect, it, vi } from "vitest";
import { deepEqual, runShadow, runShadowAsync } from "./shadow";

describe("deepEqual", () => {
  it("compares primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(true, false)).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, null)).toBe(false);
  });

  it("handles NaN and signed zero via Object.is semantics", () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(0, -0)).toBe(false);
  });

  it("compares nested objects structurally, independent of key order", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
  });

  it("detects a differing key set", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("compares arrays element-wise", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("does not consider an array equal to a non-array of the same 'length'", () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2, length: 2 })).toBe(false);
  });
});

describe("runShadow", () => {
  it("always returns oldImpl's result, even when newImpl differs", () => {
    const result = runShadow(
      () => "old",
      () => "new",
      () => {},
    );
    expect(result).toBe("old");
  });

  it("reports matched:true for deeply-equal-but-different object instances", () => {
    const onResult = vi.fn();
    runShadow(
      () => ({ a: 1 }),
      () => ({ a: 1 }),
      onResult,
    );
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ matched: true }));
  });

  it("reports matched:false and the error when newImpl throws, without propagating", () => {
    const onResult = vi.fn();
    const boom = new Error("boom");
    let result: string | undefined;
    expect(() => {
      result = runShadow(
        () => "old",
        () => {
          throw boom;
        },
        onResult,
      );
    }).not.toThrow();

    expect(result).toBe("old");
    expect(onResult).toHaveBeenCalledWith({ old: "old", new: undefined, matched: false, error: boom });
  });

  it("lets oldImpl's exception propagate uncaught", () => {
    const boom = new Error("old path broke");
    expect(() =>
      runShadow(
        () => {
          throw boom;
        },
        () => "new",
        () => {},
      ),
    ).toThrow(boom);
  });

  it("swallows an exception thrown by onResult itself", () => {
    expect(() =>
      runShadow(
        () => "old",
        () => "new",
        () => {
          throw new Error("bad logger");
        },
      ),
    ).not.toThrow();
  });
});

describe("runShadowAsync", () => {
  it("always returns oldImpl's resolved result, even when newImpl differs", async () => {
    const result = await runShadowAsync(
      async () => "old",
      async () => "new",
      () => {},
    );
    expect(result).toBe("old");
  });

  it("reports matched:false and the rejection reason when newImpl rejects, without propagating", async () => {
    const onResult = vi.fn();
    const boom = new Error("async boom");
    const result = await runShadowAsync(
      async () => "old",
      async () => {
        throw boom;
      },
      onResult,
    );

    expect(result).toBe("old");
    expect(onResult).toHaveBeenCalledWith({ old: "old", new: undefined, matched: false, error: boom });
  });

  it("lets oldImpl's rejection propagate uncaught", async () => {
    const boom = new Error("old async path broke");
    await expect(
      runShadowAsync(
        async () => {
          throw boom;
        },
        async () => "new",
        () => {},
      ),
    ).rejects.toThrow(boom);
  });
});
