import { describe, expect, it, vi } from "vitest";
import { FlagsClient } from "./client";
import { PushCapableScriptedProvider, ScriptedProvider } from "./test-utils/scripted-provider";
import type { FlagDefinition, FlagRemoteState } from "./types";

function boolFlag(overrides: Partial<FlagDefinition<boolean>> & { key: string }): FlagDefinition<boolean> {
  return {
    kind: "release",
    valueType: "boolean",
    defaultValue: false,
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...overrides,
  };
}

function state(key: string, enabled: boolean): FlagRemoteState {
  return { key, enabled, updatedAt: "now" };
}

describe("FlagsClient — dependsOn resolution", () => {
  it("resolves regardless of registration order (child registered before parent)", async () => {
    const child = boolFlag({ key: "child", dependsOn: ["parent"] });
    const parent = boolFlag({ key: "parent" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("parent", true), state("child", true)] }] });
    const client = new FlagsClient({ definitions: [child, parent], provider });
    await client.init();

    expect(client.evaluate("child").value).toBe(true);
  });

  it("terminates on a two-flag cycle without hanging or throwing", async () => {
    const a = boolFlag({ key: "a", dependsOn: ["b"] });
    const b = boolFlag({ key: "b", dependsOn: ["a"] });
    const provider = new ScriptedProvider({ steps: [{ state: [state("a", true), state("b", true)] }] });
    const client = new FlagsClient({ definitions: [a, b], provider });
    await client.init();

    expect(client.evaluate("a").reason).toBe("dependencyNotMet");
    expect(client.evaluate("b").reason).toBe("dependencyNotMet");
  });

  it("terminates on self-dependency without hanging or throwing", async () => {
    const self = boolFlag({ key: "self", dependsOn: ["self"] });
    const provider = new ScriptedProvider({ steps: [{ state: [state("self", true)] }] });
    const client = new FlagsClient({ definitions: [self], provider });
    await client.init();

    expect(client.evaluate("self").reason).toBe("dependencyNotMet");
  });

  it("does not crash on a dependsOn reference to an unregistered key", async () => {
    const orphan = boolFlag({ key: "orphan", dependsOn: ["ghost"] });
    const provider = new ScriptedProvider({ steps: [{ state: [] }] });
    const client = new FlagsClient({ definitions: [orphan], provider });
    await client.init();

    expect(client.evaluate("orphan").reason).toBe("dependencyNotMet");
  });
});

describe("FlagsClient — onEvaluate", () => {
  it("fires exactly once per emitsExposure:true requested flag, not for emitsExposure:false", async () => {
    const exposed = boolFlag({ key: "exposed", emitsExposure: true });
    const silent = boolFlag({ key: "silent", emitsExposure: false });
    const provider = new ScriptedProvider({ steps: [{ state: [state("exposed", true), state("silent", true)] }] });
    const handler = vi.fn();
    const client = new FlagsClient({ definitions: [exposed, silent], provider, onEvaluate: handler });
    await client.init();

    client.evaluate("exposed");
    client.evaluate("silent");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].key).toBe("exposed");
  });

  it("does not fire for an ancestor pulled in only to satisfy dependsOn", async () => {
    const parent = boolFlag({ key: "parent", emitsExposure: true });
    const child = boolFlag({ key: "child", dependsOn: ["parent"], emitsExposure: true });
    const provider = new ScriptedProvider({ steps: [{ state: [state("parent", true), state("child", true)] }] });
    const handler = vi.fn();
    const client = new FlagsClient({ definitions: [parent, child], provider, onEvaluate: handler });
    await client.init();

    client.evaluate("child");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].key).toBe("child");
  });

  it("receives the post-overlay result (stale:true for a lastKnown flag mid-outage)", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "lastKnown", emitsExposure: true });
    const provider = new ScriptedProvider({
      steps: [{ state: [state("flag", true)] }, { throws: new Error("provider down") }],
    });
    const handler = vi.fn();
    const client = new FlagsClient({ definitions: [flag], provider, onEvaluate: handler });
    await client.init();
    await client.refresh();

    client.evaluate("flag");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toMatchObject({ value: true, stale: true });
  });
});

