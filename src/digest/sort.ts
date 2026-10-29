import type { DigestRow } from './types.js';

export function sortDigestRows(rows: DigestRow[]): DigestRow[] {
  return [...rows].sort((a, b) => a.job.localeCompare(b.job));
}
