import { useMemo, useState } from 'react';

/**
 * Deterministic demo of the library's real bucketing behavior:
 * hash(bucketingKey + ':' + flagKey [+ ':' + seed]) -> stable bucket.
 * Not a decorative animation — every id shown always lands in the same
 * bucket for a given seed, same as the actual engine.
 */

const BUCKETS = [
  { key: 'control', label: 'control', color: 'var(--color-signal-rose)' },
  { key: 'variant-a', label: 'variant A', color: 'var(--color-signal-amber)' },
  { key: 'variant-b', label: 'variant B', color: 'var(--color-signal-teal)' },
] as const;

const SAMPLE_IDS = [
  'user_18a2',
  'user_92fe',
  'user_3d01',
  'user_c710',
  'user_5b88',
  'user_e04c',
  'user_a771',
  'user_f923',
];

// Simple deterministic string hash (FNV-1a) — same shape as a real bucketing
// hash, good enough for a client-side demo without shipping a crypto lib.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function bucketFor(id: string, flagKey: string, seed: string): number {
  const composed = `${id}:${flagKey}${seed ? ':' + seed : ''}`;
  return hash(composed) % BUCKETS.length;
}

export default function BucketDemo() {
  const [seed, setSeed] = useState('v1');
  const flagKey = 'checkout-redesign';

  const assignments = useMemo(
    () => SAMPLE_IDS.map((id) => ({ id, bucket: bucketFor(id, flagKey, seed) })),
    [seed],
  );

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-5 font-mono text-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[var(--color-muted)]">
          evaluate(<span className="text-[var(--color-paper)]">'{flagKey}'</span>, ctx)
        </span>
        <button
          type="button"
          onClick={() => setSeed(seed === 'v1' ? 'v2' : 'v1')}
          className="rounded border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-signal-indigo)] hover:text-[var(--color-paper)]"
        >
          reseed rollout →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {BUCKETS.map((b) => (
          <div key={b.key} className="rounded border border-[var(--color-line)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: b.color }}
                aria-hidden
              />
              <span className="text-xs text-[var(--color-muted)]">{b.label}</span>
            </div>
            <ul className="space-y-1">
              {assignments
                .filter((a) => BUCKETS[a.bucket].key === b.key)
                .map((a) => (
                  <li key={a.id} className="text-[11px] text-[var(--color-paper)]/80">
                    {a.id}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-muted)]">
        Same id, same seed, same bucket — every time, across every server.
        Reseeding remaps the whole rollout deterministically; nothing here is
        random per-request.
      </p>
    </div>
  );
}
