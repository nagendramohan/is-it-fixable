# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/nagendramohan/is-it-fixable/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nagendramohan/is-it-fixable/releases/tag/v0.1.0
