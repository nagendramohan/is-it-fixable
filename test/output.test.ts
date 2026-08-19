// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { renderReport, toJsonOutput } from "../src/output.js";
import { assessRepoHealth } from "../src/repo-health.js";
import { assessIssue } from "../src/rubric.js";
import { NOW, makeIssue } from "./helpers.js";

function results() {
  const clean = assessIssue(makeIssue({ number: 1, title: "clean one" }), { now: NOW });
  const taken = assessIssue(
    makeIssue({
      number: 2,
      title: "taken one",
      linkedPullRequests: [
        { number: 9, state: "OPEN", isDraft: false, linkType: "cross-referenced" },
      ],
    }),
    { now: NOW },
  );
  return [taken, clean]; // deliberately unsorted (taken first)
}

describe("toJsonOutput", () => {
  it("produces a stable, sorted (most-fixable-first) JSON contract", () => {
    const json = toJsonOutput("acme/widgets", results());
    expect(json.target).toBe("acme/widgets");
    expect(json.results.map((r) => r.verdict)).toEqual(["CLEAN", "TAKEN"]);
    expect(json.results[0]).toMatchObject({ number: 1, verdict: "CLEAN" });
    expect(Array.isArray(json.results[0]?.evidence)).toBe(true);
  });

  it("omits build when not provided", () => {
    expect(toJsonOutput("acme/widgets", results()).build).toBeUndefined();
  });
});

describe("renderReport", () => {
  it("renders plain text without ANSI codes when useColor is false", () => {
    const text = renderReport("acme/widgets", results(), { useColor: false });
    // biome-ignore lint/suspicious/noControlCharactersInRegex: verifying no ANSI escapes leak.
    expect(/\x1b\[/.test(text)).toBe(false);
    expect(text).toContain("CLEAN");
    expect(text).toContain("TAKEN");
    expect(text).toContain("acme/widgets");
  });

  it("includes the repo-health line when provided", () => {
    const repoHealth = assessRepoHealth([
      {
        number: 1,
        authorAssociation: "CONTRIBUTOR",
        merged: false,
        createdAt: "2026-08-01T00:00:00Z",
        mergedAt: null,
      },
    ]);
    const text = renderReport("acme/widgets", results(), { useColor: false, repoHealth });
    expect(text).toContain("repo health:");
    expect(text).toContain("LOW-EXTERNAL-MERGE");
  });
});
