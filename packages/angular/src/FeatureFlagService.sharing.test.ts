import { TestBed } from "@angular/core/testing";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("FeatureFlagService — sharing", () => {
  it("shares one client.subscribe() registration across multiple flag$() calls for the same key", async () => {
    const client = createTestClient([boolFlag({ key: "f" })], [{ key: "f", enabled: true, updatedAt: "t1" }]);
    await client.init();
    const subscribeSpy = spyOn(client, "subscribe");

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    const service = TestBed.inject(FeatureFlagService);

    const sub1 = service.flag$("f").subscribe();
    const sub2 = service.flag$("f").subscribe();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });
});
