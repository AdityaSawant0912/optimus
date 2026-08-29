import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlagsClient, LocalProvider } from "@useoptimus/core";
import type { FlagDefinition } from "@useoptimus/core";
import { FlagProvider } from "./FlagProvider";
import { useVariant } from "./useVariant";
import { boolFlag, createTestClient } from "./test-utils/setup";

const experiment: FlagDefinition<string> = {
  key: "experiment",
  kind: "experiment",
  valueType: "variant",
  defaultValue: "control",
  variants: [
    { key: "control", value: "control", weight: 0 },
    { key: "treatment", value: "treatment", weight: 100 },
  ],
  failureMode: "closed",
  sticky: true,
  emitsExposure: true,
};

function Probe({ flagKey }: { flagKey: string }) {
  const variant = useVariant(flagKey, { userId: "u1" });
  return <span data-testid="v">{String(variant)}</span>;
}

describe("useVariant", () => {
  it("returns the variantKey when the flag resolves a variant", async () => {
    const client = new FlagsClient({ definitions: [experiment], provider: new LocalProvider([]) });
    await client.init();

    render(
      <FlagProvider client={client}>
        <Probe flagKey="experiment" />
      </FlagProvider>,
    );

    // weight 0/100 makes the outcome deterministic regardless of the hash.
    expect(screen.getByTestId("v").textContent).toBe("treatment");
  });

  it("returns undefined (not a throw, not .value) when there is no variantKey", async () => {
    const client = createTestClient([boolFlag({ key: "f" })], [{ key: "f", enabled: true, updatedAt: "t1" }]);
    await client.init();

    render(
      <FlagProvider client={client}>
        <Probe flagKey="f" />
      </FlagProvider>,
    );

    expect(screen.getByTestId("v").textContent).toBe("undefined");
  });
});
