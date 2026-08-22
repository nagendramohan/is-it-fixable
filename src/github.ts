// SPDX-License-Identifier: Apache-2.0
// GitHub data layer: fetch issues via GraphQL and normalize them into IssueSnapshot.
// The raw-API -> IssueSnapshot mapping (`mapIssueNode`) is a pure function so it is unit-testable
// against saved fixtures without any network access.

import { graphql } from "@octokit/graphql";
import type { RecentPr } from "./repo-health.js";
import type {
  AuthorAssociation,
  IssueComment,
  IssueSnapshot,
  LinkedPullRequest,
  PullRequestState,
} from "./types.js";

/** Shape of the pieces of the GraphQL response we consume. Kept minimal + explicit. */
export interface RawIssueNode {
  number: number;
  title: string;
  url: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  body?: string | null;
  reactions?: { totalCount?: number } | null;
  labels?: { nodes?: Array<{ name: string } | null> | null } | null;
  comments?: {
    nodes?: Array<{
      body?: string | null;
      createdAt?: string | null;
      authorAssociation?: string | null;
    } | null> | null;
  } | null;
  linkedBranches?: { totalCount?: number } | null;
  timelineItems?: {
    nodes?: Array<RawTimelineNode | null> | null;
  } | null;
}

interface RawPullRequestRef {
  __typename?: string;
  number?: number;
  isDraft?: boolean;
  state?: string; // OPEN | CLOSED | MERGED
  merged?: boolean;
}

interface RawTimelineNode {
  __typename?: string;
  // CrossReferencedEvent -> the PR is the `source`
  source?: RawPullRequestRef | null;
  // ConnectedEvent / DisconnectedEvent -> the PR is the `subject`
  subject?: RawPullRequestRef | null;
  // ReopenedEvent has no PR; we only need to know it happened
  createdAt?: string | null;
}

const KNOWN_ASSOCIATIONS: ReadonlySet<string> = new Set<AuthorAssociation>([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
  "CONTRIBUTOR",
  "FIRST_TIME_CONTRIBUTOR",
  "FIRST_TIMER",
  "NONE",
]);

function normalizeAssociation(raw: string | null | undefined): AuthorAssociation {
  if (raw && KNOWN_ASSOCIATIONS.has(raw)) return raw as AuthorAssociation;
  return "NONE";
}

function normalizePrState(ref: RawPullRequestRef): PullRequestState {
  if (ref.merged || ref.state === "MERGED") return "MERGED";
  if (ref.state === "CLOSED") return "CLOSED";
  return "OPEN";
}

function isPullRequest(ref: RawPullRequestRef | null | undefined): ref is RawPullRequestRef {
  return Boolean(ref && ref.__typename === "PullRequest" && typeof ref.number === "number");
}

/**
 * Pure mapping from a raw GraphQL issue node to a normalized IssueSnapshot.
 * Exported for fixture-based unit tests.
 */
export function mapIssueNode(owner: string, repo: string, node: RawIssueNode): IssueSnapshot {
  const labels = (node.labels?.nodes ?? [])
    .filter((l): l is { name: string } => Boolean(l?.name))
    .map((l) => l.name);

  const comments: IssueComment[] = (node.comments?.nodes ?? [])
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      authorAssociation: normalizeAssociation(c.authorAssociation),
      body: c.body ?? "",
      createdAt: c.createdAt ?? "",
    }));

  const linkedPullRequests: LinkedPullRequest[] = [];
  let reopenedAfterClose = false;
  const seenPr = new Set<number>();

  for (const item of node.timelineItems?.nodes ?? []) {
    if (!item) continue;
    if (item.__typename === "ReopenedEvent") {
      reopenedAfterClose = true;
      continue;
    }
    const isCrossRef = item.__typename === "CrossReferencedEvent";
    const ref = isCrossRef ? item.source : item.subject;
    if (isPullRequest(ref) && typeof ref.number === "number" && !seenPr.has(ref.number)) {
      seenPr.add(ref.number);
      linkedPullRequests.push({
        number: ref.number,
        state: normalizePrState(ref),
        isDraft: Boolean(ref.isDraft),
        linkType: isCrossRef ? "cross-referenced" : "connected",
      });
    }
  }

  return {
    owner,
    repo,
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state === "CLOSED" ? "CLOSED" : "OPEN",
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    body: node.body ?? "",
    labels,
    linkedPullRequests,
    linkedBranchCount: node.linkedBranches?.totalCount ?? 0,
    comments,
    reactionsCount: node.reactions?.totalCount ?? 0,
    reopenedAfterClose,
  };
}

