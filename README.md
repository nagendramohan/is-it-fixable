# is-it-fixable

> Is this GitHub issue actually **fixable and worth your time** — or a trap?

Most "find an issue" tools tell you whether an issue is *claimed*. `is-it-fixable` answers the harder
question every contributor actually cares about: **should I pick this one?** It scores each open issue
and shows you the **evidence** behind the verdict — so you don't fork a repo, set up its toolchain, and
read the code only to discover the bug was already fixed, the PR already exists, or a maintainer
already said "won't fix."

[![CI](https://github.com/nagendramohan/is-it-fixable/actions/workflows/ci.yml/badge.svg)](https://github.com/nagendramohan/is-it-fixable/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/is-it-fixable.svg)](https://www.npmjs.com/package/is-it-fixable)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

## Why

Existing discovery tools (goodfirstissue.dev, up-for-grabs, and even claim-checkers) stop at *"is
someone working on it?"*. They don't tell you an issue is a dead end because:

- a **closed, unmerged PR** already tried and got rejected,
- a **maintainer** commented *"won't fix" / "by design" / "out of scope"*,
- it was **reopened after a PR** as a staged/blocked change,
- it's tagged `wontfix` / `needs-discussion` / `duplicate`,
- or it may **already be fixed** on the default branch.

`is-it-fixable` scores all of that into a single verdict with transparent evidence.

## Install

```bash
npm install -g is-it-fixable
# or run without installing:
npx is-it-fixable <owner/repo>
```

## Usage

```bash
# Triage the open issues of a repo (most-fixable first)
is-it-fixable toml-rs/toml

# A single issue
is-it-fixable https://github.com/toml-rs/toml/issues/1120
is-it-fixable toml-rs/toml#1120

# Machine-readable output for scripts / CI
is-it-fixable apache/commons-lang --json

# Also report whether YOU can build it locally
is-it-fixable smithy-lang/smithy --build

# For a repo target, a merge-velocity signal is shown by default (disable with --no-repo-health)
is-it-fixable toml-rs/toml --no-repo-health

# Raise the GitHub rate limit (60/hr -> 5000/hr)
export GITHUB_TOKEN=ghp_xxx        # or: --token ghp_xxx
```

> **Tip:** a `GITHUB_TOKEN` is optional but strongly recommended — unauthenticated GitHub API calls are
> capped at 60/hr. Any classic token with default (public) scope works.

## Example

```text
is-it-fixable — example/mixed-repo
4 open issue(s) analyzed · 1 look CLEAN

🟢  CLEAN  (score 65/100)  #7 Typo in error message for invalid config key
    https://github.com/acme/widgets/issues/7
    • [+15] Contribution-friendly label(s): good first issue, bug.

🔴  TAKEN  (score 5/100)  #6136 @JsonFilter with serializeAllExcept() does not filter @JsonAnyGetter entries
    https://github.com/FasterXML/jackson-databind/issues/6136
    • [-45] Open PR #6134 is already linked (someone is fixing this).

🟠  CONTENTIOUS  (score 0/100)  #1120 Error highlight doesn't handle multi-byte characters correctly
    https://github.com/toml-rs/toml/issues/1120
    • [-25] Closed, unmerged PR(s) #1132, #1139 — a prior fix attempt was rejected or abandoned.
    • [-25] A maintainer comment signals this may not be fixed (e.g. won't-fix / by-design / out-of-scope).
```

## Verdicts

| Verdict | Meaning |
|---|---|
| 🟢 `CLEAN` | No claim/contention signals — genuinely available and worth a look. |
| 🟡 `STARTED` | A draft PR or linked branch exists — proceed carefully. |
| 🔴 `TAKEN` | An open (non-draft) PR is already linked. |
| 🟠 `CONTENTIOUS` | Closed-unmerged PR, downgrade label, reopened-after-PR, or a maintainer "won't fix". |
| ⚪ `STALE` | Long-idle with no maintainer engagement. |

Each verdict comes with a **0–100 score** and a list of **evidence** — every signal cites the data
that produced it, so nothing is a black box.

## Exit codes

- `0` — at least one `CLEAN` issue was found (there's something to pick).
- `1` — no `CLEAN` issue found.
- `2` — an error occurred (bad target, rate limit, auth, not found).

## How it works

`is-it-fixable` uses the GitHub GraphQL API to read each issue's timeline (cross-referenced &
connected PRs), labels, comments (with author association), reactions, linked branches, and
reopen history — then runs a **deterministic, explainable rubric** (no LLM). It also **searches for
pull requests that reference the issue** (`type:pr`), because many real fix PRs never generate a
timeline cross-reference — so an issue that already has an open fix PR is correctly reported `TAKEN`
rather than `CLEAN`. Maintainer sentiment is trusted only from `OWNER` / `MEMBER` / `COLLABORATOR`
comments, so a random user arguing "this is by design" doesn't downgrade an issue.

It also detects **prose-only PR references** — a PR mentioned merely in a comment or the issue body
(`#1195`, or a `…/pull/1195` URL) creates no structured timeline event, yet often marks a prior
rejected attempt. These are weighted more cautiously than structural links: a mentioned
*closed-unmerged* PR flags `CONTENTIOUS`, while a mentioned *open* PR is a moderate downgrade rather
than a hard `TAKEN`.

For a **repo** target it also reports a **merge-velocity signal** — how readily the repo merges
external (non-member) PRs (`HEALTHY` / `SLOW` / `LOW-EXTERNAL-MERGE` / `UNKNOWN`, with counts and
median time-to-merge). This is a *repo-level* signal only: it never changes a per-issue verdict, so a
genuinely `CLEAN` issue is never hidden just because its repo is slow — it just tells you whether
your effort is likely to be reviewed at all.

> Not affiliated with GitHub. `is-it-fixable` is a heuristic aid, not an oracle — always sanity-check
> before committing hours. "Already fixed on the default branch" detection (build + reproduce) is
> planned for a future release.

## Contributing

Contributions are very welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). The rubric lives in
[`src/rubric.ts`](./src/rubric.ts) and every signal is covered by tests, including an **accuracy gate**
of real, hand-graded issues.

## License

[Apache-2.0](./LICENSE) © Nagendra Mohan
