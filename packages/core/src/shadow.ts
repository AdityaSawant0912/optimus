export interface ShadowResult<T> {
  old: T;
  /** undefined only when newImpl threw/rejected. */
  new: T | undefined;
  /** false whenever newImpl threw/rejected. */
  matched: boolean;
  error: unknown | undefined;
}

export type ShadowResultHandler<T> = (result: ShadowResult<T>) => void;

/**
 * Structural deep-equal for typical JSON-shaped values (primitives, plain
 * objects, arrays) — not a general-purpose equality library. Map/Set/Date/
 * class-instance identity are deliberately out of scope.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    return a.length === b.length && a.every((value, i) => deepEqual(value, b[i]));
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bRecord, key) && deepEqual(aRecord[key], bRecord[key]),
  );
}

function reportResult<T>(onResult: ShadowResultHandler<T>, result: ShadowResult<T>): void {
  try {
    onResult(result);
  } catch {
    // shadow-mode machinery must be fully inert to the caller, including
    // against a broken logging callback.
  }
}

/**
 * Runs `newImpl` alongside `oldImpl` purely for comparison, always
 * returning `oldImpl`'s result. `oldImpl`'s exception is never caught — the
 * real production path must never be masked by shadow-mode plumbing.
 * `newImpl`'s exception is caught and reported via `onResult`, never
 * propagated to the caller.
 */
export function runShadow<T>(oldImpl: () => T, newImpl: () => T, onResult: ShadowResultHandler<T>): T {
  const old = oldImpl();

  let newValue: T | undefined;
  let error: unknown;
  let matched = false;
  try {
    newValue = newImpl();
    matched = deepEqual(old, newValue);
  } catch (err) {
    error = err;
  }

  reportResult(onResult, { old, new: newValue, matched, error });
  return old;
}

/** Async twin of runShadow — see its doc for the exact semantics. */
export async function runShadowAsync<T>(
  oldImpl: () => T | Promise<T>,
  newImpl: () => T | Promise<T>,
  onResult: ShadowResultHandler<T>,
): Promise<T> {
  const old = await oldImpl();

  let newValue: T | undefined;
  let error: unknown;
  let matched = false;
  try {
    newValue = await newImpl();
    matched = deepEqual(old, newValue);
  } catch (err) {
    error = err;
  }

  reportResult(onResult, { old, new: newValue, matched, error });
  return old;
}
