// SPDX-License-Identifier: Apache-2.0
import { Command } from "commander";
import { analyze } from "./analyze.js";
import { renderReport, toJsonOutput } from "./output.js";
import { parseTarget } from "./target.js";

interface CliOptions {
  json?: boolean;
  token?: string;
  limit?: string;
  build?: boolean;
  repoHealth?: boolean;
  referencingPrs?: boolean;
}

const program = new Command();

program
  .name("is-it-fixable")
  .description(
    "Tell whether a GitHub issue is actually fixable and worth your time — a scored, evidence-backed verdict.",
  )
  .version("0.1.0")
  .argument("[target]", 'owner/repo, "owner/repo#123", or a GitHub issue URL')
  .option("--json", "output machine-readable JSON")
  .option("--token <token>", "GitHub token (or set GITHUB_TOKEN) to raise the rate limit")
  .option("--limit <n>", "max issues to analyze for a repo target", "30")
  .option("--build", "also detect the repo build system (one extra API call)")
  .option("--no-repo-health", "skip the repo merge-velocity signal for repo targets")
  .option(
    "--no-referencing-prs",
    "skip searching for PRs that reference each issue (one search-API call per issue)",
  )
  .action(async (target: string | undefined, opts: CliOptions) => {
    if (!target) {
      program.help();
      return;
    }
    try {
      const parsed = parseTarget(target);
      const limit = Number.parseInt(opts.limit ?? "30", 10);
      const analysis = await analyze(parsed, {
        token: opts.token,
        limit: Number.isFinite(limit) ? limit : 30,
        detectBuild: Boolean(opts.build),
        repoHealth: opts.repoHealth !== false,
        resolveReferencingPrs: opts.referencingPrs !== false,
      });

      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify(toJsonOutput(analysis.target, analysis.results, analysis.build, analysis.repoHealth), null, 2)}\n`,
        );
      } else {
        const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;
        process.stdout.write(
          `${renderReport(analysis.target, analysis.results, { useColor, build: analysis.build, repoHealth: analysis.repoHealth })}\n`,
        );
      }

      // Exit code: 0 if any CLEAN issue exists (something to pick), 1 otherwise — useful in scripts.
      const anyClean = analysis.results.some((r) => r.verdict === "CLEAN");
      process.exitCode = anyClean ? 0 : 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`is-it-fixable: ${message}\n`);
      process.exitCode = 2;
    }
  });

program.parseAsync();
