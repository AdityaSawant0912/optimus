import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { FlagDefinition } from "@feature-flags/core";
import { IfFeatureDirective } from "./ifFeature.directive";
import { provideFeatureFlags } from "./provideFeatureFlags";
import { boolFlag, createTestClient } from "./test-utils/setup";

@Component({
  standalone: true,
  imports: [IfFeatureDirective],
  template: `<div *ifFeature="'flag-key'" data-testid="shown">shown</div>`,
})
class BoolHostComponent {}

@Component({
  standalone: true,
  imports: [IfFeatureDirective],
  template: `<div *ifFeature="'count'" data-testid="shown">shown</div>`,
})
class NumberHostComponent {}

describe("IfFeatureDirective", () => {
  it("adds/removes the view based on a boolean flag's value", async () => {
    const remoteState = [{ key: "flag-key", enabled: false, updatedAt: "t1" }];
    const client = createTestClient([boolFlag({ key: "flag-key" })], remoteState);
    await client.init();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    const fixture = TestBed.createComponent(BoolHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shown"]')).toBeNull();

    remoteState[0] = { key: "flag-key", enabled: true, updatedAt: "t2" };
    await client.refresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shown"]')).not.toBeNull();
  });

  it("uses generic truthiness for a non-boolean flag (0 hides, non-zero shows)", async () => {
    const numberFlag: FlagDefinition<number> = {
      key: "count",
      kind: "dynamicConfig",
      valueType: "value",
      defaultValue: 0,
      failureMode: "closed",
      sticky: false,
      emitsExposure: false,
    };
    const remoteState = [{ key: "count", valueOverride: 0, updatedAt: "t1" }];
    const client = createTestClient([numberFlag], remoteState);
    await client.init();

    TestBed.configureTestingModule({ providers: [provideFeatureFlags(client)] });
    const fixture = TestBed.createComponent(NumberHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shown"]')).toBeNull();

    remoteState[0] = { key: "count", valueOverride: 5, updatedAt: "t2" };
    await client.refresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shown"]')).not.toBeNull();
  });
});
