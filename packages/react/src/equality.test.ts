import { describe, expect, it } from "vitest";
import { evaluationContextsEqual } from "./equality";

describe("evaluationContextsEqual", () => {
  it("treats undefined and {} as equal", () => {
    expect(evaluationContextsEqual(undefined, {})).toBe(true);
    expect(evaluationContextsEqual({}, undefined)).toBe(true);
    expect(evaluationContextsEqual(undefined, undefined)).toBe(true);
  });

  it("detects a difference in each scalar field", () => {
    expect(evaluationContextsEqual({ bucketingKey: "a" }, { bucketingKey: "b" })).toBe(false);
    expect(evaluationContextsEqual({ userId: "a" }, { userId: "b" })).toBe(false);
    expect(evaluationContextsEqual({ deviceId: "a" }, { deviceId: "b" })).toBe(false);
    expect(evaluationContextsEqual({ sessionId: "a" }, { sessionId: "b" })).toBe(false);
    expect(evaluationContextsEqual({ anonymousId: "a" }, { anonymousId: "b" })).toBe(false);
    expect(evaluationContextsEqual({ environment: "a" }, { environment: "b" })).toBe(false);
  });

  it("treats identical scalar fields as equal", () => {
    expect(evaluationContextsEqual({ userId: "u1" }, { userId: "u1" })).toBe(true);
  });

  it("shallow-compares attributes regardless of key insertion order", () => {
    expect(
      evaluationContextsEqual({ attributes: { plan: "pro", role: "admin" } }, { attributes: { role: "admin", plan: "pro" } }),
    ).toBe(true);
  });

  it("detects a changed, added, or removed attribute", () => {
    expect(evaluationContextsEqual({ attributes: { plan: "pro" } }, { attributes: { plan: "free" } })).toBe(false);
    expect(evaluationContextsEqual({ attributes: { plan: "pro" } }, { attributes: { plan: "pro", role: "admin" } })).toBe(
      false,
    );
    expect(evaluationContextsEqual({ attributes: { plan: "pro" } }, { attributes: {} })).toBe(false);
  });
});
