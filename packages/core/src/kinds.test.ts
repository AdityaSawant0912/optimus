import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";
import {
  defineCircuitBreaker,
  defineDynamicConfig,
  defineEntitlementFlag,
  defineExperiment,
  defineKillSwitch,
  defineMigrationFlag,
  defineProgressiveDeploy,
  defineReleaseFlag,
} from "./kinds";
import type { FlagDefinition } from "./types";

type TraitTuple = Pick<FlagDefinition, "kind" | "valueType" | "failureMode" | "sticky" | "emitsExposure">;

describe("kinds — trait defaults", () => {
  const cases: Array<[string, FlagDefinition<unknown>, TraitTuple]> = [
    [
      "defineReleaseFlag",
      defineReleaseFlag({ key: "k", defaultValue: false }),
      { kind: "release", valueType: "boolean", failureMode: "closed", sticky: false, emitsExposure: false },
    ],
    [
      "defineKillSwitch",
      defineKillSwitch({ key: "k", defaultValue: false }),
      { kind: "killSwitch", valueType: "boolean", failureMode: "closed", sticky: false, emitsExposure: false },
    ],
    [
      "defineExperiment",
      defineExperiment({
        key: "k",
        defaultValue: "control",
        variants: [{ key: "control", value: "control", weight: 100 }],
      }) as FlagDefinition<unknown>,
      { kind: "experiment", valueType: "variant", failureMode: "closed", sticky: true, emitsExposure: true },
    ],
    [
      "defineMigrationFlag",
      defineMigrationFlag({ key: "k", defaultValue: false }),
      { kind: "migration", valueType: "boolean", failureMode: "closed", sticky: true, emitsExposure: false },
    ],
    [
      "defineProgressiveDeploy",
      defineProgressiveDeploy({ key: "k", defaultValue: false }),
      { kind: "progressiveDeploy", valueType: "boolean", failureMode: "closed", sticky: true, emitsExposure: false },
    ],
    [
      "defineEntitlementFlag",
      defineEntitlementFlag({ key: "k", defaultValue: false }),
      { kind: "entitlement", valueType: "boolean", failureMode: "closed", sticky: false, emitsExposure: false },
    ],
    [
      "defineCircuitBreaker",
      defineCircuitBreaker({ key: "k", defaultValue: false }),
      { kind: "circuitBreaker", valueType: "boolean", failureMode: "closed", sticky: false, emitsExposure: false },
    ],
    [
      "defineDynamicConfig",
      defineDynamicConfig({ key: "k", defaultValue: 42 }) as FlagDefinition<unknown>,
      { kind: "dynamicConfig", valueType: "value", failureMode: "closed", sticky: false, emitsExposure: false },
    ],
  ];

  it.each(cases)("%s produces the documented trait tuple", (_name, definition, expected) => {
    expect({
      kind: definition.kind,
      valueType: definition.valueType,
      failureMode: definition.failureMode,
      sticky: definition.sticky,
      emitsExposure: definition.emitsExposure,
    }).toEqual(expected);
  });

  it("passes schedule/description/owners/dependsOn through unchanged", () => {
    const common = {
      schedule: { startAt: "2030-01-01T00:00:00.000Z" },
      description: "test description",
      owners: ["team-a"],
      dependsOn: ["some-parent"],
    };
    const definition = defineReleaseFlag({ key: "k", defaultValue: false, ...common });
    expect(definition.schedule).toEqual(common.schedule);
    expect(definition.description).toBe(common.description);
    expect(definition.owners).toEqual(common.owners);
    expect(definition.dependsOn).toEqual(common.dependsOn);
  });
});

describe("defineExperiment — end to end with the real engine", () => {
  it("actually picks a variant when evaluated with a bucketing key", () => {
    const experiment = defineExperiment({
      key: "checkout-experiment",
      defaultValue: "control",
      variants: [
        { key: "control", value: "control", weight: 0 },
        { key: "treatment", value: "treatment", weight: 100 },
      ],
    });

    const result = evaluate(experiment, undefined, { userId: "u1" });

    expect(result.value).toBe("treatment");
    expect(result.variantKey).toBe("treatment");
    expect(result.reason).toBe("rollout");
  });
});
