import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlagsClient, LocalProvider } from "@optimus/core";
import { serializeSnapshot } from "@optimus/node";
import { FlagProvider } from "./FlagProvider";
import { useFlag } from "./useFlag";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("useFlag — snapshot mode", () => {
  it("returns the same object reference across unrelated re-renders", async () => {
    const client = createTestClient([boolFlag({ key: "f" })], [{ key: "f", enabled: true, updatedAt: "t1" }]);
    await client.init();
    const snapshot = serializeSnapshot(client.evaluateAll());

    const seen: unknown[] = [];
    function Probe({ tick }: { tick: number }) {
      seen.push(useFlag("f"));
      return <span>{tick}</span>;
    }

    const { rerender } = render(
      <FlagProvider client={client} snapshot={snapshot}>
        <Probe tick={0} />
      </FlagProvider>,
    );
    rerender(
      <FlagProvider client={client} snapshot={snapshot}>
        <Probe tick={1} />
      </FlagProvider>,
    );

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it("throws when a requested key is missing from the hydrated snapshot", async () => {
    const client = createTestClient([boolFlag({ key: "f" })]);
    await client.init();
    const snapshot = serializeSnapshot(client.evaluateAll());

    function Probe() {
      useFlag("missing-key");
      return null;
    }

    expect(() =>
      render(
        <FlagProvider client={client} snapshot={snapshot}>
          <Probe />
        </FlagProvider>,
      ),
    ).toThrow(/is not present in the hydrated snapshot/);
  });
});

describe("useFlag — live mode", () => {
  it("re-renders when a live update actually changes the flag's value", async () => {
    const remoteState = [{ key: "f", enabled: false, updatedAt: "t1" }];
    const client = new FlagsClient({ definitions: [boolFlag({ key: "f" })], provider: new LocalProvider(remoteState) });
    await client.init();

    let renderCount = 0;
    function Probe() {
      renderCount++;
      const flag = useFlag("f");
      return <span data-testid="value">{String(flag.value)}</span>;
    }

    render(
      <FlagProvider client={client}>
        <Probe />
      </FlagProvider>,
    );
    expect(screen.getByTestId("value").textContent).toBe("false");
    const countAfterMount = renderCount;

    remoteState[0] = { key: "f", enabled: true, updatedAt: "t2" };
    await act(async () => {
      await client.refresh();
    });

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(renderCount).toBeGreaterThan(countAfterMount);
  });

  it("does not re-render when the changed key differs from the subscribed key", async () => {
    const remoteState = [
      { key: "watched", enabled: false, updatedAt: "t1" },
      { key: "other", enabled: false, updatedAt: "t1" },
    ];
    const client = new FlagsClient({
      definitions: [boolFlag({ key: "watched" }), boolFlag({ key: "other" })],
      provider: new LocalProvider(remoteState),
    });
    await client.init();

    let renderCount = 0;
    function Probe() {
      renderCount++;
      useFlag("watched");
      return null;
    }
    render(
      <FlagProvider client={client}>
        <Probe />
      </FlagProvider>,
    );
    const countAfterMount = renderCount;

    remoteState[1] = { key: "other", enabled: true, updatedAt: "t2" };
    await act(async () => {
      await client.refresh(["other"]);
    });

    expect(renderCount).toBe(countAfterMount);
  });

  it("does not re-render when evaluate() returns a field-equal-but-new object (memoization regression)", async () => {
    const client = createTestClient([boolFlag({ key: "f" })], [{ key: "f", enabled: true, updatedAt: "t1" }]);
    await client.init();

    let renderCount = 0;
    function Probe() {
      renderCount++;
      useFlag("f");
      return null;
    }
    render(
      <FlagProvider client={client}>
        <Probe />
      </FlagProvider>,
    );
    const countAfterMount = renderCount;

    // client notifies subscribers on every refresh attempt, not on content
    // diff — the data here is unchanged, so evaluate() returns a new object
    // with equal fields, which useFlag's cache must not treat as a change.
    await act(async () => {
      await client.refresh();
    });

    expect(renderCount).toBe(countAfterMount);
  });
});

describe("useFlag — outside a FlagProvider", () => {
  it("throws", () => {
    function Bad() {
      useFlag("f");
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/useFlag\/useVariant must be used within/);
  });
});
