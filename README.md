# bunli-releaser

GoReleaser-like GitHub Action for Bunli CLIs: build multi-platform standalone binaries, publish GitHub Releases, and optionally update Homebrew taps.

## Usage

This action is meant to run on a tag push. v1 only supports tags in the format `v1.2.3`.

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: AryaLabsHQ/bunli-releaser@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # Optional:
          # bun-version: "1.3.8"
          # workdir: "."
          # targets: "all"
          # artifact-name: "mycli"
          # existing-assets: "fail" # or "skip"

          # Homebrew (optional)
          brew-tap: AryaLabsHQ/homebrew-tap
          brew-token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
          # Optional:
          # brew-formula-path: Formula/mycli.rb
          # brew-pr: "false"
          # brew-commit-message: "chore: update mycli to 1.2.3"
```

### Behavior (v1)

- Builds standalone binaries via `bunx bunli build --targets ... --outdir ...`.
- Packages per-target archives with stable naming:
  - Unix: `${name}-${version}-${os}-${arch}.tar.gz`
  - Windows: `${name}-${version}-${os}-${arch}.zip`
- Uploads archives and `checksums.txt` (sha256) to the GitHub Release for the tag.
- Homebrew tap updates are optional. If `brew-tap` + `brew-token` are provided, the action updates a Homebrew formula with conditional URLs + sha256 for macOS/Linux (arm64/x64).
  - Homebrew update assumes the corresponding `darwin-*` and `linux-*` assets exist (use `targets: all` unless you know what you're doing).
  - If you provide one of `brew-tap` or `brew-token` without the other, the action fails with a clear configuration error.
- Existing asset behavior is configurable:
  - `existing-assets: "fail"` (default): fail when a release asset already exists.
  - `existing-assets: "skip"`: skip uploads for already-existing asset names.
- If your project uses `build.compress=true` for multi-target builds, packaging will fail. Keep `build.compress` disabled when using bunli-releaser.

### Version Injection

During build, the action sets `BUNLI_RELEASE_VERSION=<version>` in the build process environment.
For compiled binaries, prefer embedding version from `package.json` (or another build-time source) rather than reading a runtime env var.

### Optional Config File

If `.bunli-releaser.yml` exists in `workdir`, the action will read it (inputs override). v1 only uses a small subset of the proposed schema.
