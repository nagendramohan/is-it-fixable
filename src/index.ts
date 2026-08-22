// SPDX-License-Identifier: Apache-2.0
export type {
  AuthorAssociation,
  Evidence,
  FixabilityResult,
  IssueComment,
  IssueSnapshot,
  LinkedPullRequest,
  PullRequestState,
  Verdict,
} from "./types.js";
export {
  assessIssue,
  type AssessOptions,
  DOWNGRADE_LABELS,
  NEGATIVE_PHRASES,
  POSITIVE_LABELS,
} from "./rubric.js";
export {
  type FetchOptions,
  fetchRepoIssues,
  fetchRepoTopLevelFiles,
  fetchSingleIssue,
  mapIssueNode,
  type RawIssueNode,
  RateLimitError,
  type RawSearchPrItem,
  type ResolvedRef,
  parseResolvedRefs,
  mapSearchPrItem,
  mapSignatureMatches,
  type SignatureMatch,
  searchIssuesByText,
  resolveReferences,
  searchReferencingPullRequests,
} from "./github.js";
export { type ExtractOptions, extractReferences } from "./mentions.js";
export { parseTarget, type Target } from "./target.js";
export {
  assessRepoHealth,
  type RecentPr,
  type RepoHealth,
  type RepoHealthVerdict,
  repoHealthLine,
  isBotLogin,
} from "./repo-health.js";
export {
  extractErrorSignatures,
  signatureSearchQuery,
  type ErrorSignature,
} from "./signatures.js";
export {
  type BuildInfo,
  type BuildSystem,
  buildHint,
  detectBuildSystem,
} from "./build-system.js";
export {
  analyze,
  type AnalyzeOptions,
  type AnalyzeResult,
  mergeMentionedPullRequests,
  mergeReferencedPullRequests,
} from "./analyze.js";
export {
  type JsonOutput,
  renderReport,
  renderResult,
  toJsonOutput,
} from "./output.js";
