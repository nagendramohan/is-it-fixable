// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { extractReferences } from "../src/mentions.js";

const OPTS = { selfNumber: 1008, owner: "toml-rs", repo: "toml" };

describe("extractReferences", () => {
  it("extracts #N mentions from prose", () => {
    expect(extractReferences(["Proposed approach in #1195"], OPTS)).toEqual([1195]);
  });

  it("extracts same-repo pull/issue URLs", () => {
    const refs = extractReferences(
      ["see https://github.com/toml-rs/toml/pull/1195 and /issues/1200"],
      OPTS,
    );
    expect(refs).toContain(1195);
  });

  it("ignores the issue's own number (self-reference)", () => {
    expect(extractReferences(["this is #1008 itself"], OPTS)).toEqual([]);
  });

  it("ignores URL references to other repos", () => {
    expect(extractReferences(["https://github.com/other/repo/pull/42"], OPTS)).toEqual([]);
  });

  it("does not treat fragments like abc#12 or code as refs", () => {
    // Preceded by a word char -> not matched.
    expect(extractReferences(["commitabc#12"], OPTS)).toEqual([]);
  });

  it("de-duplicates and caps results", () => {
    const many = Array.from({ length: 20 }, (_, i) => `#${i + 2000}`).join(" ");
    const refs = extractReferences([many, "#2000 #2000"], { ...OPTS, max: 5 });
    expect(refs).toHaveLength(5);
    expect(new Set(refs).size).toBe(5);
  });

  it("scans multiple text blobs (body + comments)", () => {
    const refs = extractReferences(["body mentions #10", "a comment mentions #20"], OPTS);
    expect(refs.sort((a, b) => a - b)).toEqual([10, 20]);
  });
});
