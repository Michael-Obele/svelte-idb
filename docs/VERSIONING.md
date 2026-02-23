# Versioning Guide for svelte-idb

This document explains how versioning works for the svelte-idb project using `release-please` and semantic versioning.

## Overview

svelte-idb follows **Semantic Versioning (SemVer)** in the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes to the API (e.g., `0.1.0` → `1.0.0`)
- **MINOR**: New features or significant changes (e.g., `0.1.0` → `0.2.0`)
- **PATCH**: Bug fixes and small updates (e.g., `0.1.0` → `0.1.1`)

## Current Configuration

The project is configured to stay in the **0.x.y phase** during early development:

- ✅ Feature commits (`feat:`) → **Patch bump** (`0.1.0` → `0.1.1`)
- ✅ Fix commits (`fix:`) → **Patch bump** (`0.1.0` → `0.1.1`)
- ⚠️ Breaking changes (`feat!:`, `fix!:`) → **Minor bump** (`0.1.0` → `0.2.0`)
- 🚀 Major release → **Manual control only** (`0.x.x` → `1.0.0`)

This approach prioritizes stability in the 0.x phase, treating all regular work as patches and requiring explicit action for version transitions.

## Version Bump Examples

### Automatic Patch Bumps (Default)

These commits automatically trigger a patch version bump:

```bash
# Bug fix
fix: correct IndexedDB connection handling

# New feature (treated as patch in 0.x phase)
feat: add support for composite indexes

# Documentation or internal improvements
chore: improve error messages
docs: update README with examples
```

**Result**: `0.1.0` → `0.1.1`

### Minor Bump (Breaking Changes)

Breaking changes automatically trigger a minor version bump:

```bash
# Breaking change using ! syntax
feat!: redesign Store API for better type safety

# Or using footer
fix: update query interface
BREAKING CHANGE: the where() method now returns a Promise
```

**Result**: `0.1.0` → `0.2.0`

### Major Bump (Requires Explicit Control)

To trigger a major release, use the `Release-As` footer:

```bash
chore: prepare for 1.0.0 release

Release-As: 1.0.0
```

**Result**: `0.1.0` → `1.0.0`

### Custom Versions (Explicit Control)

You can explicitly set any version using the `Release-As` footer:

```bash
feat: add new reactive layer

Release-As: 0.3.0
```

**Result**: `0.1.0` → `0.3.0` (skip 0.2.0)

## How to Use `Release-As`

The `Release-As` footer tells `release-please` to use a specific version regardless of the commits:

### Format

```
<type>: <description>

Release-As: X.Y.Z
```

### Examples

**Skip to minor:**

```
chore: release new stable version

Release-As: 0.2.0
```

**Jump to 1.0.0:**

```
chore: official 1.0.0 release

Release-As: 1.0.0
```

**Patch after manual fixes:**

```
fix: resolve critical issues

Release-As: 0.1.5
```

## Commit Message Format

svelte-idb follows **Conventional Commits** specification:

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

### Valid Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (not affecting logic)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Test additions or updates
- **chore**: Build, CI, or dependency changes

### Examples

```bash
# Patch: bug fix
fix: prevent memory leak in change notifier

# Patch: new feature (in 0.x phase)
feat: add liveCount() query method

# Minor: breaking change
feat!: require explicit close() on database connections

# Major: with Release-As
chore: prepare 1.0.0 release

Release-As: 1.0.0
```

## Four-Part Versioning (0.1.1.1)

**Short Answer**: Not supported for npm packages, but pre-release versions achieve the same goal.

### Why Four-Part Isn't Allowed

svelte-idb is published to npm, which **strictly enforces Semantic Versioning** (MAJOR.MINOR.PATCH):

- ❌ `0.1.1.1` - **Invalid for npm** (will be rejected)
- ❌ `0.1.1.1-alpha` - **Invalid for npm**
- ✅ `0.1.1` - Valid
- ✅ `0.1.1-alpha.1` - Valid (pre-release)
- ✅ `0.1.1-beta.2` - Valid (pre-release)
- ✅ `0.1.1-doc.1` - Valid (custom pre-release)

The npm registry strictly enforces the 3-part SemVer format and will reject four-part versions.

### Solution: Pre-Release Versioning

For documentation builds, testing versions, or internal distribution, use **pre-release versions** instead:

```
0.1.1-doc.1         # Documentation version 1
0.1.1-doc.2         # Documentation version 2
0.1.1-alpha.1       # Alpha testing
0.1.1-beta.1        # Beta testing
0.1.1-rc.1          # Release candidate
```

These are **npm-compatible**, **SemVer-valid**, and can be automated with release-please.

