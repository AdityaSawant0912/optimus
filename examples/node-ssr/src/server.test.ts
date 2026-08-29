import { describe, expect, it } from "vitest";
import { FlagsClient } from "@optimus/core";
import { buildContextFromRequest, hydrateSnapshot } from "@optimus/node";
import type { RequestLike } from "@optimus/node";
import { definitions, provider } from "./flags";
import { contextOptions, startServer } from "./server";

describe("node-ssr example server", () => {
  it("hydrated server snapshot matches a direct evaluateAll() for the same context, with a pinned value", async () => {
    const { url, close } = await startServer();
    try {
      const res = await fetch(url, { headers: { "x-user-id": "user-42", cookie: "sessionId=sess-abc" } });
      const html = await res.text();

      const match = html.match(/<script id="ff-snapshot"[^>]*>([\s\S]*?)<\/script>/);
      expect(match).not.toBeNull();
      const scriptBody = match?.[1] ?? "";
      const snapshot = JSON.parse(scriptBody);
      const hydrated = hydrateSnapshot(snapshot);

      // Independently evaluate the same context, reusing the same explicit
      // extractors — no second evaluate() call in the actual server->client
      // path (hydrateSnapshot's one-arg signature makes that structurally
      // impossible); this is a separate, independent check.
      const directReq: RequestLike = { headers: { "x-user-id": "user-42", cookie: "sessionId=sess-abc" } };
      const directContext = buildContextFromRequest(directReq, contextOptions);
      const directClient = new FlagsClient({ definitions, provider });
      await directClient.init();
      const direct = directClient.evaluateAll(directContext);

      expect(hydrated).toEqual(direct);
      // Pinned, non-tautological assertion: show-banner is enabled via
      // remote state regardless of bucketing, so this should always be true.
      expect(hydrated["show-banner"]).toMatchObject({ value: true, reason: "override" });
    } finally {
      await close();
    }
  });
});