describe("FlagsClient — failureMode matrix", () => {
  it("row 1: fresh success, any failureMode — value from remote state, stale:false", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "closed" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("flag", true)] }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();

    expect(client.evaluate("flag")).toMatchObject({ value: true, reason: "override", stale: false });
  });

  it("row 2a: closed reverts to default on failure after having cached state", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "closed" });
    const provider = new ScriptedProvider({
      steps: [{ state: [state("flag", true)] }, { throws: new Error("down") }],
    });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();
    await client.refresh();

    expect(client.evaluate("flag")).toMatchObject({ value: false, reason: "default", stale: false });
  });

  it("row 2a: open (boolean) also reverts to default on failure after having cached state", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "open" });
    const provider = new ScriptedProvider({
      steps: [{ state: [state("flag", true)] }, { throws: new Error("down") }],
    });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();
    await client.refresh();

    expect(client.evaluate("flag")).toMatchObject({ value: false, reason: "default", stale: false });
  });

  it("row 2b: lastKnown keeps serving old value on failure, stale:true", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "lastKnown" });
    const provider = new ScriptedProvider({
      steps: [{ state: [state("flag", true)] }, { throws: new Error("down") }],
    });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();
    await client.refresh();

    expect(client.evaluate("flag")).toMatchObject({ value: true, stale: true });
  });

  it("row 3a: open + boolean + no cache ever + failed attempt synthesizes true/fallbackError", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "open" });
    const provider = new ScriptedProvider({ steps: [{ throws: new Error("down from the start") }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    // provider.init() itself succeeds; it's the first refresh() (called from
    // within init()) that fails — refresh() never throws, so init() resolves.
    await client.init();

    expect(client.evaluate("flag")).toEqual({ key: "flag", value: true, reason: "fallbackError", stale: true });
  });

  it("row 3b: closed + no cache ever + failed attempt remaps default to fallbackError", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "closed" });
    const provider = new ScriptedProvider({ steps: [{ throws: new Error("down from the start") }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();

    expect(client.evaluate("flag")).toMatchObject({ value: false, reason: "fallbackError", stale: true });
  });

  it("row 3b: open + non-boolean + no cache + failed attempt behaves like closed (no principled fail-open payload)", async () => {
    const flag: FlagDefinition<string> = {
      key: "flag",
      kind: "dynamicConfig",
      valueType: "value",
      defaultValue: "fallback",
      failureMode: "open",
      sticky: false,
      emitsExposure: false,
    };
    const provider = new ScriptedProvider({ steps: [{ throws: new Error("down from the start") }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();

    expect(client.evaluate<string>("flag")).toMatchObject({ value: "fallback", reason: "fallbackError", stale: true });
  });

  it("row 3b: a dependencyNotMet reason is left as-is, not remapped to fallbackError", async () => {
    const parent = boolFlag({ key: "parent" });
    const child = boolFlag({ key: "child", dependsOn: ["parent"], failureMode: "closed" });
    const provider = new ScriptedProvider({ steps: [{ throws: new Error("down from the start") }] });
    const client = new FlagsClient({ definitions: [parent, child], provider });
    await client.init();

    expect(client.evaluate("child")).toMatchObject({ reason: "dependencyNotMet", stale: true });
  });

  it("row 4: never attempted (no init/refresh) is not an error — plain default, stale:false", () => {
    const flag = boolFlag({ key: "flag", failureMode: "closed" });
    const provider = new ScriptedProvider({ steps: [{ state: [] }] });
    const client = new FlagsClient({ definitions: [flag], provider });

    expect(client.evaluate("flag")).toMatchObject({ value: false, reason: "default", stale: false });
  });
});

describe("FlagsClient — refresh isolation", () => {
  it("a failed refresh for one key does not affect an unrelated key's cache entry", async () => {
    const a = boolFlag({ key: "a" });
    const b = boolFlag({ key: "b" });
    const provider = new ScriptedProvider({
      steps: [{ state: [state("a", true), state("b", true)] }, { throws: new Error("down") }],
    });
    const client = new FlagsClient({ definitions: [a, b], provider });
    await client.init();
    await client.refresh(["a"]);

    expect(client.evaluate("a")).toMatchObject({ value: false, reason: "default" }); // reverted (closed)
    expect(client.evaluate("b")).toMatchObject({ value: true, reason: "override" }); // untouched
  });
});

describe("FlagsClient — provider.init() failure", () => {
  it("client.init() rejects, but an open boolean flag resolves immediately without any refresh having run", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "open" });
    const provider = new ScriptedProvider({ initBehavior: { throws: new Error("boom") }, steps: [] });
    const client = new FlagsClient({ definitions: [flag], provider });

    await expect(client.init()).rejects.toThrow("boom");
    expect(client.evaluate("flag")).toEqual({ key: "flag", value: true, reason: "fallbackError", stale: true });
  });
});

