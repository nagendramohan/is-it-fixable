// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { type BuildSystem, buildHint, detectBuildSystem } from "../src/build-system.js";

describe("detectBuildSystem", () => {
  const cases: Array<[string, string[], BuildSystem, boolean]> = [
    ["cargo", ["Cargo.toml", "src", "README.md"], "cargo", true],
    ["gradle with wrapper", ["build.gradle", "gradlew", "settings.gradle"], "gradle", true],
    ["gradle without wrapper", ["build.gradle.kts"], "gradle", false],
    ["maven with wrapper", ["pom.xml", "mvnw", ".mvn"], "maven-wrapper", true],
    ["maven without wrapper", ["pom.xml"], "maven", false],
    ["npm", ["package.json", "tsconfig.json"], "npm", true],
    ["python", ["pyproject.toml", "src"], "python", false],
    ["go", ["go.mod", "go.sum"], "go", false],
    ["unknown", ["README.md", "docs"], "unknown", false],
  ];

  for (const [name, files, expectedSystem, expectedWrapper] of cases) {
    it(`detects ${name}`, () => {
      const info = detectBuildSystem(files);
      expect(info.system).toBe(expectedSystem);
      expect(info.hasWrapper).toBe(expectedWrapper);
      expect(typeof buildHint(info)).toBe("string");
    });
  }

  it("prefers Cargo when multiple markers exist (deterministic ordering)", () => {
    expect(detectBuildSystem(["Cargo.toml", "package.json", "pom.xml"]).system).toBe("cargo");
  });

  it("is case-insensitive on marker names", () => {
    expect(detectBuildSystem(["cargo.toml"]).system).toBe("cargo");
  });
});
