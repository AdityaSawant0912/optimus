import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpPollingProvider } from "./http-polling";
import type { FetchLike, FetchLikeResponse } from "./platform";

function jsonResponse(body: unknown, status = 200): FetchLikeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("HttpPollingProvider.getRemoteState", () => {
  it("accepts a bare FlagRemoteState[] response", async () => {
    const states = [{ key: "a", enabled: true, updatedAt: "now" }];
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse(states));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl });
    await provider.init();

    expect(await provider.getRemoteState()).toEqual(states);
  });

  it("accepts a { flags: [...] } envelope response", async () => {
    const states = [{ key: "a", enabled: true, updatedAt: "now" }];
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ flags: states }));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl });
    await provider.init();

    expect(await provider.getRemoteState()).toEqual(states);
  });

  it("filters by keys client-side after fetching", async () => {
    const states = [
      { key: "a", enabled: true, updatedAt: "now" },
      { key: "b", enabled: false, updatedAt: "now" },
    ];
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse(states));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl });
    await provider.init();

    expect(await provider.getRemoteState(["b"])).toEqual([states[1]]);
  });

  it("rejects on a non-2xx status", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({}, 500));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl });
    await provider.init();

    await expect(provider.getRemoteState()).rejects.toThrow("unexpected status 500");
  });

  it("rejects on a malformed body", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ nonsense: true }));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl });
    await provider.init();

    await expect(provider.getRemoteState()).rejects.toThrow();
  });

  it("init() throws when no fetchImpl and no global fetch is available", async () => {
    vi.stubGlobal("fetch", undefined);
    try {
      const provider = new HttpPollingProvider({ url: "https://x/flags" });
      await expect(provider.init()).rejects.toThrow(/no fetchImpl/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("HttpPollingProvider.subscribe — cadence and backoff", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires the first tick after intervalMs, not immediately", async () => {
    const states = [{ key: "a", enabled: true, updatedAt: "now" }];
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse(states));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl, intervalMs: 1000 });
    await provider.init();

    const onUpdate = vi.fn();
    provider.subscribe(onUpdate);

    await vi.advanceTimersByTimeAsync(999);
    expect(onUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(states);
  });

  it("maintains steady intervalMs cadence between successful ticks", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse([]));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl, intervalMs: 1000 });
    await provider.init();

    const onUpdate = vi.fn();
    provider.subscribe(onUpdate);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdate).toHaveBeenCalledTimes(3);
  });

  it("backs off with Equal Jitter on failure and resets cadence after a success", async () => {
    let call = 0;
    const fetchImpl: FetchLike = vi.fn(async () => {
      call++;
      if (call <= 2) return jsonResponse({}, 500);
      return jsonResponse([]);
    });
    const random = vi.fn(() => 0.5);
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl, intervalMs: 1000, random });
    await provider.init();

    const onUpdate = vi.fn();
    provider.subscribe(onUpdate);

    // t=1000: first tick fails (call 1). failures=1 -> raw=1000, delay=500+0.5*500=750
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();

    // t=1750: second tick fails (call 2). failures=2 -> raw=2000, delay=1000+0.5*1000=1500
    await vi.advanceTimersByTimeAsync(750);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUpdate).not.toHaveBeenCalled();

    // t=3250: third tick succeeds (call 3) -> cadence resets to intervalMs
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("a malformed/failing tick never throws and polling continues on the next scheduled tick", async () => {
    let call = 0;
    const fetchImpl: FetchLike = vi.fn(async () => {
      call++;
      return call === 1 ? jsonResponse({ nonsense: true }) : jsonResponse([]);
    });
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl, intervalMs: 1000, random: () => 0 });
    await provider.init();

    const onUpdate = vi.fn();
    expect(() => provider.subscribe(onUpdate)).not.toThrow();

    await vi.advanceTimersByTimeAsync(1000); // fails, malformed body
    expect(onUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // backoff delay (random=0 -> raw/2), then recovers
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops all future ticks, including one already scheduled", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse([]));
    const provider = new HttpPollingProvider({ url: "https://x/flags", fetchImpl, intervalMs: 1000 });
    await provider.init();

    const onUpdate = vi.fn();
    const unsubscribe = provider.subscribe(onUpdate);
    unsubscribe();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
