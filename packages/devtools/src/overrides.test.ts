import { FlagsClient, LocalProvider } from "@useoptimus/core";
import { describe, expect, it, vi } from "vitest";
import { applyOverridesToClient, resolveOverridesFromEnvironment } from "./overrides";
import type { OverrideSources } from "./overrides";

function locationWith(search: string): OverrideSources["location"] {
  return { search };
}

function storageWith(value: string | null): OverrideSources["storage"] {
  return { getItem: () => value };
}

const sampleOverrides = { flag: { value: true } };
const encoded = encodeURIComponent(JSON.stringify(sampleOverrides));

describe("resolveOverridesFromEnvironment", () => {
  it("reads from the query param", () => {
    const result = resolveOverridesFromEnvironment({ location: locationWith(`?__ff_overrides=${encoded}`) });
    expect(result).toEqual(sampleOverrides);
  });

  it("falls back to localStorage when no query param is present", () => {
    const result = resolveOverridesFromEnvironment({
      location: locationWith(""),
      storage: storageWith(JSON.stringify(sampleOverrides)),
    });
    expect(result).toEqual(sampleOverrides);
  });

  it("falls back to the injected global when neither query param nor localStorage is present", () => {
    const result = resolveOverridesFromEnvironment({
      location: locationWith(""),
      storage: storageWith(null),
      globalOverrides: sampleOverrides,
    });
    expect(result).toEqual(sampleOverrides);
  });

  it("prefers the query param over localStorage", () => {
    const other = { flag: { value: false } };
    const result = resolveOverridesFromEnvironment({
      location: locationWith(`?__ff_overrides=${encoded}`),
      storage: storageWith(JSON.stringify(other)),
    });
    expect(result).toEqual(sampleOverrides);
  });

  it("prefers localStorage over the injected global", () => {
    const other = { flag: { value: false } };
    const result = resolveOverridesFromEnvironment({
      location: locationWith(""),
      storage: storageWith(JSON.stringify(sampleOverrides)),
      globalOverrides: other,
    });
    expect(result).toEqual(sampleOverrides);
  });

  it("returns {} with no throw when every source is absent", () => {
    expect(() => resolveOverridesFromEnvironment({})).not.toThrow();
    expect(resolveOverridesFromEnvironment({})).toEqual({});
  });

  it("treats malformed JSON at any source as absent, falling through", () => {
    const result = resolveOverridesFromEnvironment({
      location: locationWith("?__ff_overrides=not-json{{{"),
      storage: storageWith("also not json"),
      globalOverrides: sampleOverrides,
    });
    expect(result).toEqual(sampleOverrides);
  });

  it("reads from real window.location/localStorage when no sources are supplied", () => {
    // jsdom provides a real window — this exercises defaultSources()'s
    // happy path (the `typeof window === "undefined"` SSR branch is not
    // reachable here without deleting the jsdom global, which is riskier
    // than the coverage it would buy).
    expect(() => resolveOverridesFromEnvironment()).not.toThrow();
    expect(resolveOverridesFromEnvironment()).toEqual({});
  });
});

describe("applyOverridesToClient", () => {
  it("calls client.setOverrides with the given overrides", async () => {
    const client = new FlagsClient({ definitions: [], provider: new LocalProvider([]) });
    await client.init();
    const spy = vi.spyOn(client, "setOverrides");

    applyOverridesToClient(client, sampleOverrides);

    expect(spy).toHaveBeenCalledWith(sampleOverrides);
  });
});
