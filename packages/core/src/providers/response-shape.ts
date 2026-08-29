import type { FlagRemoteState } from "../types";

/**
 * Shared by http-polling.ts and sse.ts: accepts either a bare
 * FlagRemoteState[] or an envelope `{ flags: FlagRemoteState[] }` (the
 * envelope form is forward-compatible with a response that later grows
 * fields like `etag`/`serverTime`). Only a shallow shape check, consistent
 * with LocalProvider also not deep-validating its input.
 */
export function parseRemoteStateResponse(body: unknown): FlagRemoteState[] {
  if (Array.isArray(body)) return body as FlagRemoteState[];

  if (body && typeof body === "object" && "flags" in body) {
    const flags = (body as { flags: unknown }).flags;
    if (Array.isArray(flags)) return flags as FlagRemoteState[];
  }

  throw new Error("Expected a FlagRemoteState[] array or a { flags: FlagRemoteState[] } envelope");
}
