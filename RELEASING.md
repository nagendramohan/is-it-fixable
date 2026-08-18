# Releasing

Releases are automated by [`.github/workflows/release.yml`](./.github/workflows/release.yml):
pushing a `v*` tag runs the full quality gate (typecheck + lint + test + build), verifies the tag
matches `package.json`, and publishes to npm with provenance.

## One-time setup: the `NPM_TOKEN` secret

1. On npm, create a token that can publish from CI:
   - https://www.npmjs.com/settings/~/tokens → **Generate New Token**
   - Prefer a **Granular Access Token** with **Read and write** on the `is-it-fixable` package and
     **Bypass 2FA** enabled (CI cannot enter an OTP). An **Automation** token also works.
   - Copy the token (starts with `npm_…`).
2. Add it to the repo as a secret **named exactly `NPM_TOKEN`**:
   - GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `NPM_TOKEN`, Value: the token.

> Never commit the token or paste it anywhere but the GitHub secret field.

## Cutting a release

1. Update the version and changelog:
   ```bash
   npm version patch   # or: minor | major  (bumps package.json + creates a git commit)
   ```
   Move the relevant notes under a new heading in [`CHANGELOG.md`](./CHANGELOG.md).
2. Push the commit and the tag:
   ```bash
   git push origin main
   git push origin "v$(node -p "require('./package.json').version")"
   ```
   (`npm version` already created the `vX.Y.Z` tag locally.)
3. The **Release** workflow runs and publishes to npm. Watch the Actions tab.
4. (Optional) Draft a GitHub Release from the tag, pasting the CHANGELOG section as notes.

## Notes

- The workflow **fails fast** if the tag (`vX.Y.Z`) does not match `package.json`'s version — this
  prevents publishing a mislabeled release.
- Provenance (`--provenance`) requires the repo to be public and uses GitHub OIDC (`id-token: write`,
  already set in the workflow). If a token type ever rejects provenance, drop that flag.
- npm versions are immutable and cannot be re-published — always bump.
