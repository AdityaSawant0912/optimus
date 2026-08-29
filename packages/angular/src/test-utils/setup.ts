import { FlagsClient, LocalProvider } from "@useoptimus/core";
import type { FlagDefinition, FlagRemoteState } from "@useoptimus/core";

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
