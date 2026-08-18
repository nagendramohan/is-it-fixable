// SPDX-License-Identifier: Apache-2.0
// Parse a CLI target into a repo (owner/repo) or a specific issue reference.

export interface RepoTarget {
  kind: "repo";
  owner: string;
  repo: string;
}

export interface IssueTarget {
  kind: "issue";
  owner: string;
  repo: string;
  number: number;
}

export type Target = RepoTarget | IssueTarget;

const REPO_RE = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;
const ISSUE_URL_RE = /github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/issues\/(\d+)/i;

/**
 * Parse a target string. Accepts:
 *   - "owner/repo"
 *   - "https://github.com/owner/repo/issues/123"
 *   - "owner/repo#123"
 * Throws a descriptive error on anything else.
 */
export function parseTarget(input: string): Target {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(ISSUE_URL_RE);
  if (urlMatch) {
    return {
      kind: "issue",
      owner: urlMatch[1] as string,
      repo: urlMatch[2] as string,
      number: Number.parseInt(urlMatch[3] as string, 10),
    };
  }

  const hashMatch = trimmed.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)#(\d+)$/);
  if (hashMatch) {
    return {
      kind: "issue",
      owner: hashMatch[1] as string,
      repo: hashMatch[2] as string,
      number: Number.parseInt(hashMatch[3] as string, 10),
    };
  }

  const repoMatch = trimmed.match(REPO_RE);
  if (repoMatch) {
    return { kind: "repo", owner: repoMatch[1] as string, repo: repoMatch[2] as string };
  }

  throw new Error(
    `Could not parse target "${input}". Use "owner/repo", "owner/repo#123", or a GitHub issue URL.`,
  );
}
