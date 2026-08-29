import { FlagsClient, LocalProvider } from "@optimus/core";
import type { FlagDefinition } from "@optimus/core";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureFlagsPanelElement, registerFeatureFlagsPanel } from "./panel";

function boolFlag(key: string): FlagDefinition<boolean> {
  return {
    key,
    kind: "release",
    valueType: "boolean",
    defaultValue: false,
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
  };
}

async function createTestClient(): Promise<FlagsClient> {
  const client = new FlagsClient({
    definitions: [boolFlag("flag-a"), boolFlag("flag-b")],
    provider: new LocalProvider([{ key: "flag-a", enabled: true, updatedAt: "now" }]),
  });
  await client.init();
  return client;
}

describe("registerFeatureFlagsPanel", () => {
  it("is idempotent across multiple calls", () => {
    expect(() => {
      registerFeatureFlagsPanel();
      registerFeatureFlagsPanel();
    }).not.toThrow();
    expect(customElements.get("feature-flags-panel")).toBeDefined();
  });
});

describe("FeatureFlagsPanelElement", () => {
  let element: FeatureFlagsPanelElement;

  afterEach(() => {
    element.remove();
  });

  it("renders nothing before a client is set", () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    expect(element.client).toBeUndefined();
    expect(element.innerHTML).toBe("");
  });

  it("exposes the current client via the getter", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;

    expect(element.client).toBe(client);
  });

  it("renders one row per evaluateAll() key when a client is set", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;

    const rows = element.querySelectorAll("[data-flag-key]");
    expect(rows).toHaveLength(2);
    expect(element.querySelector('[data-flag-key="flag-a"]')).not.toBeNull();
    expect(element.querySelector('[data-flag-key="flag-b"]')).not.toBeNull();
  });

  it("Apply calls setOverrides with the entered value", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;

    const row = element.querySelector('[data-flag-key="flag-b"]')!;
    const valueInput = row.querySelector<HTMLInputElement>('[data-role="value-input"]')!;
    const applyButton = row.querySelector<HTMLButtonElement>('[data-role="apply-button"]')!;

    valueInput.value = "true";
    applyButton.click();

    expect(client.evaluate("flag-b")).toMatchObject({ value: true, reason: "override" });
  });

  it("Apply keeps a non-JSON value as a raw string", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;

    const row = element.querySelector('[data-flag-key="flag-b"]')!;
    const valueInput = row.querySelector<HTMLInputElement>('[data-role="value-input"]')!;
    const variantInput = row.querySelector<HTMLInputElement>('[data-role="variant-input"]')!;
    const applyButton = row.querySelector<HTMLButtonElement>('[data-role="apply-button"]')!;

    valueInput.value = "not-json";
    variantInput.value = "treatment";
    applyButton.click();

    expect(client.evaluate("flag-b")).toMatchObject({ value: "not-json", variantKey: "treatment", reason: "override" });
  });

  it("Clear calls clearOverrides([key])", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;
    client.setOverrides({ "flag-b": { value: true } });

    const row = element.querySelector('[data-flag-key="flag-b"]')!;
    const clearButton = row.querySelector<HTMLButtonElement>('[data-role="clear-button"]')!;
    clearButton.click();

    expect(client.evaluate("flag-b")).toMatchObject({ value: false, reason: "default" });
  });

  it("re-renders on a subscribe() tick", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;

    client.setOverrides({ "flag-b": { value: true } });

    const row = element.querySelector('[data-flag-key="flag-b"]')!;
    expect(row.textContent).toContain("true");
  });

  it("disconnectedCallback unsubscribes — no further re-renders after removal", async () => {
    registerFeatureFlagsPanel();
    element = document.createElement("feature-flags-panel") as FeatureFlagsPanelElement;
    document.body.appendChild(element);

    const client = await createTestClient();
    element.client = client;
    element.remove(); // triggers disconnectedCallback

    expect(() => client.setOverrides({ "flag-b": { value: true } })).not.toThrow();
  });
});
