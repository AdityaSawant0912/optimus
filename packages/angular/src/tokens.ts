import { InjectionToken } from "@angular/core";
import type { FlagsClient } from "@useoptimus/core";
import type { SerializedSnapshot } from "@useoptimus/node";

export const FLAGS_CLIENT = new InjectionToken<FlagsClient>("FLAGS_CLIENT");
export const FLAGS_SNAPSHOT = new InjectionToken<SerializedSnapshot | undefined>("FLAGS_SNAPSHOT");
