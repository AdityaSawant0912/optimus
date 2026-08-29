import type { EvaluationContext } from "@feature-flags/core";

export type NodeHeaderValue = string | string[] | undefined;

/** Node http.IncomingMessage / Express / Fastify header shape. */
export interface NodeHeaders {
  [name: string]: NodeHeaderValue;
}

/** Web-standard Headers shape (Next.js App Router Request, fetch Request). */
export interface WebHeaders {
  get(name: string): string | null;
}

export interface RequestLike {
  headers: NodeHeaders | WebHeaders;
}

function isWebHeaders(headers: NodeHeaders | WebHeaders): headers is WebHeaders {
  return typeof (headers as WebHeaders).get === "function";
}

export function getHeader(req: RequestLike, name: string): string | undefined {
  const headers = req.headers;
  if (isWebHeaders(headers)) {
    return headers.get(name) ?? undefined;
  }
  const value = headers[name.toLowerCase()];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(", ") : value;
}

export function getCookie(req: RequestLike, name: string): string | undefined {
  const cookieHeader = getHeader(req, "cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return undefined;
}

export interface BuildContextFromRequestOptions {
  bucketingKey?: (req: RequestLike) => string | undefined;
  userId?: (req: RequestLike) => string | undefined;
  deviceId?: (req: RequestLike) => string | undefined;
  sessionId?: (req: RequestLike) => string | undefined;
  anonymousId?: (req: RequestLike) => string | undefined;
  attributes?: (req: RequestLike) => Record<string, string | number | boolean>;
  environment?: string | ((req: RequestLike) => string);
}

/**
 * Builds an EvaluationContext from a request with zero built-in guessing —
 * every field is populated only via a caller-supplied extractor. There is
 * no default header/cookie naming convention: guessing one (e.g. assuming
 * `x-user-id`) would be wrong for most real apps and would corrupt bucket
 * assignment silently, which is worse than doing nothing until configured.
 * See PLAN.md §5's identical stance on the bucketing key itself.
 */
export function buildContextFromRequest(
  req: RequestLike,
  options: BuildContextFromRequestOptions = {},
): EvaluationContext {
  const context: EvaluationContext = {};

  const bucketingKey = options.bucketingKey?.(req);
  if (bucketingKey !== undefined) context.bucketingKey = bucketingKey;

  const userId = options.userId?.(req);
  if (userId !== undefined) context.userId = userId;

  const deviceId = options.deviceId?.(req);
  if (deviceId !== undefined) context.deviceId = deviceId;

  const sessionId = options.sessionId?.(req);
  if (sessionId !== undefined) context.sessionId = sessionId;

  const anonymousId = options.anonymousId?.(req);
  if (anonymousId !== undefined) context.anonymousId = anonymousId;

  const attributes = options.attributes?.(req);
  if (attributes !== undefined) context.attributes = attributes;

  if (options.environment !== undefined) {
    context.environment =
      typeof options.environment === "function" ? options.environment(req) : options.environment;
  }

  return context;
}
