import { Inject, Injectable, Optional } from "@angular/core";
import { Observable, Subject, defer, merge, of } from "rxjs";
import { distinctUntilChanged, map, shareReplay } from "rxjs/operators";
import { FlagsClient } from "@feature-flags/core";
import type { EvaluatedFlag, EvaluationContext } from "@feature-flags/core";
import { hydrateSnapshot } from "@feature-flags/node";
import type { SerializedSnapshot } from "@feature-flags/node";
import { evaluatedFlagsEqual } from "./equality";
import { FLAGS_CLIENT, FLAGS_SNAPSHOT } from "./tokens";

type Mode = "snapshot" | "live";

/**
 * flag$(key) has no per-call context parameter — deliberately narrower than
 * the React adapter's useFlag(key, context). FlagsClient itself only
 * exposes one ambient, mutable context field (setContext/getContext), and
 * Angular has no per-render-scoped unit like a React hook call to safely
 * hang a stateless per-call override off of. Every caller shares the one
 * ambient context; change it via setContext().
 */
@Injectable()
export class FeatureFlagService {
  private mode: Mode;
  private readonly hydrated: Record<string, EvaluatedFlag<unknown>> | undefined;
  private readonly streams = new Map<string, Observable<EvaluatedFlag<unknown>>>();
  private readonly contextChanged = new Subject<void>();

  constructor(
    @Inject(FLAGS_CLIENT) private readonly client: FlagsClient,
    @Optional() @Inject(FLAGS_SNAPSHOT) snapshot: SerializedSnapshot | undefined,
  ) {
    this.hydrated = snapshot ? hydrateSnapshot(snapshot) : undefined;
    this.mode = this.hydrated ? "snapshot" : "live";
  }

  flag$<T = boolean>(key: string): Observable<EvaluatedFlag<T>> {
    if (this.mode === "snapshot") {
      const flag = this.hydrated?.[key];
      if (flag === undefined) {
        throw new Error(`FeatureFlagService.flag$: key "${key}" is not present in the hydrated snapshot`);
      }
      return of(flag as EvaluatedFlag<T>);
    }

    let stream$ = this.streams.get(key);
    if (!stream$) {
      stream$ = merge(
        defer(() => of(undefined)),
        new Observable<void>((subscriber) => {
          return this.client.subscribe((changedKeys) => {
            if (changedKeys.includes(key)) subscriber.next();
          });
        }),
        this.contextChanged,
      ).pipe(
        map(() => this.client.evaluate<unknown>(key)),
        distinctUntilChanged(evaluatedFlagsEqual),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.streams.set(key, stream$);
    }
    return stream$ as Observable<EvaluatedFlag<T>>;
  }

  /** The only way to change context — flips snapshot mode to live and
   *  forces every currently-cached live stream to re-evaluate. */
  setContext(context: EvaluationContext): void {
    this.client.setContext(context);
    this.mode = "live";
    this.contextChanged.next();
  }
}
