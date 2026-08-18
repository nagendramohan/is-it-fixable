# Contributing to is-it-fixable

Thanks for your interest — contributions of all sizes are welcome, and this project is intentionally
built to be approachable.

## Getting started

```bash
git clone https://github.com/OWNER/is-it-fixable.git
cd is-it-fixable
npm install
npm run check   # typecheck + lint + tests
npm run build   # produce dist/
```

Requirements: Node.js >= 18.

## Development workflow

- `npm test` — run the test suite (Vitest).
- `npm run test:watch` — watch mode while developing.
- `npm run lint` / `npm run lint:fix` — Biome lint + format.
- `npm run typecheck` — strict TypeScript, no emit.
- `npm run check` — everything CI runs, locally.

Please make sure `npm run check` passes before opening a PR.

## Where things live

- `src/rubric.ts` — the fixability scoring engine (the heart of the project). Every signal is a small,
  testable addition. If you add or change a signal, add a test.
- `src/github.ts` — GitHub GraphQL data layer + the pure `mapIssueNode` transform.
- `src/output.ts` — pretty and `--json` rendering.
- `test/accuracy.test.ts` — the **accuracy gate**: real, hand-graded issues with expected verdicts.
  If you improve the rubric, consider adding a new fixture here.

## Adding a rubric signal

1. Add the signal (and its score delta + evidence message) in `src/rubric.ts`.
2. Add a focused unit test in `test/rubric.test.ts`.
3. If it reflects a real-world case, capture a fixture in `test/fixtures/` and add it to the accuracy gate.

## Commit sign-off (DCO)

Please sign off your commits (`git commit -s`) to certify the
[Developer Certificate of Origin](https://developercertificate.org/).

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).
