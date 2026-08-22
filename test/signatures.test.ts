// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { extractErrorSignatures, signatureSearchQuery } from "../src/signatures.js";

describe("extractErrorSignatures", () => {
  it("extracts the delta #2221 panic message (the tar-pit signal)", () => {
    const body = [
      "thread 'main' panicked at src/paint.rs:898:17:",
      "String mismatch encountered while superimposing style sections: ' ' vs 'm'",
      "note: run with `RUST_BACKTRACE=1` ...",
    ].join("\n");
    const sigs = extractErrorSignatures("Panic running git grep", body);
    const texts = sigs.map((s) => s.text);
    expect(texts).toContain(
      "String mismatch encountered while superimposing style sections: ' ' vs 'm'",
    );
    // The source location is also captured for cross-issue search.
    expect(texts).toContain("src/paint.rs:898");
    // Panic message ranks above the bare source location.
    expect(sigs[0]?.kind).toBe("panic");
  });

  it("extracts a Rust overflow assertion (hyperfine #920 class)", () => {
    const sigs = extractErrorSignatures(
      "panic: integer overflow in --parameter-scan",
      "In debug builds it panics with `attempt to add with overflow`.",
    );
    expect(sigs.some((s) => s.kind === "assertion" && /add with overflow/.test(s.text))).toBe(true);
  });

  it("extracts Python-style exceptions with detail", () => {
    const sigs = extractErrorSignatures(
      "Importing Rich fails",
      "os.getcwd() raises PermissionError: [Errno 1] Operation not permitted",
    );
    expect(sigs.some((s) => s.kind === "exception" && /PermissionError/.test(s.text))).toBe(true);
  });

  it("returns nothing for a feature request (no error-like content)", () => {
    expect(
      extractErrorSignatures("Add microeV", "It would be nice to support the microeV unit."),
    ).toEqual([]);
  });

  it("de-duplicates and orders by distinctiveness (weight desc)", () => {
    const sigs = extractErrorSignatures(
      "panicked at src/x.rs:1:1:\nboom boom boom failure here",
      "also see src/x.rs:1 and src/x.rs:1",
    );
    // src/x.rs:1 appears many times but is emitted once.
    expect(sigs.filter((s) => s.text === "src/x.rs:1")).toHaveLength(1);
    // Highest-weight (panic) first.
    expect(sigs[0]?.weight).toBeGreaterThanOrEqual(sigs[sigs.length - 1]?.weight ?? 0);
  });
});

describe("signatureSearchQuery", () => {
  it("quotes multi-word signatures for an exact-phrase repo search", () => {
    const q = signatureSearchQuery("dandavison", "delta", {
      text: "String mismatch encountered while superimposing style sections",
      kind: "panic",
      weight: 5,
    });
    expect(q).toBe(
      'repo:dandavison/delta "String mismatch encountered while superimposing style sections"',
    );
  });

  it("leaves single-token signatures unquoted", () => {
    const q = signatureSearchQuery("a", "b", {
      text: "src/paint.rs:898",
      kind: "source-location",
      weight: 3,
    });
    expect(q).toBe("repo:a/b src/paint.rs:898");
  });
});
