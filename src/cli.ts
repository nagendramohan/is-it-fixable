// SPDX-License-Identifier: Apache-2.0
import { Command } from "commander";

const program = new Command();

program
  .name("is-it-fixable")
  .description(
    "Tell whether a GitHub issue is actually fixable and worth your time — a scored, evidence-backed verdict.",
  )
  .version("0.1.0");

// Full command wiring (data layer + rubric + output) lands in Task #6.
program
  .argument("[target]", "owner/repo or a GitHub issue URL")
  .option("--json", "output machine-readable JSON")
  .option("--token <token>", "GitHub token (or set GITHUB_TOKEN)")
  .action((target: string | undefined) => {
    if (!target) {
      program.help();
    }
    // Placeholder until the data layer + rubric are wired together.
    process.stderr.write("is-it-fixable: CLI wiring is under construction (Task #6).\n");
    process.exitCode = 0;
  });

program.parse();