### Automatic Pre-Release Versioning with release-please

You can configure release-please to automatically generate pre-release versions for documentation:

**Step 1**: Update `.github/release-please-config.json` to add pre-release support:

```json
{
	"$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
	"release-type": "node",
	"bump-minor-pre-major": true,
	"bump-patch-for-minor-pre-major": true,
	"packages": {
		".": {
			"package-name": "svelte-idb"
		}
	},
	"prerelease-type": "doc"
}
```

**Step 2**: Create a separate workflow for doc-only releases (`.github/workflows/release-docs.yml`):

```yaml
name: Release Documentation Version

on:
  push:
    branches:
      - master
    paths:
      - 'docs/**'
      - '.github/workflows/release-docs.yml'

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  release-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: googleapis/release-please-action@v4
        with:
          config-file: .github/release-docs-config.json
          manifest-file: .release-please-manifest-docs.json
          target-branch: master
          token: ${{ secrets.GITHUB_TOKEN }}
```

**Step 3**: Create separate config for docs (`.github/release-docs-config.json`):

```json
{
	"$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
	"release-type": "node",
	"prerelease-type": "doc",
	"packages": {
		".": {
			"package-name": "svelte-idb"
		}
	}
}
```

**Step 4**: Create separate manifest (`.release-please-manifest-docs.json`):

```json
{
	".": "0.1.1-doc.0"
}
```

**Result**:

- 📚 Doc changes trigger: `0.1.1-doc.1` → `0.1.1-doc.2` → `0.1.1-doc.3`
- 📦 Code changes trigger: `0.1.1` → `0.1.2` (separate versioning)
- ✅ Both versions are npm-valid and SemVer-compliant

### Alternative Approaches

1. **Build Metadata** (npm-valid but limited):

   ```
   0.1.1+build.20260223
   0.1.1+commit.5be32bb
   ```

   Note: Build metadata is ignored in version comparisons, so `0.1.1+doc.1` and `0.1.1+doc.2` are treated as equal by npm.

2. **Separate Version File** (non-npm approach):
   - Create `docs/VERSION` file with `0.1.1.1` format
   - Update manually or via script
   - Useful for documentation-specific versioning outside npm

3. **GitHub Release Metadata**:
   - Use GitHub Release notes and pre-release flag
   - Add custom metadata in the release description
   - Doesn't affect package version on npm

## Release Workflow

1. **Commit with conventional message**:

   ```bash
   git commit -m "feat: add new reactive store functionality"
   ```

2. **GitHub Actions triggers `release-please`**:
   - Analyzes commits since last release
   - Creates a Release PR with updated version
   - Updates CHANGELOG.md

3. **Review and Merge** the Release PR

4. **Automated Release**:
   - Tag created (e.g., `v0.1.1`)
   - GitHub Release published
   - Package published to npm

## File Updates During Release

When `release-please` creates a release, it automatically updates:

- ✅ `package.json` - version field
- ✅ `package-lock.json` - version and dependencies
- ✅ `CHANGELOG.md` - new release section
- ✅ Git tag - version tag created
- ✅ GitHub Release - with changelog

## Checking Current Version

View the current version:

```bash
npm view svelte-idb version
# or
cat package.json | grep version
```

View all released versions:

```bash
npm view svelte-idb versions
# or from GitHub
git tag -l
```

## Best Practices

### ✅ Do

- Use clear, descriptive commit messages
- Use `feat!:` or footer for breaking changes
- Use `Release-As` only when you need to override default behavior
- Keep releases small and focused
- Update CHANGELOG manually only if needed

### ❌ Don't

- Force multiple version bumps in one commit
- Use `Release-As` for every release
- Skip semantic versioning conventions
- Commit version changes manually (let release-please handle it)

## Troubleshooting

### Version jumped unexpectedly

**Cause**: Breaking change detected in commits
**Solution**: Check for `!:` or `BREAKING CHANGE:` in recent commits

### Version didn't bump despite commits

**Cause**: Commits don't follow conventional format
**Solution**: Use proper `feat:`, `fix:`, `chore:` prefixes

### Need to override version

**Solution**: Use `Release-As: X.Y.Z` footer in commit message

### Release PR not created

**Cause**: No conventional commits since last release
**Solution**: Ensure new commits use `feat:`, `fix:`, or `feat!:` prefixes

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [release-please Documentation](https://github.com/googleapis/release-please)
- [npm Semver Calculator](https://semver.npmjs.com/)

## Release History

Releases are tracked in [CHANGELOG.md](../CHANGELOG.md) and on [GitHub Releases](https://github.com/Michael-Obele/svelte-idb/releases).
