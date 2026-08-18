# Fixability Rubric (the moat — grill this hardest)

Goal: for each OPEN issue, emit a **verdict**, a **score (0–100)**, and an **evidence** list.
Deterministic + explainable in v1 (no LLM). Every signal must cite the API data that produced it.

## Verdicts (priority order — first match wins for the headline)
1. `TAKEN`       — an open (non-draft) linked PR exists.
2. `NOT-THIS-REPO` — strong signal the root cause is upstream/inherent (v1: heuristic, low-confidence; may fold into evidence only).
3. `CONTENTIOUS` — closed-unmerged PR(s), and/or downgrade labels, and/or reopened-after-PR, and/or maintainer "won't fix / by design".
4. `STALE`       — old, no maintainer engagement, repo shows low external-PR merge activity.
5. `STARTED`     — draft PR or linked branch, no open non-draft PR.
6. `CLEAN`       — none of the above; looks genuinely available and fixable.

## Signals → score deltas (start 50, clamp 0–100; higher = more fixable)
| Signal | Source (GraphQL/REST) | Effect |
|---|---|---|
| Open non-draft linked PR | timeline CROSS_REFERENCED/CONNECTED, PR.state=OPEN, !isDraft | verdict TAKEN, score→low |
| Draft PR / linked branch | timeline / linkedBranches | verdict STARTED, −20 |
| Closed-unmerged PR referencing issue | timeline, PR.state=CLOSED && !merged | −25, evidence "prior attempt failed/rejected" |
| Merged PR referencing issue but issue still open | timeline, PR.merged | flag "maybe already fixed — verify on HEAD" (−15, note) |
| Downgrade label (`wontfix`,`by-design`,`needs-discussion`,`question`,`invalid`,`blocked`) | labels | −20 each (cap) |
| Positive label (`good first issue`,`help wanted`,`bug`,`E-help-wanted`) | labels | +15 (`help wanted`/`E-help-wanted` strong +) |
| Reopened after a PR closed | timeline REOPENED after CLOSED PR | −15, "maintainer-staged" |
| Last maintainer comment negative phrase | comments (author assoc OWNER/MEMBER/COLLABORATOR) + phrase list | −25 |
| No maintainer engagement ever | comments author associations | −10 |
| Staleness (age of last activity) | updatedAt | graduated −0..−15 |
| Repo merges external PRs (recent) | repo recent PRs merged from non-members | +10 if healthy, −10 if none |
| Reactions / +1 volume | reactions | tiny +; popularity ≠ fixability (guard against overweighting) |

Maintainer negative-phrase seed list (case-insensitive, word-boundary):
`won't fix`, `wontfix`, `by design`, `working as intended`, `not a bug`, `not planning`,
`won't be`, `out of scope`, `use instead`, `closing as`, `not something we`.
(Phrase heuristic is INTENTIONALLY conservative; false-negative-biased. Documented as heuristic.)

## Author association (trust who said it)
Treat `OWNER`/`MEMBER`/`COLLABORATOR` as maintainer voice; `CONTRIBUTOR`/`NONE` as reporter/community.
This is how we distinguish "a maintainer said won't-fix" (strong) from "a random user argued" (weak).

## Known-Answer Set (accuracy fixtures — the credibility gate)
Captured API snapshots → expected verdict. These are REAL issues we hand-graded:
| Issue | Expected | Why |
|---|---|---|
| apache/commons-lang LANG-1484 (via GH PR #455) | CONTENTIOUS | closed-unmerged PR, 6y open, conflicting tests |
| smithy-lang/smithy #3119 | CONTENTIOUS | reopened after 2 closed PRs, maintainer staging |
| toml-rs/toml #1120 | CONTENTIOUS | maintainer "likely won't fix" + 2 closed PRs |
| FasterXML/jackson-databind #6136 | TAKEN | open PR #6134 |
| graphql-java/graphql-java #4433 | TAKEN | open PR #4435 |
| toml-rs/toml #1128 | (verify) already-fixed note | passed on main (needs HEAD repro → v2; v1 may mark CLEAN + caveat) |
| a genuinely open unclaimed bug (TBD pick) | CLEAN | control case |

Fixtures = saved JSON responses so tests are offline/deterministic (no live API in CI).

## Open grill questions (resolve before/while coding)
- Q1: Should `NOT-THIS-REPO` be a verdict in v1 or just evidence? (Lean: evidence-only in v1 — hard to detect reliably from metadata.)
- Q2: Scoring — additive deltas vs. weighted tiers? (Lean: additive + clamps, simplest to explain/test.)
- Q3: How to fetch "repo merges external PRs" cheaply without blowing rate limits? (Lean: 1 GraphQL query, last N merged PRs, authorAssociation.)
- Q4: Merged-PR-but-issue-open → is it "already fixed" or "partial"? v1: flag + recommend HEAD verify (can't confirm without v2 repro).
- Q5: Phrase heuristic false positives (e.g. "this is not a bug, it's a feature request we'll take") — keep conservative; require phrase in a MAINTAINER comment only.
