import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { FlagsClient } from "@feature-flags/core";
import { buildContextFromRequest, getCookie, getHeader, serializeSnapshot } from "@feature-flags/node";
import type { BuildContextFromRequestOptions } from "@feature-flags/node";
import { definitions, provider } from "./flags";

/**
 * Explicit extractors, zero guessing — the intended usage pattern for
 * buildContextFromRequest (see packages/node/src/context.ts).
 */
export const contextOptions: BuildContextFromRequestOptions = {
  userId: (req) => getHeader(req, "x-user-id"),
  sessionId: (req) => getCookie(req, "sessionId"),
};

/**
 * A fresh FlagsClient per request — per client.ts's own documented
 * concurrency caveat, a shared client must not carry per-request context.
 */
export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const context = buildContextFromRequest(req, contextOptions);

  const client = new FlagsClient({ definitions, provider });
  await client.init();
  const evaluated = client.evaluateAll(context);
  const snapshot = serializeSnapshot(evaluated);

  const html = `<!doctype html>
<html>
<body>
<script id="ff-snapshot" type="application/json">${JSON.stringify(snapshot)}</script>
</body>
</html>`;

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

export function createServer(): Server {
  return createHttpServer((req, res) => {
    void handleRequest(req, res);
  });
}

export async function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
