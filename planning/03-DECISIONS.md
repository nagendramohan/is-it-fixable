# Decisions Log

## D1 — Language: TypeScript (Node)  [decided 2026-08-18]
Priority set by user: "language should be awesome so ANYONE can contribute."
- TS has the largest contributor pool → lowest barrier to contribution.
- GitHub tooling is TS-first: official `@octokit/graphql` / `@octokit/rest` → less fragile custom code.
- Zero-friction distribution: `npx <name>`, `npm i -g`. Runs anywhere Node runs.
- Available & modern in this env: Node 24 / npm 11.
- Tradeoff accepted: Rust would give a single static binary + crates.io cred, but a smaller
  contributor pool and higher barrier — contradicts the accessibility priority. Rust = possible future port.

## D2 — Toolchain (best practices, contributor-friendly)
- Runtime/target: Node LTS (engines: >=18). TS strict mode, `"noUncheckedIndexedAccess"`.
- Package manager: npm (most universal). Lockfile committed.
- Build: `tsup` (esbuild) → ESM + CJS + `.d.ts`, plus a `bin` shim for the CLI.
- Test: `vitest` (fast, TS-native, great DX) with coverage.
- Lint/format: `biome` (single fast tool, one config) OR eslint+prettier. LEAN: `biome` (less config, friendlier for new contributors).
- CLI parsing: `commander` (ubiquitous, well-documented) or `cac` (tiny). LEAN: `commander`.
- GitHub API: `@octokit/graphql` (+ `@octokit/rest` if needed).
- CI: GitHub Actions — build + test + lint on Node 18/20/22 matrix.
- Conventional Commits + a CHANGELOG. CONTRIBUTING.md + CODE_OF_CONDUCT.md (accessibility).

## D3 — License: Apache-2.0  [decided 2026-08-18]
User chose Apache-2.0 (permissive + explicit patent grant). No action needed to adopt — just add
`LICENSE` (full Apache-2.0 text) + `NOTICE` + SPDX headers. package.json `"license": "Apache-2.0"`.

## D4 — Name: `is-it-fixable`  [decided 2026-08-18]
Verified AVAILABLE on npm (registry returned 404) on 2026-08-18. CLI bin name: `is-it-fixable`
(consider short alias `iif` as a secondary bin). GitHub repo: `is-it-fixable` (user creates).

## D5 — v1 scope boundary
Reproduce-on-HEAD DEFERRED to v2 (confirmed direction). v1 = GitHub-metadata heuristics + build-system detection.

## Open confirmations needed from user
- License (D3): MIT or Apache-2.0?
- Name (D4): pick after availability check.

## D6 — Known dev-only audit note [2026-08-18]
`npm audit` reports esbuild advisories (moderate/high) transitively via vite/vitest/tsup. These affect
only esbuild's DEV SERVER, which we never run; the published package (`dist/`) bundles no esbuild, so
end users are unaffected. Not fixing via `--force` (would breaking-bump vitest→v4). Revisit vitest v4 later.
