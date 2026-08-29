import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import type { EvaluationContext, FlagsClient } from "@feature-flags/core";
import { hydrateSnapshot } from "@feature-flags/node";
import type { SerializedSnapshot } from "@feature-flags/node";
import { FlagsContext, type FlagsContextValue } from "./context";
import { evaluationContextsEqual } from "./equality";

export interface FlagProviderProps {
  /**
   * Caller-owned. FlagProvider never calls init() or dispose() on this —
   * React StrictMode double-invokes effects in dev (mount->cleanup->mount),
   * so a dispose-on-unmount here would break the second mount's use of the
   * same client. A client is typically one-per-app (or one-per-SSR-request,
   * constructed outside React), not scoped to one subtree's lifecycle.
   */
  client: FlagsClient;
  snapshot?: SerializedSnapshot;
  context?: EvaluationContext;
  children: ReactNode;
}

export function FlagProvider({ client, snapshot, context, children }: FlagProviderProps): ReactElement {
  const [mode, setMode] = useState<"snapshot" | "live">(() => (snapshot ? "snapshot" : "live"));
  const [hydrated] = useState(() => (snapshot ? hydrateSnapshot(snapshot) : undefined));

  // Seeded with the mount-time value so the first effect run is a no-op —
  // only a *later* render's different context counts as an explicit change.
  const prevContextRef = useRef(context);

  useEffect(() => {
    if (context === undefined) return;
    if (!evaluationContextsEqual(prevContextRef.current, context)) {
      client.setContext(context);
      setMode("live");
    }
    prevContextRef.current = context;
  }, [client, context]);

  const value = useMemo<FlagsContextValue>(
    () =>
      mode === "snapshot" && hydrated ? { mode: "snapshot", client, snapshot: hydrated } : { mode: "live", client },
    [mode, client, hydrated],
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}
