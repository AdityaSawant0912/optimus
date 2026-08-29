import { useCallback, useRef, useSyncExternalStore } from "react";
import type { EvaluatedFlag, EvaluationContext } from "@optimus/core";
import { useFlagsContext } from "./context";

function evaluatedFlagsEqual<T>(a: EvaluatedFlag<T>, b: EvaluatedFlag<T>): boolean {
  return (
    a.key === b.key &&
    Object.is(a.value, b.value) &&
    a.variantKey === b.variantKey &&
    a.reason === b.reason &&
    a.ruleMatched === b.ruleMatched &&
    a.stale === b.stale
  );
}

export function useFlag<T = boolean>(key: string, context?: EvaluationContext): EvaluatedFlag<T> {
  const ctxValue = useFlagsContext();
  const cacheRef = useRef<EvaluatedFlag<T> | undefined>(undefined);

  const getSnapshot = (): EvaluatedFlag<T> => {
    if (ctxValue.mode === "snapshot") {
      const flag = ctxValue.snapshot[key] as EvaluatedFlag<T> | undefined;
      if (flag === undefined) {
        throw new Error(`useFlag: key "${key}" is not present in the hydrated snapshot`);
      }
      return flag;
    }

    // client.evaluate() is a pure sync read that returns a fresh object
    // every call — useSyncExternalStore requires a referentially stable
    // return value when nothing changed, so cache+compare by field.
    const next = ctxValue.client.evaluate<T>(key, context);
    const prev = cacheRef.current;
    if (prev && evaluatedFlagsEqual(prev, next)) return prev;
    cacheRef.current = next;
    return next;
  };

  // Depends on the whole ctxValue (not just `key`) so a snapshot->live mode
  // flip — which produces a new ctxValue identity — re-subscribes exactly
  // once; a narrower dependency list would permanently miss that transition.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (ctxValue.mode === "snapshot") return () => {};
      return ctxValue.client.subscribe((changedKeys) => {
        if (changedKeys.includes(key)) onStoreChange();
      });
    },
    [ctxValue, key],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
