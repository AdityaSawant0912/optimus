import type { FlagsClient } from "@useoptimus/core";

const TAG_NAME = "feature-flags-panel";

/**
 * Framework-agnostic Custom Element — composes with React, Angular, or
 * neither, without a new peer dependency. v1 scope is deliberately minimal
 * (a generic raw-JSON value input per row, no type-aware widgets): a
 * boolean toggle or variant dropdown would need a new client.getDefinitions()
 * -style introspection method, a second reopening of FlagsClient beyond the
 * override wiring this phase already adds. Smoke-test only — deep UI
 * testing isn't warranted for a debug tool.
 */
export class FeatureFlagsPanelElement extends HTMLElement {
  private flagsClient: FlagsClient | undefined;
  private unsubscribe: (() => void) | undefined;

  set client(client: FlagsClient) {
    this.unsubscribe?.();
    this.flagsClient = client;
    this.unsubscribe = client.subscribe(() => this.render());
    this.render();
  }

  get client(): FlagsClient | undefined {
    return this.flagsClient;
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private render(): void {
    const client = this.flagsClient;
    if (!client) {
      this.innerHTML = "";
      return;
    }

    const evaluated = client.evaluateAll();
    this.innerHTML = "";

    for (const [key, flag] of Object.entries(evaluated)) {
      const row = document.createElement("div");
      row.dataset.flagKey = key;

      const label = document.createElement("span");
      label.textContent = `${key}: ${JSON.stringify(flag.value)} (${flag.reason})`;
      row.appendChild(label);

      const valueInput = document.createElement("input");
      valueInput.type = "text";
      valueInput.placeholder = "value (JSON or plain string)";
      valueInput.dataset.role = "value-input";
      row.appendChild(valueInput);

      const variantInput = document.createElement("input");
      variantInput.type = "text";
      variantInput.placeholder = "variantKey (optional)";
      variantInput.dataset.role = "variant-input";
      row.appendChild(variantInput);

      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.textContent = "Apply";
      applyButton.dataset.role = "apply-button";
      applyButton.addEventListener("click", () => {
        let value: unknown = valueInput.value;
        try {
          value = JSON.parse(valueInput.value);
        } catch {
          // not JSON — keep the raw string
        }
        client.setOverrides({
          [key]: { value, variantKey: variantInput.value || undefined },
        });
      });
      row.appendChild(applyButton);

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.textContent = "Clear";
      clearButton.dataset.role = "clear-button";
      clearButton.addEventListener("click", () => client.clearOverrides([key]));
      row.appendChild(clearButton);

      this.appendChild(row);
    }
  }
}

/** Idempotent — safe to call more than once. */
export function registerFeatureFlagsPanel(): void {
  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, FeatureFlagsPanelElement);
  }
}
