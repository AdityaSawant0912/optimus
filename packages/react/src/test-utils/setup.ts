import { FlagsClient, LocalProvider } from "@optimus/core";
import type { FlagDefinition, FlagRemoteState } from "@optimus/core";

export function boolFlag(overrides: Partial<FlagDefinition<boolean>> & { key: string }): FlagDefinition<boolean> {
  return {
    kind: "release",
    valueType: "boolean",
    defaultValue: false,
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...overrides,
  };
}

export function createTestClient(
  definitions: FlagDefinition<unknown>[],
  remoteState: FlagRemoteState[] = [],
): FlagsClient {
  return new FlagsClient({ definitions, provider: new LocalProvider(remoteState) });
}
