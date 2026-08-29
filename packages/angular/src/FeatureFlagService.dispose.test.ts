import { TestBed } from "@angular/core/testing";
import { FeatureFlagService } from "./FeatureFlagService";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("FeatureFlagService — client lifecycle is caller-owned", () => {
  it("never calls client.init() or client.dispose()", async () => {
    const client = createTestClient([boolFlag({ key: "f" })]);
    await client.init();
    const initSpy = spyOn(client, "init");
    const disposeSpy = spyOn(client, "dispose");

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    TestBed.inject(FeatureFlagService);
    TestBed.resetTestingModule();

    expect(initSpy).not.toHaveBeenCalled();
    expect(disposeSpy).not.toHaveBeenCalled();
  });
});
