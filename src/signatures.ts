// SPDX-License-Identifier: Apache-2.0
// Error-signature extraction.
//
// Claim detection by issue *number* (v0.4) misses a whole class of "don't work on this": a bug can
// already be known/claimed/attempted under a DIFFERENT issue number. The delta #2221 case looked
// unclaimed by number, but its panic ("String mismatch encountered while superimposing style
// sections") was a long-standing problem tracked under #1172/#1360/#1448 with an existing PR.
//
// This module pulls stable, searchable error signatures out of an issue's title+body (panic
// messages, exception/error types, assertion strings, "file.ext:LINE" locations). Callers can then
// search for OTHER issues/PRs carrying the same signature to flag a likely-duplicate / known-hard
// problem before any work is invested. Pure — no I/O.

/** A distinctive error string pulled from issue text, plus how we classified it. */
export interface ErrorSignature {
  /** The searchable signature text (already trimmed/cleaned). */
  text: string;
  kind: "panic" | "exception" | "assertion" | "error-message" | "source-location";
  /** Rough confidence that this uniquely identifies the bug (higher = more distinctive). */
  weight: number;
}

const MAX_SIG_LEN = 120;
const MIN_SIG_LEN = 12;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, MAX_SIG_LEN).trim();
}

/**
 * Rust panic messages: `thread 'main' panicked at src/paint.rs:898:17:\n<MESSAGE>` (2021+ format)
 * or `panicked at 'MESSAGE', src/x.rs:1:2` (older format).
 */
function extractRustPanics(text: string, out: ErrorSignature[]): void {
  // New format: message on the line after the location.
  const newFmt = /panicked at [^\n:]+:\d+(?::\d+)?:\s*\n\s*([^\n]{6,})/g;
  for (const m of text.matchAll(newFmt)) {
    const msg = clean(m[1] as string);
    if (msg.length >= MIN_SIG_LEN) out.push({ text: msg, kind: "panic", weight: 5 });
  }
  // Old format: message in quotes before the location.
  const oldFmt = /panicked at ['"]([^'"\n]{6,})['"]/g;
  for (const m of text.matchAll(oldFmt)) {
    const msg = clean(m[1] as string);
    if (msg.length >= MIN_SIG_LEN) out.push({ text: msg, kind: "panic", weight: 5 });
  }
}

/** Python/JVM style exceptions: `SomeError: message` or a bare `FooException`. */
function extractExceptions(text: string, out: ErrorSignature[]): void {
  const re = /\b([A-Z][A-Za-z0-9_]*(?:Error|Exception|Warning|Panic))\b(?:\s*:\s*([^\n]{4,}))?/g;
  for (const m of text.matchAll(re)) {
    const type = m[1] as string;
    const detail = m[2] ? clean(m[2]) : "";
    const sig = detail ? clean(`${type}: ${detail}`) : type;
    if (sig.length >= MIN_SIG_LEN || (!detail && type.length >= 8)) {
      out.push({ text: sig, kind: "exception", weight: detail ? 4 : 2 });
    }
  }
}

/** C/C++/Rust assertions and hard aborts. */
function extractAssertions(text: string, out: ErrorSignature[]): void {
  const re =
    /\b(?:assertion (?:failed|`[^`]+` failed)|Assertion `[^`]+' failed|attempt to (?:add|subtract|multiply) with overflow|index out of bounds[^\n]*)/gi;
  for (const m of text.matchAll(re)) {
    const sig = clean(m[0] as string);
    if (sig.length >= MIN_SIG_LEN) out.push({ text: sig, kind: "assertion", weight: 4 });
  }
}

/** Source locations like `src/paint.rs:898` — distinctive when the bug is code-pinned. */
function extractSourceLocations(text: string, out: ErrorSignature[]): void {
  const re = /\b((?:[\w./-]+\/)?[\w.-]+\.(?:rs|c|cc|cpp|h|hpp|py|ts|js|go|java|rb)):(\d+)\b/g;
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    const loc = `${m[1]}:${m[2]}`;
    if (!seen.has(loc)) {
      seen.add(loc);
      out.push({ text: loc, kind: "source-location", weight: 3 });
    }
  }
}

/**
 * Extract distinctive error signatures from an issue's title and body, most-distinctive first,
 * de-duplicated. Returns [] when nothing error-like is found (e.g. a feature request).
 */
export function extractErrorSignatures(title: string, body = ""): ErrorSignature[] {
  const text = `${title}\n${body}`;
  const out: ErrorSignature[] = [];
  extractRustPanics(text, out);
  extractAssertions(text, out);
  extractExceptions(text, out);
  extractSourceLocations(text, out);

  // De-dupe by lowercased text, keeping the highest weight.
  const byText = new Map<string, ErrorSignature>();
  for (const sig of out) {
    const key = sig.text.toLowerCase();
    const existing = byText.get(key);
    if (!existing || sig.weight > existing.weight) byText.set(key, sig);
  }
  return [...byText.values()].sort((a, b) => b.weight - a.weight);
}

/**
 * Build a GitHub issue-search query string that looks for OTHER issues/PRs in the same repo
 * carrying the given signature. The caller runs the search; excluding the current issue number is
 * the caller's job. Quotes multi-word signatures for an exact-phrase match.
 */
export function signatureSearchQuery(owner: string, repo: string, sig: ErrorSignature): string {
  const phrase = /\s/.test(sig.text) ? `"${sig.text}"` : sig.text;
  return `repo:${owner}/${repo} ${phrase}`;
}
