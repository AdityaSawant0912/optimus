import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("FeatureFlagService — unknown key", () => {
  it("errors synchronously on subscribe, matching evaluate()'s throw-by-design contract", async () => {
    const client = createTestClient([boolFlag({ key: "f" })]);
    await client.init();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    const service = TestBed.inject(FeatureFlagService);

    await expectAsync(firstValueFrom(service.flag$("missing"))).toBeRejectedWithError(/unknown flag key/i);
  });
});