const ISSUES_QUERY = `
query($owner: String!, $repo: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    issues(first: $first, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url state createdAt updatedAt body
        reactions { totalCount }
        labels(first: 20) { nodes { name } }
        comments(last: 20) { nodes { body createdAt authorAssociation } }
        linkedBranches(first: 1) { totalCount }
        timelineItems(first: 30, itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT, REOPENED_EVENT]) {
          nodes {
            __typename
            ... on CrossReferencedEvent { source { __typename ... on PullRequest { number isDraft state merged } } }
            ... on ConnectedEvent { subject { __typename ... on PullRequest { number isDraft state merged } } }
          }
        }
      }
    }
  }
}`;

export interface FetchOptions {
  token?: string | undefined;
  /** Max issues to fetch (paginates as needed). Default 30. */
  limit?: number;
}

/** Raised when GitHub returns a rate-limit error, with a friendly hint. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Fetch open issues for a repository and normalize them. Requires network + (ideally) a token.
 */
export async function fetchRepoIssues(
  owner: string,
  repo: string,
  options: FetchOptions = {},
): Promise<IssueSnapshot[]> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const limit = options.limit ?? 30;
  const client = graphql.defaults(token ? { headers: { authorization: `token ${token}` } } : {});

  const results: IssueSnapshot[] = [];
  let after: string | undefined;

  try {
    while (results.length < limit) {
      const pageSize = Math.min(50, limit - results.length);
      const data = await client<{
        repository: {
          issues: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: RawIssueNode[];
          };
        };
      }>(ISSUES_QUERY, { owner, repo, first: pageSize, after });

      const { nodes, pageInfo } = data.repository.issues;
      for (const node of nodes) results.push(mapIssueNode(owner, repo, node));
      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
      after = pageInfo.endCursor;
    }
  } catch (err) {
    throw translateError(err, Boolean(token));
  }

  return results.slice(0, limit);
}

const SINGLE_ISSUE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      number title url state createdAt updatedAt body
      reactions { totalCount }
      labels(first: 20) { nodes { name } }
      comments(last: 20) { nodes { body createdAt authorAssociation } }
      linkedBranches(first: 1) { totalCount }
      timelineItems(first: 30, itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT, REOPENED_EVENT]) {
        nodes {
          __typename
          ... on CrossReferencedEvent { source { __typename ... on PullRequest { number isDraft state merged } } }
          ... on ConnectedEvent { subject { __typename ... on PullRequest { number isDraft state merged } } }
        }
      }
    }
  }
}`;

/** Fetch and normalize a single issue by number. */
export async function fetchSingleIssue(
  owner: string,
  repo: string,
  number: number,
  options: FetchOptions = {},
): Promise<IssueSnapshot> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const client = graphql.defaults(token ? { headers: { authorization: `token ${token}` } } : {});
  try {
    const data = await client<{ repository: { issue: RawIssueNode | null } }>(SINGLE_ISSUE_QUERY, {
      owner,
      repo,
      number,
    });
    const issue = data.repository.issue;
    if (!issue) throw new Error(`Issue ${owner}/${repo}#${number} not found.`);
    return mapIssueNode(owner, repo, issue);
  } catch (err) {
    throw translateError(err, Boolean(token));
  }
}

