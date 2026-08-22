// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { type RawSignatureMatchItem, mapSignatureMatches } from "../src/github.js";

describe("mapSignatureMatches", () => {
  const items: RawSignatureMatchItem[] = [
    { number: 1172, title: "String mismatch...", state: "open" },
    { number: 1450, title: "Do not panic...", state: "open", pull_request: { url: "x" } },
    { number: 2221, title: "self (excluded)", state: "open" }, // the issue being checked
    { number: 1172, title: "dup number", state: "open" }, // duplicate number -> skipped
  ];

  it("maps items, marks PRs, and excludes the queried issue + duplicates", () => {
    const matches = mapSignatureMatches(items, 2221);
    expect(matches.map((m) => m.number)).toEqual([1172, 1450]);
    expect(matches.find((m) => m.number === 1450)?.isPr).toBe(true);
    expect(matches.find((m) => m.number === 1172)?.isPr).toBe(false);
  });

  it("normalizes state to OPEN/CLOSED", () => {
    const m = mapSignatureMatches([{ number: 5, state: "closed" }], 0);
    expect(m[0]?.state).toBe("CLOSED");
  });
});
