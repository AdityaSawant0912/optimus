import { describe, expect, it, vi } from "vitest";
import { SseProvider } from "./sse";
import type { EventSourceLike } from "./platform";

class FakeEventSource implements EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closeCalls = 0;

  close(): void {
    this.closeCalls++;
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }

  triggerError(): void {
    this.onerror?.(new Error("connection hiccup"));
  }
}

describe("SseProvider", () => {
  it("returns [] before the first push", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();

    expect(await provider.getRemoteState()).toEqual([]);
  });

  it("delivers a bare-array push to onUpdate and updates the snapshot", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();

    const onUpdate = vi.fn();
    provider.subscribe(onUpdate);
    const states = [{ key: "a", enabled: true, updatedAt: "now" }];
    fake.emit(states);

    expect(onUpdate).toHaveBeenCalledWith(states);
    expect(await provider.getRemoteState()).toEqual(states);
  });

  it("delivers a { flags: [...] } envelope push", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();

    const onUpdate = vi.fn();
    provider.subscribe(onUpdate);
    const states = [{ key: "a", enabled: true, updatedAt: "now" }];
    fake.emit({ flags: states });

    expect(onUpdate).toHaveBeenCalledWith(states);
  });

  it("filters getRemoteState by keys against the last-known state", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();
    provider.subscribe(() => {});
    fake.emit([
      { key: "a", enabled: true, updatedAt: "now" },
      { key: "b", enabled: false, updatedAt: "now" },
    ]);

    expect(await provider.getRemoteState(["b"])).toEqual([{ key: "b", enabled: false, updatedAt: "now" }]);
  });

  it("drops a malformed message without throwing; a later valid message still arrives", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();

    const onUpdate = vi.fn();
    provider.subscribe(onUpdate);

    expect(() => fake.emit("not json {{{")).not.toThrow();
    expect(() => fake.emit({ nonsense: true })).not.toThrow();
    expect(onUpdate).not.toHaveBeenCalled();

    const states = [{ key: "a", enabled: true, updatedAt: "now" }];
    fake.emit(states);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(states);
  });

  it("onerror does not close the connection or attempt to reconnect", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();
    provider.subscribe(() => {});

    fake.triggerError();

    expect(fake.closeCalls).toBe(0);
  });

  it("unsubscribe calls close() exactly once and detaches handlers", async () => {
    const fake = new FakeEventSource();
    const provider = new SseProvider({ url: "https://x/stream", eventSourceFactory: () => fake });
    await provider.init();

    const onUpdate = vi.fn();
    const unsubscribe = provider.subscribe(onUpdate);
    unsubscribe();

    expect(fake.closeCalls).toBe(1);
    expect(fake.onmessage).toBeNull();

    fake.emit([{ key: "a", enabled: true, updatedAt: "now" }]);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("throws a clear error when no factory and no global EventSource are available", async () => {
    const provider = new SseProvider({ url: "https://x/stream" });
    await provider.init();

    expect(() => provider.subscribe(() => {})).toThrow(/no eventSourceFactory/);
  });
});
