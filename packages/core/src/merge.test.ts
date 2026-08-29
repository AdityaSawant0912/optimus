import { describe, expect, it } from "vitest";
import { mergeDefinitionWithRemoteState } from "./merge";
import type { FlagDefinition, FlagRemoteState } from "./types";

const definition: FlagDefinition<boolean> = {
  key: "new-checkout",
  kind: "release",
  valueType: "boolean",
  defaultValue: false,
  failureMode: "closed",
  sticky: false,
  emitsExposure: false,
};

describe("mergeDefinitionWithRemoteState", () => {
  it("falls back entirely to code defaults when there is no remote state", () => {
    const resolved = mergeDefinitionWithRemoteState(definition, undefined);
    expect(resolved.defaultValue).toBe(false);
    expect(resolved.enabled).toBeUndefined();
    expect(resolved.rolloutPercentage).toBeUndefined();
    expect(resolved.targetingRules).toEqual([]);
  });

  it("overrides enabled independently of other fields", () => {
    const remoteState: FlagRemoteState = { key: "new-checkout", enabled: true, updatedAt: "now" };
    const resolved = mergeDefinitionWithRemoteState(definition, remoteState);
    expect(resolved.enabled).toBe(true);
    expect(resolved.rolloutPercentage).toBeUndefined();
  });

  it("falls back to code default for a field the remote state omits", () => {
    const remoteState: FlagRemoteState = { key: "new-checkout", rolloutPercentage: 50, updatedAt: "now" };
    const resolved = mergeDefinitionWithRemoteState(definition, remoteState);
    expect(resolved.rolloutPercentage).toBe(50);
    expect(resolved.enabled).toBeUndefined(); // not provided by remote -> untouched
  });

  it("merges variant weight overrides by key, leaving unmatched variants untouched", () => {
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
    const remoteState: FlagRemoteState = {
      key: "checkout-experiment",
      variantOverrides: [{ key: "treatment", weight: 80 }],
      updatedAt: "now",
    };
    const resolved = mergeDefinitionWithRemoteState(experiment, remoteState);
    expect(resolved.variants).toEqual([
      { key: "control", value: "control", weight: 50 },
      { key: "treatment", value: "treatment", weight: 80 },
    ]);
  });
});
