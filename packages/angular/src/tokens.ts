import { InjectionToken } from "@angular/core";
import type { FlagsClient } from "@feature-flags/core";
import type { SerializedSnapshot } from "@feature-flags/node";

export const FLAGS_CLIENT = new InjectionToken<FlagsClient>("FLAGS_CLIENT");
export const FLAGS_SNAPSHOT = new InjectionToken<SerializedSnapshot | undefined>("FLAGS_SNAPSHOT");
