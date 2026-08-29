import { LocalProvider } from "@optimus/core";
import type { FlagDefinition, FlagRemoteState } from "@optimus/core";

/** Deterministic sanity-check flag: remote state pins it on regardless of context. */
export const showBanner: FlagDefinition<boolean> = {
  key: "show-banner",
  kind: "release",
  valueType: "boolean",
  defaultValue: false,
  failureMode: "closed",
  sticky: false,
  emitsExposure: false,
};

/** Bucketed flag: no remote override, so real 50/50 rollout logic runs. */
export const checkoutExperiment: FlagDefinition<string> = {
  key: "checkout-experiment",
  kind: "experiment",
  valueType: "variant",
  defaultValue: "control",
  variants: [
    { key: "control", value: "control", weight: 50 },
    { key: "treatment", value: "treatment", weight: 50 },
  ],
  failureMode: "closed",
  sticky: true,
  emitsExposure: true,
};

export const definitions: FlagDefinition<unknown>[] = [showBanner, checkoutExperiment];

const remoteState: FlagRemoteState[] = [
  { key: "show-banner", enabled: true, updatedAt: "2024-01-01T00:00:00.000Z" },
];

export const provider = new LocalProvider(remoteState);
