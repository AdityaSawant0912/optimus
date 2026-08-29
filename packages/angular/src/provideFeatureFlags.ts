import type { EnvironmentProviders } from "@angular/core";
import { makeEnvironmentProviders } from "@angular/core";
import type { FlagsClient } from "@useoptimus/core";
import type { SerializedSnapshot } from "@useoptimus/node";
import { FeatureFlagService } from "./FeatureFlagService";
import { FLAGS_CLIENT, FLAGS_SNAPSHOT } from "./tokens";

/**
 * Never calls client.init()/dispose() — fully caller-owned. Angular's
 * EnvironmentInjector destruction is a real (not dev-only) event, and a
 * lazy route's child injector is destroyed on navigation away from it;
 * call this only from bootstrapApplication()'s root providers unless a
 * route-scoped client is deliberately wanted.
 */
export function provideFeatureFlags(client: FlagsClient, snapshot?: SerializedSnapshot): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: FLAGS_CLIENT, useValue: client },
    { provide: FLAGS_SNAPSHOT, useValue: snapshot },
    FeatureFlagService,
  ]);
}
