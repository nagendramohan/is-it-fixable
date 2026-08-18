# Project Plan — `is-it-fixable` (contributor fixability triage CLI)

> Name: **is-it-fixable** (npm-verified available 2026-08-18). License: **Apache-2.0**.

## One-line thesis
Existing tools answer **"is this issue *claimed*?"** (e.g. GitTrek).
This tool answers the harder, unmet question: **"is this issue actually *fixable and worth my time*?"** —
a scored, **evidence-backed** verdict per open issue.

## Why this is worth building (validated, not assumed)
- We manually "grilled" ~20 issues across ~15 repos over two sessions and repeatedly hit the same
  wasted-effort patterns. Those patterns ARE the product. See `01-PRIOR-ART.md` for the competitive gap.
- The claim-check layer is commoditized. The **fixability layer** (contentiousness, already-fixed,
  not-this-repo, buildability) is the novel moat.

## Target user
An open-source contributor (esp. newcomers) deciding **which issue to pick** so they don't waste hours
on something already fixed, already taken, contentious, or unbuildable in their environment.

## Language / stack decision (see 03-DECISIONS.md for full rationale)
- **TypeScript** (Node). Chosen for MAXIMUM contributor accessibility + GitHub-first tooling (`@octokit`).
- Distribution: npm (`npx <name>` / `npm i -g`). Optional single-binary later.

## Scope
### v1 (this goal) — GitHub-metadata fixability triage
- Tier 1 (claim): open/draft/linked-branch PR detection via GraphQL timeline.
- Tier 2 (fixability): closed-unmerged PR, downgrade labels, reopened-after-PR, maintainer-sentiment
  (phrase heuristic), staleness, repo-accepts-external-PRs signal.
- Tier 3 (light): detect repo build system (Cargo / Gradle / Maven-wrapper / npm) — "can you build it?"
- Output: per-issue **verdict** (`TAKEN` / `CONTENTIOUS` / `STALE` / `NOT-THIS-REPO` / `CLEAN`) +
  numeric score + **evidence list**. Pretty + `--json`.
- Auth: optional `GITHUB_TOKEN` (5000/hr); GraphQL to minimize calls; graceful rate-limit handling.

### Deferred to v2 (explicitly out of scope for v1)
- **Reproduce-on-HEAD** (clone + build + run the reporter's repro). Sexiest feature, biggest rabbit hole.
- GitHub Action packaging.
- Web UI (that's GitTrek's turf; we stay CLI).

## Success criteria (the "legendary" bar) — becomes the goal contract
1. CLI scaffolded; `npm run build` clean; lint + format clean; strict TS (no `any` escapes).
2. Fetches open issues for a repo via GraphQL with optional token; robust rate-limit handling.
3. Rubric engine → verdict + score + evidence; **unit-tested against mocked API fixtures**.
4. **Accuracy gate (the differentiator):** correctly classifies our KNOWN-ANSWER SET — the real issues
   we already hand-graded (see 02-RUBRIC.md §Known-Answer Set) — codified as tests.
5. Pretty + `--json` output; `--token`/`GITHUB_TOKEN`; exit codes usable in CI.
6. README with real example output; LICENSE (MIT or Apache-2.0 — TBD); CI (build+test+lint) green.
7. Everything green LOCALLY before any push. (User creates the GitHub repo; assistant cannot.)

## Identity / safety
- 100% personal identity: `Nagendra Mohan <nagendramohan1990@gmail.com>`, `github-personal` remote.
- Not related to Amazon work domain. Permissive OSS license.

## Non-goals (keep scope honest)
- Not a maintainer automation bot (stale-closing, auto-labeling) — that space is crowded.
- Not an AI/LLM classifier in v1 — deterministic, explainable heuristics first (auditable = trustworthy).
