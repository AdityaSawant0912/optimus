import { createContext, useContext } from "react";
import type { EvaluatedFlag, FlagsClient } from "@feature-flags/core";

export type FlagsContextValue =
  | { mode: "snapshot"; client: FlagsClient; snapshot: Record<string, EvaluatedFlag<unknown>> }
  | { mode: "live"; client: FlagsClient };

export const FlagsContext = createContext<FlagsContextValue | null>(null);

export function useFlagsContext(): FlagsContextValue {
  const ctx = useContext(FlagsContext);
  if (!ctx) throw new Error("useFlag/useVariant must be used within a <FlagProvider>");
  return ctx;
}