function translateError(err: unknown, hasToken: boolean): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/rate limit|api rate/i.test(message)) {
    const hint = hasToken
      ? "GitHub API rate limit hit even with a token — wait for the reset and retry."
      : "GitHub API rate limit hit. Set GITHUB_TOKEN (or --token) to raise the limit to 5000/hr.";
    return new RateLimitError(hint);
  }
  if (/bad credentials|401/i.test(message)) {
    return new Error("GitHub rejected the token (bad credentials). Check GITHUB_TOKEN/--token.");
  }
  if (/could not resolve to a repository|not resolve to a Repository|404/i.test(message)) {
    return new Error("Repository not found (or private and the token lacks access).");
  }
  return err instanceof Error ? err : new Error(message);
}

export interface ResolvedRef {
  number: number;
  isPullRequest: boolean;
  state: PullRequestState;
  isDraft: boolean;
}

/**
 * Resolve a batch of issue/PR numbers to their type + state in a SINGLE GraphQL call, using
 * aliased `issueOrPullRequest` selections. Numbers that don't resolve to a PR are omitted.
 */
/**
 * Pure: read aliased `r{number}` fields from a GraphQL `repository` object into ResolvedRefs.
 * Tolerates missing/null aliases (e.g. numbers that don't exist, or resolved to an Issue not a PR).
 * Exported for tests.
 */
export function parseResolvedRefs(
  repository: Record<string, RawPullRequestRef | null> | null | undefined,
  numbers: readonly number[],
): ResolvedRef[] {
  const repo = repository ?? {};
  const out: ResolvedRef[] = [];
  for (const n of numbers) {
    const ref = repo[`r${n}`];
    if (ref && ref.__typename === "PullRequest") {
      out.push({
        number: n,
        isPullRequest: true,
        state: normalizePrState(ref),
        isDraft: Boolean(ref.isDraft),
      });
    }
  }
  return out;
}

export async function resolveReferences(
  owner: string,
  repo: string,
  numbers: readonly number[],
  options: FetchOptions = {},
): Promise<ResolvedRef[]> {
  if (numbers.length === 0) return [];
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const client = graphql.defaults(token ? { headers: { authorization: `token ${token}` } } : {});

  const aliases = numbers
    .map(
      (n) =>
        `r${n}: issueOrPullRequest(number: ${n}) { __typename ... on PullRequest { number isDraft state merged } }`,
    )
    .join("\n");
  const query = `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) {\n${aliases}\n} }`;

  try {
    const data = await client<{ repository: Record<string, RawPullRequestRef | null> }>(query, {
      owner,
      repo,
    });
    return parseResolvedRefs(data.repository, numbers);
  } catch (err) {
    // A reference to a non-existent number makes issueOrPullRequest emit a top-level GraphQL error,
    // but GitHub still returns the aliases that DID resolve in the error's partial `data`. Recover
    // those and ignore the "could not resolve" ones instead of failing the whole scan.
    const partial = (err as { data?: { repository?: Record<string, RawPullRequestRef | null> } })
      ?.data?.repository;
    if (partial) {
      return parseResolvedRefs(partial, numbers);
    }
    // No partial data (e.g. auth/rate-limit/network) — surface a friendly error.
    throw translateError(err, Boolean(token));
  }
}

const RECENT_PRS_QUERY = `
query($owner: String!, $repo: String!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: $first, states: [MERGED, CLOSED], orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes { number state merged createdAt mergedAt authorAssociation }
    }
  }
}`;

interface RawRecentPr {
  number: number;
  merged?: boolean | null;
  createdAt?: string | null;
  mergedAt?: string | null;
  authorAssociation?: string | null;
}

/** Pure: normalize a raw PR node into a RecentPr. Exported for tests. */
export function mapRecentPr(node: RawRecentPr): RecentPr {
  return {
    number: node.number,
    authorAssociation: normalizeAssociation(node.authorAssociation),
    merged: Boolean(node.merged),
    createdAt: node.createdAt ?? "",
    mergedAt: node.mergedAt ?? null,
  };
}

