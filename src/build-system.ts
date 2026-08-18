// SPDX-License-Identifier: Apache-2.0
// Tier-3 (light): detect a repo's build system from its top-level file listing, so the CLI can hint
// whether the caller can realistically build/test it locally. Pure mapping over file names — the
// network fetch of the file list is separate and injectable, keeping this unit-testable.

export type BuildSystem =
  | "cargo"
  | "gradle"
  | "maven-wrapper"
  | "maven"
  | "npm"
  | "python"
  | "go"
  | "unknown";

export interface BuildInfo {
  system: BuildSystem;
  /** Marker files that led to the detection. */
  markers: string[];
  /** True when the repo ships a self-contained build wrapper (gradlew / mvnw), i.e. no global install needed. */
  hasWrapper: boolean;
}

/**
 * Detect the build system from a flat list of top-level file/dir names.
 * Ordered by how self-contained/likely-buildable-without-global-tooling the system is.
 */
export function detectBuildSystem(topLevelNames: readonly string[]): BuildInfo {
  const names = new Set(topLevelNames.map((n) => n.toLowerCase()));
  const has = (n: string): boolean => names.has(n.toLowerCase());

  if (has("Cargo.toml")) {
    return { system: "cargo", markers: ["Cargo.toml"], hasWrapper: true };
  }

  const gradleMarkers = [
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
  ].filter(has);
  if (gradleMarkers.length > 0) {
    const hasWrapper = has("gradlew");
    return {
      system: "gradle",
      markers: [...gradleMarkers, ...(hasWrapper ? ["gradlew"] : [])],
      hasWrapper,
    };
  }

  if (has("pom.xml")) {
    const hasWrapper = has("mvnw");
    return {
      system: hasWrapper ? "maven-wrapper" : "maven",
      markers: ["pom.xml", ...(hasWrapper ? ["mvnw"] : [])],
      hasWrapper,
    };
  }

  if (has("package.json")) {
    return { system: "npm", markers: ["package.json"], hasWrapper: true };
  }

  const pyMarkers = ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"].filter(has);
  if (pyMarkers.length > 0) {
    return { system: "python", markers: pyMarkers, hasWrapper: false };
  }

  if (has("go.mod")) {
    return { system: "go", markers: ["go.mod"], hasWrapper: false };
  }

  return { system: "unknown", markers: [], hasWrapper: false };
}

/** A short human hint about local buildability, for CLI output. */
export function buildHint(info: BuildInfo): string {
  switch (info.system) {
    case "cargo":
      return "Rust/Cargo — buildable with `cargo test` (no global install beyond the toolchain).";
    case "gradle":
      return info.hasWrapper
        ? "Gradle (with ./gradlew wrapper) — self-contained build."
        : "Gradle (no wrapper) — needs a local Gradle install.";
    case "maven-wrapper":
      return "Maven (with ./mvnw wrapper) — self-contained build.";
    case "maven":
      return "Maven (no wrapper) — needs a local Maven install.";
    case "npm":
      return "Node/npm — buildable with `npm install && npm test`.";
    case "python":
      return "Python — buildable, but mind the interpreter version (a common blocker).";
    case "go":
      return "Go — buildable with `go test ./...` (needs a Go toolchain).";
    default:
      return "Build system not detected from top-level files.";
  }
}