describe("FlagsClient — subscribe / dispose", () => {
  it("subscribe fires on successful refresh, failed refresh, and provider push", async () => {
    const flag = boolFlag({ key: "flag" });
    const provider = new PushCapableScriptedProvider({
      steps: [{ state: [state("flag", true)] }, { throws: new Error("down") }],
    });
    const client = new FlagsClient({ definitions: [flag], provider });
    const listener = vi.fn();
    client.subscribe(listener);

    await client.init();
    expect(listener).toHaveBeenCalledWith(["flag"]);

    await client.refresh();
    expect(listener).toHaveBeenCalledTimes(2);

    provider.simulatePush([state("flag", false)]);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith(["flag"]);
  });

  it("drops malformed push entries but still applies valid ones in the same push", async () => {
    const a = boolFlag({ key: "a" });
    const b = boolFlag({ key: "b" });
    const provider = new PushCapableScriptedProvider({ steps: [{ state: [] }] });
    const client = new FlagsClient({ definitions: [a, b], provider });
    await client.init();

    expect(() => provider.simulatePush([{ enabled: true, updatedAt: "now" }, state("b", true)])).not.toThrow();

    expect(client.evaluate("b")).toMatchObject({ value: true });
  });

  it("dispose unsubscribes from the provider exactly once and silences further notifications", async () => {
    const flag = boolFlag({ key: "flag" });
    const provider = new PushCapableScriptedProvider({ steps: [{ state: [state("flag", true)] }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    const listener = vi.fn();
    const evalHandler = vi.fn();
    client.subscribe(listener);
    client.onEvaluate(evalHandler);
    await client.init();

    client.dispose();
    provider.simulatePush([state("flag", false)]);

    expect(listener).toHaveBeenCalledTimes(1); // only the init() refresh, not the post-dispose push
    // evaluate still works post-dispose, reading last-known cache
    expect(client.evaluate("flag")).toMatchObject({ value: true });
  });
});

describe("FlagsClient — overrides", () => {
  it("forces a boolean flag's value even when remote state says otherwise", async () => {
    const flag = boolFlag({ key: "flag" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("flag", false)] }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();

    client.setOverrides({ flag: { value: true } });

    expect(client.evaluate("flag")).toEqual({ key: "flag", value: true, variantKey: undefined, reason: "override", stale: false });
  });

  it("forces an arbitrary variantKey/value not present in the real variant list", async () => {
    const experiment: FlagDefinition<string> = {
      key: "experiment",
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
    const provider = new ScriptedProvider({ steps: [{ state: [] }] });
    const client = new FlagsClient({ definitions: [experiment], provider });
    await client.init();

    client.setOverrides({ experiment: { value: "not-a-real-variant", variantKey: "forced" } });

    expect(client.evaluate("experiment")).toMatchObject({ value: "not-a-real-variant", variantKey: "forced", reason: "override" });
  });

  it("bypasses failureMode entirely, even when the provider is totally broken", async () => {
    const flag = boolFlag({ key: "flag", failureMode: "closed" });
    const provider = new ScriptedProvider({ steps: [{ throws: new Error("down from the start") }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init(); // failed refresh() inside init(), no cache ever

    client.setOverrides({ flag: { value: true } });

    expect(client.evaluate("flag")).toMatchObject({ value: true, reason: "override" });
  });

  it("bypasses dependsOn entirely", async () => {
    const parent = boolFlag({ key: "parent" });
    const child = boolFlag({ key: "child", dependsOn: ["parent"] });
    const provider = new ScriptedProvider({ steps: [{ state: [state("parent", false)] }] });
    const client = new FlagsClient({ definitions: [parent, child], provider });
    await client.init();

    expect(client.evaluate("child").reason).toBe("dependencyNotMet");

    client.setOverrides({ child: { value: true } });
    expect(client.evaluate("child")).toMatchObject({ value: true, reason: "override" });
  });

  it("clearOverrides(keys) restores real evaluation for only the cleared key", async () => {
    const a = boolFlag({ key: "a" });
    const b = boolFlag({ key: "b" });
    // No remote state for either key — un-overridden evaluation should fall
    // through cleanly to defaultValue/"default", not an engine-level
    // enabled:false "override" (a separate, pre-existing reason source).
    const provider = new ScriptedProvider({ steps: [{ state: [] }] });
    const client = new FlagsClient({ definitions: [a, b], provider });
    await client.init();

    client.setOverrides({ a: { value: true }, b: { value: true } });
    client.clearOverrides(["a"]);

    expect(client.evaluate("a")).toMatchObject({ value: false, reason: "default" });
    expect(client.evaluate("b")).toMatchObject({ value: true, reason: "override" });
  });

  it("clearOverrides() with no args clears everything", async () => {
    const a = boolFlag({ key: "a" });
    const provider = new ScriptedProvider({ steps: [{ state: [] }] });
    const client = new FlagsClient({ definitions: [a], provider });
    await client.init();

    client.setOverrides({ a: { value: true } });
    client.clearOverrides();

    expect(client.evaluate("a")).toMatchObject({ value: false, reason: "default" });
  });

  it("does not fire onEvaluate for an overridden read, even when emitsExposure is true", async () => {
    const flag = boolFlag({ key: "flag", emitsExposure: true });
    const provider = new ScriptedProvider({ steps: [{ state: [state("flag", false)] }] });
    const handler = vi.fn();
    const client = new FlagsClient({ definitions: [flag], provider, onEvaluate: handler });
    await client.init();
    handler.mockClear(); // discard the init()-triggered evaluate, if any

    client.setOverrides({ flag: { value: true } });
    client.evaluate("flag");

    expect(handler).not.toHaveBeenCalled();
  });

  it("notifies subscribe() listeners with the affected keys", async () => {
    const flag = boolFlag({ key: "flag" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("flag", false)] }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();

    const listener = vi.fn();
    client.subscribe(listener);
    client.setOverrides({ flag: { value: true } });

    expect(listener).toHaveBeenCalledWith(["flag"]);
  });

  it("an override for an unregistered key is silently inert", async () => {
    const flag = boolFlag({ key: "flag" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("flag", false)] }] });
    const client = new FlagsClient({ definitions: [flag], provider });
    await client.init();

    expect(() => client.setOverrides({ "does-not-exist": { value: true } })).not.toThrow();
    expect(client.evaluate("flag")).toMatchObject({ value: false });
  });

  it("merges into existing overrides rather than replacing them", async () => {
    const a = boolFlag({ key: "a" });
    const b = boolFlag({ key: "b" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("a", false), state("b", false)] }] });
    const client = new FlagsClient({ definitions: [a, b], provider });
    await client.init();

    client.setOverrides({ a: { value: true } });
    client.setOverrides({ b: { value: true } });

    expect(client.evaluate("a")).toMatchObject({ value: true, reason: "override" });
    expect(client.evaluate("b")).toMatchObject({ value: true, reason: "override" });
  });
});

describe("FlagsClient — evaluateAll", () => {
  it("returns a Record<key, EvaluatedFlag> covering the whole registry", async () => {
    const a = boolFlag({ key: "a" });
    const b = boolFlag({ key: "b" });
    const provider = new ScriptedProvider({ steps: [{ state: [state("a", true), state("b", false)] }] });
    const client = new FlagsClient({ definitions: [a, b], provider });
    await client.init();

    expect(client.evaluateAll()).toMatchObject({
      a: { value: true },
      b: { value: false },
    });
  });
});