/** Fetch recent closed (merged or unmerged) PRs for repo-health assessment. */
export async function fetchRecentPullRequests(
  owner: string,
  repo: string,
  options: FetchOptions & { sample?: number } = {},
): Promise<RecentPr[]> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const first = Math.min(100, options.sample ?? 50);
  const client = graphql.defaults(token ? { headers: { authorization: `token ${token}` } } : {});
  try {
    const data = await client<{
      repository: { pullRequests: { nodes: RawRecentPr[] } };
    }>(RECENT_PRS_QUERY, { owner, repo, first });
    return data.repository.pullRequests.nodes.map(mapRecentPr);
  } catch (err) {
    throw translateError(err, Boolean(token));
  }
}

const REPO_TREE_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    defaultBranchRef {
      target { ... on Commit { tree { entries { name type } } } }
    }
  }
}`;

/** Fetch the top-level file/dir names of a repo's default branch (for build-system detection). */
export async function fetchRepoTopLevelFiles(
  owner: string,
  repo: string,
  options: FetchOptions = {},
): Promise<string[]> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const client = graphql.defaults(token ? { headers: { authorization: `token ${token}` } } : {});
  try {
    const data = await client<{
      repository: {
        defaultBranchRef: {
          target: { tree?: { entries?: Array<{ name: string; type: string }> } } | null;
        } | null;
      };
    }>(REPO_TREE_QUERY, { owner, repo });
    const entries = data.repository.defaultBranchRef?.target?.tree?.entries ?? [];
    return entries.map((e) => e.name);
  } catch (err) {
    throw translateError(err, Boolean(token));
  }
}

/** A raw item from the REST issue-search API (used for PR-referencing search). */
export interface RawSearchPrItem {
  number: number;
  state?: string | null; // "open" | "closed"
  draft?: boolean | null;
  pull_request?: { merged_at?: string | null } | null;
}

/**
 * Pure: map a REST search result item (a PR referencing the issue) to a LinkedPullRequest with
 * linkType "referenced". Returns null for non-PR items. Exported for tests.
 */
export function mapSearchPrItem(item: RawSearchPrItem): LinkedPullRequest | null {
  if (!item.pull_request) return null;
  const merged = Boolean(item.pull_request.merged_at);
  const state: PullRequestState = merged ? "MERGED" : item.state === "closed" ? "CLOSED" : "OPEN";
  return {
    number: item.number,
    state,
    isDraft: Boolean(item.draft),
    linkType: "referenced",
  };
}

/**
 * Find pull requests that REFERENCE an issue by searching for its number, catching fix PRs that the
 * issue timeline does not surface (the common real-world case). Uses the REST issue-search API.
 * Degrades gracefully (returns []) on search rate-limit or error so it never aborts a scan.
 */
export async function searchReferencingPullRequests(
  owner: string,
  repo: string,
  issueNumber: number,
  options: FetchOptions = {},
): Promise<LinkedPullRequest[]> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const q = encodeURIComponent(`repo:${owner}/${repo} ${issueNumber} type:pr`);
  const url = `https://api.github.com/search/issues?q=${q}&per_page=50`;
  const headers: Record<string, string> = {
    "user-agent": "is-it-fixable",
    accept: "application/vnd.github+json",
  };
  if (token) headers.authorization = `token ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return []; // rate-limited / error -> degrade to timeline signals only
    const data = (await res.json()) as { items?: RawSearchPrItem[] };
    const out: LinkedPullRequest[] = [];
    const seen = new Set<number>();
    for (const item of data.items ?? []) {
      // The search matches the number anywhere; exclude the issue itself.
      if (item.number === issueNumber) continue;
      const pr = mapSearchPrItem(item);
      if (pr && !seen.has(pr.number)) {
        seen.add(pr.number);
        out.push(pr);
      }
    }
    return out;
  } catch {
    return [];
  }
}
