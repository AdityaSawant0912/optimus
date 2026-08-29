import { describe, expect, it } from "vitest";
import { buildContextFromRequest, getCookie, getHeader } from "./context";
import type { NodeHeaders, RequestLike, WebHeaders } from "./context";

function nodeReq(headers: NodeHeaders): RequestLike {
  return { headers };
}

function webReq(entries: Record<string, string>): RequestLike {
  const headers: WebHeaders = {
    get: (name) => entries[name.toLowerCase()] ?? null,
  };
  return { headers };
}

describe("getHeader", () => {
  it("reads a NodeHeaders-shaped request case-insensitively", () => {
    const req = nodeReq({ "x-user-id": "u1" });
    expect(getHeader(req, "x-user-id")).toBe("u1");
    expect(getHeader(req, "X-User-Id")).toBe("u1");
  });

  it("joins repeated NodeHeaders array values with ', '", () => {
    const req = nodeReq({ "x-tags": ["a", "b"] });
    expect(getHeader(req, "x-tags")).toBe("a, b");
  });

  it("returns undefined for a missing NodeHeaders header", () => {
    expect(getHeader(nodeReq({}), "missing")).toBeUndefined();
  });

  it("reads a WebHeaders-shaped request via .get()", () => {
    const req = webReq({ "x-user-id": "u1" });
    expect(getHeader(req, "x-user-id")).toBe("u1");
  });

  it("returns undefined for a missing WebHeaders header", () => {
    expect(getHeader(webReq({}), "missing")).toBeUndefined();
  });
});

describe("getCookie", () => {
  it("parses a multi-cookie string and returns the matching value", () => {
    const req = nodeReq({ cookie: "a=1; b=2; sessionId=sess-abc" });
    expect(getCookie(req, "sessionId")).toBe("sess-abc");
    expect(getCookie(req, "a")).toBe("1");
  });

  it("decodes URI-encoded cookie values", () => {
    const req = nodeReq({ cookie: "name=hello%20world" });
    expect(getCookie(req, "name")).toBe("hello world");
  });

  it("returns undefined for a missing cookie key", () => {
    const req = nodeReq({ cookie: "a=1" });
    expect(getCookie(req, "missing")).toBeUndefined();
  });

  it("returns undefined when there is no Cookie header at all", () => {
    expect(getCookie(nodeReq({}), "a")).toBeUndefined();
  });

  it("works against a WebHeaders-shaped request too", () => {
    const req = webReq({ cookie: "sessionId=sess-abc" });
    expect(getCookie(req, "sessionId")).toBe("sess-abc");
  });
});

describe("buildContextFromRequest", () => {
  it("returns {} with no options — zero built-in guessing", () => {
    const req = nodeReq({ "x-user-id": "u1", cookie: "sessionId=s1" });
    expect(buildContextFromRequest(req)).toEqual({});
  });

  it("populates each field only via its explicit extractor", () => {
    const req = nodeReq({ "x-user-id": "u1", cookie: "sessionId=s1" });
    const context = buildContextFromRequest(req, {
      userId: (r) => getHeader(r, "x-user-id"),
      sessionId: (r) => getCookie(r, "sessionId"),
      deviceId: () => "device-9",
      anonymousId: () => "anon-9",
      bucketingKey: () => "explicit-key",
      attributes: () => ({ plan: "pro" }),
    });

    expect(context).toEqual({
      userId: "u1",
      sessionId: "s1",
      deviceId: "device-9",
      anonymousId: "anon-9",
      bucketingKey: "explicit-key",
      attributes: { plan: "pro" },
    });
  });

  it("accepts environment as a plain string", () => {
    const context = buildContextFromRequest(nodeReq({}), { environment: "production" });
    expect(context.environment).toBe("production");
  });

  it("accepts environment as a function of the request", () => {
    const req = nodeReq({ "x-env": "staging" });
    const context = buildContextFromRequest(req, { environment: (r) => getHeader(r, "x-env") ?? "unknown" });
    expect(context.environment).toBe("staging");
  });

  it("leaves a field absent (not present-as-undefined) when its extractor returns undefined", () => {
    const context = buildContextFromRequest(nodeReq({}), { userId: () => undefined });
    expect("userId" in context).toBe(false);
  });
});
