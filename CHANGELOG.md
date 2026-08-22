# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-08-22

### Fixed

- **Claim detection now finds PRs the issue timeline misses — the core "is it TAKEN?" fix.**
  Previously the tool only detected linked PRs via the issue's timeline cross-reference events.
  Many real fix PRs never produce such an event, so heavily-contested issues (that already had one
  or more open fix PRs) were reported `CLEAN`. `is-it-fixable` now also **searches for pull requests
  that reference the issue number** (`type:pr`) and folds them into the rubric: an open referencing
  PR ⇒ `TAKEN`, a closed-unmerged one ⇒ `CONTENTIOUS`.

### Added

- `--no-referencing-prs` to skip the PR search (it adds one search-API call per issue; GitHub's
  search API is rate-limited to ~30/min, and the check degrades gracefully to timeline-only signals
  if a search fails).
- A headline regression gate built from six real issues on which the old timeline-only detection
  falsely reported `CLEAN` (bat #3844, fd #2078, numbat #873, coreutils #13887/#13937/#13347) —
  each now correctly `TAKEN`.

## [0.3.1] - 2026-08-19

### Fixed

- Reference resolution no longer aborts a whole repo scan when a prose reference points to a
  non-existent number (e.g. a stray `#1035733` in a comment). GitHub returns a top-level GraphQL
  error for such a reference; we now recover the aliases that *did* resolve from the error's partial
  data, and per-issue enrichment degrades gracefully instead of failing the run.

## [0.3.0] - 2026-08-19

### Added

- **Repo merge-velocity / health signal.** For a repo target, `is-it-fixable` now reports how readily
  the repo merges **external** (non-member) pull requests — the count merged, the external merge
  ratio, and the median time-to-merge — as a repo-level verdict: `HEALTHY`, `SLOW`,
  `LOW-EXTERNAL-MERGE`, or `UNKNOWN`. This helps contributors avoid sinking effort into repos that
  rarely (or slowly) merge outside contributions. On by default for repo targets (one extra API
  call); disable with `--no-repo-health`.
- The signal is deliberately **repo-level only** — it never alters a per-issue verdict, so a genuinely
  `CLEAN` issue is never masked just because its repo is slow. The user weighs it themselves.
- Included in `--json` output under `repoHealth`.

## [0.2.0] - 2026-08-18

### Added

- **Prose PR-reference detection.** Issues that reference a PR only in prose — a comment or the
  issue body saying `#1195` or a `github.com/.../pull/1195` URL — produce no structured
  `CrossReferencedEvent`, so v0.1 (timeline-only) missed them and could report `CLEAN` for an issue
  that already had a rejected fix attempt. v0.2 scans the body + comments, resolves referenced
  numbers to their PR state in a single batched GraphQL call, and folds them into the rubric.
- Nuanced weighting for these weaker, prose-only links: a mentioned **closed-unmerged** PR flags
  `CONTENTIOUS` (a rejected attempt is still a rejected attempt), while a mentioned **open** PR is a
  moderate downgrade with evidence rather than a hard `TAKEN` (avoids false positives from casual
  mentions). Structural timeline links keep their original strength.
- Regression coverage from the real `toml-rs/toml#1008` case (closed PR `#1195` linked only in a
  comment) — now correctly classified `CONTENTIOUS`.

### Changed

- `IssueSnapshot` now carries the issue `body`; `LinkedPullRequest.linkType` gains `"mentioned"`.

## [0.1.0] - 2026-08-18

### Added

- Initial release of `is-it-fixable`.
- Fixability rubric engine: classifies an open GitHub issue as `TAKEN`, `CONTENTIOUS`,
  `STARTED`, `STALE`, or `CLEAN`, with a 0–100 score and per-signal evidence.
- Signals: open/draft/linked-branch PRs, closed-unmerged PRs, merged-PR-but-issue-open,
  downgrade/positive labels, reopened-after-close, maintainer-only negative sentiment, and staleness.
- GitHub GraphQL data layer with optional `GITHUB_TOKEN` and friendly rate-limit / auth / not-found errors.
- Build-system detection (Cargo, Gradle, Maven ±wrapper, npm, Python, Go).
- CLI accepting `owner/repo`, `owner/repo#123`, or an issue URL; `--json`, `--token`, `--limit`,
  `--build`; script-friendly exit codes.
- Accuracy gate: real hand-graded issues as fixtures, asserting the engine reproduces human verdicts.

### Deferred (planned)

- "Already fixed on the default branch" detection (clone + build + reproduce).
- GitHub Action packaging.

[Unreleased]: https://github.com/nagendramohan/is-it-fixable/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/nagendramohan/is-it-fixable/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/nagendramohan/is-it-fixable/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nagendramohan/is-it-fixable/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nagendramohan/is-it-fixable/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nagendramohan/is-it-fixable/releases/tag/v0.1.0
