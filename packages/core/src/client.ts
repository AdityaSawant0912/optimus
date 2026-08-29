import { evaluate } from "./engine";
import type { EvaluatedFlag, EvaluationContext, FlagDefinition, FlagProvider, FlagRemoteState } from "./types";

// ---- Public types ----

export interface FlagStateEntry {
  /** Last remote state successfully returned by the provider for this key,
   *  or undefined if the provider has never reported an entry for it
   *  (a valid, non-error outcome — "no live override"). */
  remoteState: FlagRemoteState | undefined;
  /** epoch ms of the last successful fetch that covered this key.
   *  undefined = never successfully fetched. */
  fetchedAt: number | undefined;
  /** Set when the most recent fetch attempt for this key failed; cleared on
   *  the next successful fetch for that key. */
  lastError: unknown | undefined;
}

export interface FlagStateCache {
  get(key: string): FlagStateEntry | undefined;
  set(key: string, entry: FlagStateEntry): void;
}

export type OnEvaluateHandler = (evaluated: EvaluatedFlag, definition: FlagDefinition<unknown>) => void;
export type ClientUpdateListener = (changedKeys: string[]) => void;
export type Unsubscribe = () => void;

export interface FlagOverride {
  value: unknown;
  variantKey?: string;
}

export interface RefreshResult {
  succeededKeys: string[];
  failedKeys: string[];
  errors: Record<string, unknown>;
}

export interface FlagsClientOptions {
  /** Immutable registry for this client's lifetime — no addFlag/removeFlag. */
  definitions: FlagDefinition<unknown>[];
  provider: FlagProvider;
  context?: EvaluationContext;
  /** Storage adapter for last-known remote state. Defaults to an in-memory
   *  Map. A future TTL/stale-while-revalidate cache plugs in here without
   *  this class needing to change — see PLAN.md §10. */
  cache?: FlagStateCache;
  onEvaluate?: OnEvaluateHandler;
  /** Clock seam for tests. */
  now?: () => number;
}

// ---- Default in-memory cache ----

class InMemoryFlagStateCache implements FlagStateCache {
  private readonly entries = new Map<string, FlagStateEntry>();

  get(key: string): FlagStateEntry | undefined {
    return this.entries.get(key);
  }

  set(key: string, entry: FlagStateEntry): void {
    this.entries.set(key, entry);
  }
}

// ---- dependsOn topological resolution ----

interface DependencyGraph {
  /** Keys in a valid dependsOn topological order (parents before children). */
  order: string[];
  /** Keys involved in a cycle (including self-dependency), appended after
   *  `order` in registration order. Never resolved before their own
   *  dependencies, so `evaluate()`'s existing dependencyNotMet path handles
   *  them without any special-cased cycle error. */
  cyclic: string[];
}

