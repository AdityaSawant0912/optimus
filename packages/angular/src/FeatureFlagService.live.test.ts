import { TestBed } from "@angular/core/testing";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("FeatureFlagService — live mode", () => {
  it("emits a new value when a live update actually changes the flag", async () => {
    const remoteState = [{ key: "f", enabled: false, updatedAt: "t1" }];
    const client = createTestClient([boolFlag({ key: "f" })], remoteState);
    await client.init();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    const service = TestBed.inject(FeatureFlagService);

    const values: boolean[] = [];
    const sub = service.flag$<boolean>("f").subscribe((flag) => values.push(flag.value));

    remoteState[0] = { key: "f", enabled: true, updatedAt: "t2" };
    await client.refresh();

    expect(values).toEqual([false, true]);
    sub.unsubscribe();
  });

  it("a refresh() for an unrelated key produces no new emission for this key's stream", async () => {
    const remoteState = [
      { key: "watched", enabled: false, updatedAt: "t1" },
      { key: "other", enabled: false, updatedAt: "t1" },
    ];
    const client = createTestClient([boolFlag({ key: "watched" }), boolFlag({ key: "other" })], remoteState);
    await client.init();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    const service = TestBed.inject(FeatureFlagService);

    const values: boolean[] = [];
    const sub = service.flag$<boolean>("watched").subscribe((flag) => values.push(flag.value));

    remoteState[1] = { key: "other", enabled: true, updatedAt: "t2" };
    await client.refresh(["other"]);

    expect(values).toEqual([false]);
    sub.unsubscribe();
  });
});
