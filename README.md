# bunli-releaser

GoReleaser-like GitHub Action for Bunli CLIs: build multi-platform standalone binaries, publish GitHub Releases, and update Homebrew taps.

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

          # Homebrew (required in v1)
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
- Updates a Homebrew tap formula with conditional URLs + sha256 for macOS/Linux (arm64/x64).
  - Homebrew update assumes the corresponding `darwin-*` and `linux-*` assets exist (use `targets: all` unless you know what you're doing).

### Version Injection

During build, the action sets `BUNLI_RELEASE_VERSION=<version>` in the environment. If your CLI prints its version from this env var, `--version` will reflect the release version.

### Optional Config File

If `.bunli-releaser.yml` exists in `workdir`, the action will read it (inputs override). v1 only uses a small subset of the proposed schema.
