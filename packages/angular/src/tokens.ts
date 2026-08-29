import { InjectionToken } from "@angular/core";
import type { FlagsClient } from "@optimus/core";
import type { SerializedSnapshot } from "@optimus/node";

export const FLAGS_CLIENT = new InjectionToken<FlagsClient>("FLAGS_CLIENT");
export const FLAGS_SNAPSHOT = new InjectionToken<SerializedSnapshot | undefined>("FLAGS_SNAPSHOT");
