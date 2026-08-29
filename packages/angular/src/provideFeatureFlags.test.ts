import { TestBed } from "@angular/core/testing";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("provideFeatureFlags", () => {
  it("registers FeatureFlagService as a singleton within the injector, no NgModule needed", async () => {
    const client = createTestClient([boolFlag({ key: "f" })]);
    await client.init();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });

    const a = TestBed.inject(FeatureFlagService);
    const b = TestBed.inject(FeatureFlagService);

    expect(a).toBe(b);
  });
});
