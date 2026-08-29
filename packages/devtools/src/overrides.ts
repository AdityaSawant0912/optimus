import type { FlagOverride, FlagsClient } from "@optimus/core";

const QUERY_PARAM = "__ff_overrides";
const STORAGE_KEY = "feature-flags:devtools:overrides";
const GLOBAL_KEY = "__FEATURE_FLAGS_OVERRIDES__";

export interface OverrideSources {
  location?: Pick<Location, "search">;
  storage?: Pick<Storage, "getItem">;
  /** A build-tool-injected browser global (e.g. via a bundler `define` or a
   *  manual <script> tag) — NOT `process.env`, which isn't ambiently
   *  available in a browser bundle. */
  globalOverrides?: unknown;
}

function defaultSources(): OverrideSources {
  if (typeof window === "undefined") return {};
  return {
    location: window.location,
    storage: typeof localStorage !== "undefined" ? localStorage : undefined,
    globalOverrides: (window as unknown as Record<string, unknown>)[GLOBAL_KEY],
  };
}

function isOverrideMap(value: unknown): value is Record<string, FlagOverride> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseJson(raw: string | null | undefined): Record<string, FlagOverride> | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isOverrideMap(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function fromQueryParam(location: Pick<Location, "search"> | undefined): Record<string, FlagOverride> | undefined {
  if (!location) return undefined;
  const params = new URLSearchParams(location.search);
  return tryParseJson(params.get(QUERY_PARAM));
}

function fromStorage(storage: Pick<Storage, "getItem"> | undefined): Record<string, FlagOverride> | undefined {
  if (!storage) return undefined;
  return tryParseJson(storage.getItem(STORAGE_KEY));
}

function fromGlobal(globalOverrides: unknown): Record<string, FlagOverride> | undefined {
  return isOverrideMap(globalOverrides) ? globalOverrides : undefined;
}

/**
 * Resolves devtools overrides with explicit precedence: query param >
 * localStorage > injected global. Most-ephemeral/most-explicit wins over
 * most-persistent. Malformed JSON at any source is treated as absent,
 * falling through to the next source. Degrades to {} outside a browser
 * (e.g. SSR) instead of throwing.
 */
export function resolveOverridesFromEnvironment(sources: OverrideSources = defaultSources()): Record<string, FlagOverride> {
  return fromQueryParam(sources.location) ?? fromStorage(sources.storage) ?? fromGlobal(sources.globalOverrides) ?? {};
}

/** One-line convenience: apply a resolved override map to a client. */
export function applyOverridesToClient(client: FlagsClient, overrides: Record<string, FlagOverride>): void {
  client.setOverrides(overrides);
}
