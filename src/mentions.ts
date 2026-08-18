// SPDX-License-Identifier: Apache-2.0
// Extract prose references to other issues/PRs (e.g. "#1195", a pull/issues URL) from free text.
// These are candidates that may have NO structured CrossReferencedEvent, so the timeline-only
// detection misses them (see toml-rs/toml#1008 -> closed PR #1195, linked only in a comment).

export interface ExtractOptions {
  /** The current issue's own number, excluded from results (a self-reference is noise). */
  selfNumber: number;
  /** owner/repo the current issue belongs to; only same-repo URL references are collected. */
  owner: string;
  repo: string;
  /** Cap on distinct references returned, to bound downstream API cost. Default 10. */
  max?: number;
}

// "#123" not preceded by a word char (avoids "abc#123" fragments) and not a hex-ish color etc.
const HASH_REF = /(?<![\w`])#(\d{1,7})\b/g;
// Full GitHub pull/issue URLs, capturing owner/repo/number.
const URL_REF = /github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(?:pull|issues)\/(\d{1,7})\b/gi;

/**
 * Extract distinct candidate reference numbers from a set of text blobs.
 * Only same-repo references are returned (URL refs to other repos are ignored for v0.2).
 * Pure function — no I/O.
 */
export function extractReferences(texts: readonly string[], opts: ExtractOptions): number[] {
  const max = opts.max ?? 10;
  const found = new Set<number>();

  for (const raw of texts) {
    if (!raw) continue;

    for (const m of raw.matchAll(HASH_REF)) {
      const n = Number.parseInt(m[1] as string, 10);
      if (Number.isFinite(n) && n > 0 && n !== opts.selfNumber) found.add(n);
    }

    for (const m of raw.matchAll(URL_REF)) {
      const owner = (m[1] as string).toLowerCase();
      const repo = (m[2] as string).toLowerCase();
      const n = Number.parseInt(m[3] as string, 10);
      if (owner !== opts.owner.toLowerCase() || repo !== opts.repo.toLowerCase()) continue;
      if (Number.isFinite(n) && n > 0 && n !== opts.selfNumber) found.add(n);
    }
  }

  return [...found].slice(0, max);
}
