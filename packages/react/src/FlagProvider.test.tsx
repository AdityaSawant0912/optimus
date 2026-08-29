import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { serializeSnapshot } from "@optimus/node";
import { FlagProvider } from "./FlagProvider";
import { useFlag } from "./useFlag";
import { boolFlag, createTestClient } from "./test-utils/setup";

function Probe({ flagKey }: { flagKey: string }) {
  const flag = useFlag(flagKey);
  return <span data-testid="value">{String(flag.value)}</span>;
}

describe("FlagProvider — snapshot mode never re-evaluates", () => {
  it("never calls evaluate()/evaluateAll() when a snapshot is provided", async () => {
    const client = createTestClient([boolFlag({ key: "show-banner" })], [
      { key: "show-banner", enabled: true, updatedAt: "now" },
    ]);
    await client.init();
    const snapshot = serializeSnapshot(client.evaluateAll());

    const evaluateSpy = vi.spyOn(client, "evaluate");
    const evaluateAllSpy = vi.spyOn(client, "evaluateAll");

    render(
      <FlagProvider client={client} snapshot={snapshot}>
        <Probe flagKey="show-banner" />
      </FlagProvider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(evaluateAllSpy).not.toHaveBeenCalled();
  });

  it("calls evaluate() when no snapshot is provided (contrast case)", async () => {
    const client = createTestClient([boolFlag({ key: "show-banner" })], [
      { key: "show-banner", enabled: true, updatedAt: "now" },
    ]);
    await client.init();

    const evaluateSpy = vi.spyOn(client, "evaluate");

    render(
      <FlagProvider client={client}>
        <Probe flagKey="show-banner" />
      </FlagProvider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(evaluateSpy).toHaveBeenCalled();
  });
});
