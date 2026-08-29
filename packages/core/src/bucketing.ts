import { fnv1a } from "./hash";
import type { EvaluationContext } from "./types";

const BUCKET_RESOLUTION = 10000; // 0.01% resolution

/**
 * MurmurHash3 finalizer (fmix32), applied on top of the raw FNV-1a digest.
 * FNV-1a's single multiply-per-byte doesn't fully avalanche when two inputs
 * differ only in a trailing byte (e.g. hash inputs ending in "...:flag-a" vs
 * "...:flag-b") — without this, bucket assignments for different flag keys
 * came out correlated instead of independent. This finalizer is a cheap,
 * well-known fixup; it does not change fnv1a() itself or its test vectors.
 */
export function avalanche(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Default identity resolution chain (PLAN.md §5): first non-null wins.
 * `bucketingKey` (explicit) always takes precedence over the chain.
 */
export function resolveBucketingKey(context: EvaluationContext): string | undefined {
  return (
    context.bucketingKey ??
    context.userId ??
    context.deviceId ??
    context.sessionId ??
    context.anonymousId ??
    undefined
  );
}

/**
 * Mandatory internal salting (PLAN.md §5) — callers never construct this
 * hash input themselves.
 */
export function buildHashInput(bucketingKey: string, flagKey: string, seed?: string): string {
  return `${bucketingKey}:${flagKey}${seed ? ":" + seed : ""}`;
}

/** Returns a bucket value in [0, 10000). */
export function computeBucket(bucketingKey: string, flagKey: string, seed?: string): number {
  const hashInput = buildHashInput(bucketingKey, flagKey, seed);
  return avalanche(fnv1a(hashInput)) % BUCKET_RESOLUTION;
}

/** `percentage` is 0-100. */
export function isInRollout(bucketValue: number, percentage: number): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  return bucketValue < percentage * (BUCKET_RESOLUTION / 100);
}
