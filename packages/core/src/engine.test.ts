import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";
import { LocalProvider } from "./providers/local";
import type { EvaluatedFlag, FlagDefinition, FlagRemoteState } from "./types";

const killSwitch: FlagDefinition<boolean> = {
  key: "kill-switch",
  kind: "killSwitch",
  valueType: "boolean",
  defaultValue: false,
  failureMode: "closed",
  sticky: false,
  emitsExposure: false,
};

const experiment: FlagDefinition<string> = {
  key: "checkout-experiment",
  kind: "experiment",
  valueType: "variant",
  defaultValue: "control",
  variants: [
    { key: "control", value: "control", weight: 50 },
    { key: "treatment", value: "treatment", weight: 50 },
  ],
  failureMode: "closed",
  sticky: true,
  emitsExposure: true,
};

const dependentFlag: FlagDefinition<boolean> = {
  key: "child-feature",
  kind: "release",
  valueType: "boolean",
  defaultValue: false,
  dependsOn: ["parent-feature"],
  failureMode: "closed",
  sticky: false,
  emitsExposure: false,
};

describe("evaluate — boolean flags", () => {
  it("defaults closed with no remote state (kill-switch fail-safe)", () => {
    const result = evaluate(killSwitch, undefined, { userId: "u1" });
    expect(result).toEqual({ key: "kill-switch", value: false, reason: "default", stale: false, variantKey: undefined });
  });

  it("turns on when remote state sets enabled: true", () => {
    const remoteState: FlagRemoteState = { key: "kill-switch", enabled: true, updatedAt: "now" };
    const result = evaluate(killSwitch, remoteState, { userId: "u1" });
    expect(result.value).toBe(true);
    expect(result.reason).toBe("override");
  });

  it("enabled: false always wins (explicit kill)", () => {
    const remoteState: FlagRemoteState = {
      key: "kill-switch",
      enabled: false,
      rolloutPercentage: 100,
      updatedAt: "now",
    };
    const result = evaluate(killSwitch, remoteState, { userId: "u1" });
    expect(result).toEqual({ key: "kill-switch", value: false, reason: "override", stale: false, variantKey: undefined });
  });

  it("rolloutPercentage: 100 is always on, 0 is always off", () => {
    const on: FlagRemoteState = { key: "kill-switch", rolloutPercentage: 100, updatedAt: "now" };
    const off: FlagRemoteState = { key: "kill-switch", rolloutPercentage: 0, updatedAt: "now" };
    expect(evaluate(killSwitch, on, { userId: "u1" }).value).toBe(true);
    expect(evaluate(killSwitch, off, { userId: "u1" }).value).toBe(false);
  });
});

describe("evaluate — variant flags", () => {
  it("assigns variants roughly matching their weights across many users", () => {
    const counts: Record<string, number> = { control: 0, treatment: 0 };
    for (let i = 0; i < 5000; i++) {
      const result = evaluate(experiment, undefined, { userId: `u${i}` });
      counts[result.value] = (counts[result.value] ?? 0) + 1;
    }
    expect(counts.control).toBeGreaterThan(2000);
    expect(counts.control).toBeLessThan(3000);
    expect(counts.treatment).toBeGreaterThan(2000);
    expect(counts.treatment).toBeLessThan(3000);
  });

  it("respects remote weight overrides", () => {
    const remoteState: FlagRemoteState = {
      key: "checkout-experiment",
      variantOverrides: [
        { key: "control", weight: 10 },
        { key: "treatment", weight: 90 },
      ],
      updatedAt: "now",
    };
    let treatmentCount = 0;
    const total = 4000;
    for (let i = 0; i < total; i++) {
      const result = evaluate(experiment, remoteState, { userId: `u${i}` });
      if (result.value === "treatment") treatmentCount++;
    }
    expect(treatmentCount / total).toBeGreaterThan(0.8);
    expect(treatmentCount / total).toBeLessThan(1.0);
  });

  it("falls back to defaultValue when no bucketing key is resolvable", () => {
    const result = evaluate(experiment, undefined, {});
    expect(result.value).toBe("control");
    expect(result.reason).toBe("default");
  });
});

describe("evaluate — dependsOn", () => {
  it("returns dependencyNotMet when the parent flag is falsy or missing", () => {
    expect(evaluate(dependentFlag, undefined, { userId: "u1" }, {}).reason).toBe("dependencyNotMet");

    const parentOff: EvaluatedFlag = { key: "parent-feature", value: false, reason: "default", stale: false };
    expect(evaluate(dependentFlag, undefined, { userId: "u1" }, { "parent-feature": parentOff }).reason).toBe(
      "dependencyNotMet",
    );
  });

  it("evaluates normally when the parent flag is truthy", () => {
    const parentOn: EvaluatedFlag = { key: "parent-feature", value: true, reason: "override", stale: false };
    const remoteState: FlagRemoteState = { key: "child-feature", enabled: true, updatedAt: "now" };
    const result = evaluate(dependentFlag, remoteState, { userId: "u1" }, { "parent-feature": parentOn });
    expect(result.value).toBe(true);
  });
});

describe("evaluate — determinism (SSR snapshot/hydrate parity)", () => {
  it("produces byte-identical output for identical inputs, repeatedly", () => {
    const context = { userId: "u42", attributes: { plan: "pro" } };
    const remoteState: FlagRemoteState = { key: "kill-switch", enabled: true, updatedAt: "now" };
    const first = evaluate(killSwitch, remoteState, context);
    const second = evaluate(killSwitch, remoteState, context);
    expect(second).toEqual(first);
  });
});

describe("evaluate — end to end via LocalProvider", () => {
  it("evaluates using state fetched from the local provider", async () => {
    const provider = new LocalProvider([{ key: "kill-switch", enabled: true, updatedAt: "now" }]);
    await provider.init();
    const [remoteState] = await provider.getRemoteState(["kill-switch"]);
    const result = evaluate(killSwitch, remoteState, { userId: "u1" });
    expect(result.value).toBe(true);
  });
});