function buildDependencyGraph(definitions: FlagDefinition<unknown>[]): DependencyGraph {
  const byKey = new Map(definitions.map((d) => [d.key, d]));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const def of definitions) {
    if (!inDegree.has(def.key)) inDegree.set(def.key, 0);
    if (!children.has(def.key)) children.set(def.key, []);
  }

  for (const def of definitions) {
    for (const parentKey of def.dependsOn ?? []) {
      if (!byKey.has(parentKey)) continue; // unknown parent: engine yields dependencyNotMet on its own
      children.get(parentKey)!.push(def.key);
      inDegree.set(def.key, (inDegree.get(def.key) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const def of definitions) {
    if (inDegree.get(def.key) === 0) queue.push(def.key);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    order.push(key);
    for (const child of children.get(key) ?? []) {
      const remaining = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }

  const resolved = new Set(order);
  const cyclic = definitions.map((d) => d.key).filter((key) => !resolved.has(key));

  return { order, cyclic };
}

function collectAncestors(key: string, byKey: Map<string, FlagDefinition<unknown>>): Set<string> {
  const ancestors = new Set<string>();
  const stack = [...(byKey.get(key)?.dependsOn ?? [])];
  while (stack.length > 0) {
    const parentKey = stack.pop()!;
    if (ancestors.has(parentKey)) continue;
    ancestors.add(parentKey);
    const parentDef = byKey.get(parentKey);
    if (parentDef) stack.push(...(parentDef.dependsOn ?? []));
  }
  return ancestors;
}

// ---- FlagsClient ----

/**
 * Orchestration layer around the pure `evaluate()` engine: owns a flag
 * registry, a FlagProvider, last-known remote state, dependsOn resolution
 * across multiple flags, failureMode semantics, and exposure events.
 *
 * `evaluate`/`evaluateAll` are synchronous cache reads — they never call the
 * provider, so a broken provider can only degrade individual flags (via
 * failureMode), never throw out of an evaluation call. The one exception is
 * `evaluate()` on a key that was never registered, which is a caller bug and
 * throws synchronously by design.
 *
 * Not thread-safe across concurrent contexts: `setContext`/`getContext`
 * mutate shared instance state, so a single instance must not be reused
 * across concurrent requests with different contexts (e.g. SSR). Either
 * instantiate one client per request, or always pass `context` explicitly to
 * `evaluate`/`evaluateAll` and never call `setContext` on a shared instance.
 */
export class FlagsClient {
  private readonly byKey: Map<string, FlagDefinition<unknown>>;
  private readonly provider: FlagProvider;
  private readonly cache: FlagStateCache;
  private readonly now: () => number;
  private readonly graph: DependencyGraph;
  private readonly fullOrder: string[];

  private context: EvaluationContext;
  private providerUnsubscribe: Unsubscribe | undefined;
  private disposed = false;

  private readonly evaluateHandlers = new Set<OnEvaluateHandler>();
  private readonly updateListeners = new Set<ClientUpdateListener>();

  constructor(options: FlagsClientOptions) {
    this.byKey = new Map(options.definitions.map((d) => [d.key, d]));
    this.provider = options.provider;
    this.cache = options.cache ?? new InMemoryFlagStateCache();
    this.now = options.now ?? Date.now;
    this.context = options.context ?? {};
    this.graph = buildDependencyGraph(options.definitions);
    this.fullOrder = [...this.graph.order, ...this.graph.cyclic];

    if (options.onEvaluate) this.evaluateHandlers.add(options.onEvaluate);
  }

  async init(): Promise<void> {
    try {
      await this.provider.init();
    } catch (err) {
      const fetchedAt = undefined;
      for (const key of this.byKey.keys()) {
        this.cache.set(key, { remoteState: undefined, fetchedAt, lastError: err });
      }
      throw err;
    }

    await this.refresh();

    if (this.provider.subscribe) {
      this.providerUnsubscribe = this.provider.subscribe((states) => this.onProviderPush(states));
    }
  }

  async refresh(keys?: string[]): Promise<RefreshResult> {
    const targetKeys = keys ?? [...this.byKey.keys()];

    try {
      const states = await this.provider.getRemoteState(keys);
      const returned = new Map(states.map((s) => [s.key, s]));
      for (const key of targetKeys) {
        this.cache.set(key, { remoteState: returned.get(key), fetchedAt: this.now(), lastError: undefined });
      }
      this.notifySubscribers(targetKeys);
      return { succeededKeys: targetKeys, failedKeys: [], errors: {} };
    } catch (err) {
      for (const key of targetKeys) {
        const prev = this.cache.get(key);
        this.cache.set(key, { remoteState: prev?.remoteState, fetchedAt: prev?.fetchedAt, lastError: err });
      }
      this.notifySubscribers(targetKeys);
      const errors: Record<string, unknown> = {};
      for (const key of targetKeys) errors[key] = err;
      return { succeededKeys: [], failedKeys: targetKeys, errors };
    }
  }

  setContext(context: EvaluationContext): void {
    this.context = context;
  }

  getContext(): EvaluationContext {
    return this.context;
  }

  evaluate<T = boolean>(key: string, context?: EvaluationContext): EvaluatedFlag<T> {
    const definition = this.byKey.get(key);
    if (!definition) throw new Error(`FlagsClient: unknown flag key "${key}"`);

    const ctx = context ?? this.context;
    const ancestors = collectAncestors(key, this.byKey);
    const resolutionOrder = this.fullOrder.filter((k) => ancestors.has(k));
    resolutionOrder.push(key);

    const dependencies: Record<string, EvaluatedFlag<unknown>> = {};
    let result: EvaluatedFlag<T> | undefined;
    for (const currentKey of resolutionOrder) {
      const isRequested = currentKey === key;
      const evaluated = this.evaluateOne<unknown>(currentKey, ctx, dependencies, isRequested);
      dependencies[currentKey] = evaluated;
      if (isRequested) result = evaluated as EvaluatedFlag<T>;
    }

    return result!;
  }

  evaluateAll(context?: EvaluationContext): Record<string, EvaluatedFlag> {
    const ctx = context ?? this.context;
    const dependencies: Record<string, EvaluatedFlag<unknown>> = {};
    for (const key of this.fullOrder) {
      dependencies[key] = this.evaluateOne<unknown>(key, ctx, dependencies, true);
    }
    return dependencies as Record<string, EvaluatedFlag>;
  }

  onEvaluate(handler: OnEvaluateHandler): Unsubscribe {
    this.evaluateHandlers.add(handler);
    return () => this.evaluateHandlers.delete(handler);
  }

  subscribe(listener: ClientUpdateListener): Unsubscribe {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  /** Reserved seam for a future devtools package. No-op in this phase: the
   *  signature is locked so devtools can integrate later without a client
   *  rewrite, but calling it does not change any evaluate() output yet. */
  setOverrides(overrides: Record<string, FlagOverride>): void {
    void overrides; // ponytail: intentional no-op, wired up when devtools lands
  }

  /** See setOverrides — reserved, no-op in this phase. */
  clearOverrides(keys?: string[]): void {
    void keys; // ponytail: intentional no-op, wired up when devtools lands
  }

  dispose(): void {
    this.disposed = true;
    this.providerUnsubscribe?.();
    this.providerUnsubscribe = undefined;
    this.evaluateHandlers.clear();
    this.updateListeners.clear();
  }

  // ---- internals ----

  private evaluateOne<T>(
    key: string,
    context: EvaluationContext,
    dependencies: Record<string, EvaluatedFlag<unknown>>,
    isRequested: boolean,
  ): EvaluatedFlag<T> {
    const definition = this.byKey.get(key) as FlagDefinition<T>;
    const entry = this.cache.get(key);
    const result = resolveFlag<T>(definition, entry, context, dependencies);

    if (isRequested && definition.emitsExposure) {
      for (const handler of this.evaluateHandlers) {
        handler(result as EvaluatedFlag, definition as FlagDefinition<unknown>);
      }
    }

    return result;
  }

  private onProviderPush(states: FlagRemoteState[]): void {
    if (this.disposed) return;
    if (!Array.isArray(states)) return;

    const changedKeys: string[] = [];
    for (const state of states) {
      if (!state || typeof state.key !== "string") continue;
      this.cache.set(state.key, { remoteState: state, fetchedAt: this.now(), lastError: undefined });
      changedKeys.push(state.key);
    }

    if (changedKeys.length > 0) this.notifySubscribers(changedKeys);
  }

  private notifySubscribers(keys: string[]): void {
    if (this.disposed) return;
    for (const listener of this.updateListeners) listener(keys);
  }
}

function resolveFlag<T>(
  definition: FlagDefinition<T>,
  entry: FlagStateEntry | undefined,
  context: EvaluationContext,
  dependencies: Record<string, EvaluatedFlag<unknown>>,
): EvaluatedFlag<T> {
  // evaluate()'s public signature takes Record<string, EvaluatedFlag> (bare,
  // default T=boolean) — dependsOn parents are only ever read via truthy
  // `.value` regardless of their own T, so this widen is safe.
  const deps = dependencies as Record<string, EvaluatedFlag>;
  const hasCachedState = entry?.fetchedAt !== undefined;
  const lastAttemptFailed = entry?.lastError !== undefined;

  if (!hasCachedState && lastAttemptFailed) {
    if (definition.failureMode === "open" && definition.valueType === "boolean") {
      return { key: definition.key, value: true as T, reason: "fallbackError", stale: true };
    }
    const result = evaluate<T>(definition, undefined, context, deps);
    return result.reason === "default" ? { ...result, reason: "fallbackError", stale: true } : { ...result, stale: true };
  }

  if (hasCachedState && lastAttemptFailed) {
    if (definition.failureMode === "lastKnown") {
      return { ...evaluate<T>(definition, entry.remoteState, context, deps), stale: true };
    }
    return evaluate<T>(definition, undefined, context, deps);
  }

  return evaluate<T>(definition, entry?.remoteState, context, deps);
}
