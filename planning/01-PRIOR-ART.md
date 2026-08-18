# Prior Art & Competitive Gap

## Landscape (checked 2026-08-18)
| Tool | What it does | Ceiling / gap |
|---|---|---|
| **GitTrek** (gittrek.vercel.app, github.com/mahendra-shah/GitTrek) | Web app. Detects "ghost PRs" via GitHub GraphQL `CROSS_REFERENCED_EVENT` / `CONNECTED_EVENT` + `linkedBranches`. Verdicts: 🔴 Active PR / 🟡 draft / 🟡 branch / ✅ safe to claim. Also badge tracking (Pull Shark etc.). | **Stops at "is it claimed?"** Web-only, GitHub login for personalization. No fixability judgment. |
| goodfirstissue.dev, up-for-grabs.net, codetriage | Static lists / periodic scrapes of "good first issue" | No live claim status; no fixability. |
| stale-bot, "issue-triage" actions, duplicate detectors (ghidd, issue-detector) | **Maintainer-side** automation: labeling, stale-closing, dup detection (some LLM/embeddings) | Wrong audience — for repo owners, not contributors picking work. |
| gh-triage (k1LoW), gh CLI triage docs | Notification/queue management for maintainers | Not fixability. |

## The unmet question
Every tool answers **"is this issue claimed?"**. None answer **"is this issue fixable & worth my time?"**

## The fixability signals nobody checks (our moat) — each backed by a real case we hit
1. **Already fixed on `main`** — reporter's case no longer reproduces on HEAD.
   - Real hits: assertj #4263 (maintainer: "both tests succeed on main"), toml-rs #1128 (passed on main), gson #3047 (premise invalid).
2. **Contentious / maintainer-staged / wontfix**
   - LANG-1484: 6y-open, closed-unmerged PR, conflicting tests.
   - toml-rs #1120: maintainer "likely won't fix", 2 closed PRs.
   - smithy #3119: `needs-discussion`-adjacent, reopened after 2 closed PRs to stage a breaking change.
3. **Not this repo's bug** — root cause upstream / inherent.
   - json-schema-validator #1228: upstream Jackson.
   - toml-rs #1162: serde-inherent (`missing_field` only special-cases `deserialize_option`).
4. **Taken (claim-check — table stakes)** — jackson #6136/#6157/#6145/#1654/#1664/#1640 (same-day PRs), graphql-java #4433, COLLECTIONS-891.
5. **Buildable by YOU?** — scikit-learn couldn't build (Python 3.9.6). Environment fit is a real filter.

## Positioning
GitTrek says "🟢 safe to claim." We say **"🟢 safe AND likely-fixable — here's the evidence,"** or
**"🟡 CONTENTIOUS — closed-unmerged PR + `needs-discussion`,"** etc. A *fixability score with evidence*,
CLI-first, scriptable/CI-able. Different axis, different interface, complementary to GitTrek.
