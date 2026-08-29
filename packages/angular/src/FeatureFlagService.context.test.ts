import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { serializeSnapshot } from "@feature-flags/node";
import type { FlagDefinition } from "@feature-flags/core";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { createTestClient } from "./test-utils/setup";

const targeted: FlagDefinition<boolean> = {
  key: "targeted",
  kind: "release",
  valueType: "boolean",
  defaultValue: false,
  failureMode: "closed",
  sticky: false,
  emitsExposure: false,
};

describe("FeatureFlagService — setContext", () => {
  it("flips snapshot mode to live; a fresh flag$() call after setContext reflects the new context", async () => {
    const remoteState = [
      { key: "targeted", targetingRules: [{ type: "attributeEquals" as const, attribute: "plan", value: "pro" }], updatedAt: "t1" },
    ];
    const client = createTestClient([targeted], remoteState);
    await client.init();
    // Snapshot built for plan:"free" — doesn't match the targeting rule.
    const snapshot = serializeSnapshot(client.evaluateAll({ attributes: { plan: "free" } }));
    // Jasmine's spyOn does not call through by default (unlike vitest's
    // vi.spyOn) — without callThrough the client's context never actually
    // updates, so the "live" re-evaluation below would silently use the
    // stale default context instead of the new one.
    const setContextSpy = spyOn(client, "setContext").and.callThrough();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client, snapshot)] });
    const service = TestBed.inject(FeatureFlagService);

    const snapshotFlag = await firstValueFrom(service.flag$<boolean>("targeted"));
    expect(snapshotFlag.value).toBe(false);

    service.setContext({ attributes: { plan: "pro" } });
    expect(setContextSpy).toHaveBeenCalledTimes(1);

    const liveFlag = await firstValueFrom(service.flag$<boolean>("targeted"));
    expect(liveFlag.value).toBe(true);
  });
});
