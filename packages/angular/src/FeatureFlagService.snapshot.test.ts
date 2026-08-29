import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { serializeSnapshot } from "@feature-flags/node";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("FeatureFlagService — snapshot mode", () => {
  it("never calls evaluate()/evaluateAll() while a snapshot is active", async () => {
    const client = createTestClient([boolFlag({ key: "show-banner" })], [
      { key: "show-banner", enabled: true, updatedAt: "now" },
    ]);
    await client.init();
    const snapshot = serializeSnapshot(client.evaluateAll());

    const evaluateSpy = spyOn(client, "evaluate");
    const evaluateAllSpy = spyOn(client, "evaluateAll");

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client, snapshot)] });
    const service = TestBed.inject(FeatureFlagService);

    const flag = await firstValueFrom(service.flag$<boolean>("show-banner"));

    expect(flag.value).toBe(true);
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(evaluateAllSpy).not.toHaveBeenCalled();
  });
});
