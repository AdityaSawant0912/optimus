import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlagsClient, LocalProvider } from "@feature-flags/core";
import type { FlagDefinition } from "@feature-flags/core";
import { serializeSnapshot } from "@feature-flags/node";
import { FlagProvider } from "./FlagProvider";
import { useFlag } from "./useFlag";

const targeted: FlagDefinition<boolean> = {
  key: "targeted",
  kind: "release",
  valueType: "boolean",
  defaultValue: false,
  failureMode: "closed",
  sticky: false,
  emitsExposure: false,
};

function Probe() {
  const flag = useFlag<boolean>("targeted");
  return <span data-testid="v">{String(flag.value)}</span>;
}

describe("FlagProvider — context prop transitions snapshot -> live", () => {
  it("stays snapshot-mode across an equal-but-new context object, then flips to live on a real change", async () => {
    const remoteState = [
      { key: "targeted", targetingRules: [{ type: "attributeEquals" as const, attribute: "plan", value: "pro" }], updatedAt: "t1" },
    ];
    const client = new FlagsClient({ definitions: [targeted], provider: new LocalProvider(remoteState) });
    await client.init();
    // Snapshot built for plan:"free" — doesn't match the targeting rule, so false.
    const snapshot = serializeSnapshot(client.evaluateAll({ attributes: { plan: "free" } }));

    const evaluateSpy = vi.spyOn(client, "evaluate");
    const setContextSpy = vi.spyOn(client, "setContext");

    const { rerender } = render(
      <FlagProvider client={client} snapshot={snapshot} context={{ attributes: { plan: "free" } }}>
        <Probe />
      </FlagProvider>,
    );
    expect(screen.getByTestId("v").textContent).toBe("false");
    expect(evaluateSpy).not.toHaveBeenCalled();

    // New object, same fields — must NOT be treated as a context change.
    rerender(
      <FlagProvider client={client} snapshot={snapshot} context={{ attributes: { plan: "free" } }}>
        <Probe />
      </FlagProvider>,
    );
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(setContextSpy).not.toHaveBeenCalled();

    // Field-different context — flips to live.
    rerender(
      <FlagProvider client={client} snapshot={snapshot} context={{ attributes: { plan: "pro" } }}>
        <Probe />
      </FlagProvider>,
    );

    expect(setContextSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalled();
    expect(screen.getByTestId("v").textContent).toBe("true");
  });
});
