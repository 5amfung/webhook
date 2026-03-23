# GitHub Repository Public Setup — Design Spec

**Repo**: `github.com/5amfung/webhook`
**Owner**: `@5amfung` (Sam Fung)
**Model**: Solo maintainer, fork-based community contributions
**Date**: 2026-03-22

---

## 1. License

- **Type**: MIT
- **Year**: 2026
- **Name**: Sam Fung
- **File**: `LICENSE` at repo root

## 2. Repository Settings

Applied via `gh repo edit`:

| Setting | Value |
|---|---|
| Visibility | Public |
| Squash merge | Enabled |
| Merge commit | Enabled |
| Rebase merge | Disabled |
| Auto-delete head branches | Yes |
| Issues | Enabled |
| Discussions | Enabled |
| Wiki | Disabled |
| Topics | `webhook`, `inspector`, `developer-tools`, `tanstack`, `react` |

## 3. Branch Ruleset on `main`

A single ruleset named **"Protect main"** using the GitHub rulesets API (`POST /repos/{owner}/{repo}/rulesets`).

| Rule | Setting |
|---|---|
| Require PR before merge | Yes |
| Required approving reviews | 0 (PR required, no review gate) |
| Dismiss stale reviews on push | Yes |
| Require code owner review | Yes |
| Require status checks to pass | `ci` job (strict — branch must be up to date) |
| Block force pushes | Yes |
| Block branch deletion | Yes |
| Require conversation resolution | Yes |
| Enforce for admins | Yes (no bypass) |

## 4. CI Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --passWithNoTests
      - run: pnpm build
```

**Design decisions**:
- Single `ci` job (not split into parallel jobs) — appropriate for project size.
- Uses `pull_request` event (not `pull_request_target`) — safe for fork PRs.
- Explicit `permissions: contents: read` — least privilege.
- References `.node-version` file for consistent Node version.
- `pnpm/action-setup@v4` requires explicit `version` since there is no `packageManager` field in `package.json`.
- `--passWithNoTests` flag on vitest — the project currently has no test files, so `vitest run` exits non-zero without this flag. This prevents CI from being permanently red until tests are added.

## 5. Community Health Files

### 5.1 `LICENSE`

Standard MIT license text with `2026 Sam Fung`.

### 5.2 `CONTRIBUTING.md`

Contents:
- How to report bugs (link to issue templates)
- How to suggest features (link to issue templates)
- Development setup (fork, clone, `pnpm install`, `pnpm run dev`)
- Coding standards (link to ESLint/Prettier config, TypeScript strict mode)
- PR process (fork → branch → PR against `main`, CI must pass)
- Code of conduct reference

### 5.3 `CODE_OF_CONDUCT.md`

Contributor Covenant v3.0 — the latest industry standard.
Enforcement contact: private vulnerability reporting (Contributor Covenant requires a non-public contact method).

### 5.4 `SECURITY.md`

- Supported versions (latest only)
- Responsible disclosure via GitHub private vulnerability reporting
- Expected response timeline
- What qualifies as a security issue

### 5.5 `.github/PULL_REQUEST_TEMPLATE.md`

Checklist for PR authors:
- Description of changes
- Related issue (if applicable)
- Type of change (bug fix, feature, docs, etc.)
- Testing done
- Screenshots (if UI change)

### 5.6 `.github/ISSUE_TEMPLATE/bug_report.yml`

Structured YAML form:
- Description (required)
- Steps to reproduce (required)
- Expected behavior (required)
- Actual behavior (required)
- Environment: OS, browser, Node version (optional)
- Screenshots (optional)

### 5.7 `.github/ISSUE_TEMPLATE/feature_request.yml`

Structured YAML form:
- Problem description (required)
- Proposed solution (required)
- Alternatives considered (optional)
- Additional context (optional)

### 5.8 `.github/ISSUE_TEMPLATE/config.yml`

- Blank issues: disabled
- External link to Discussions for general questions

### 5.9 `.github/CODEOWNERS`

```
* @5amfung
```

All files owned by `@5amfung` — auto-requested for review on every PR.

## 6. Security Configuration

### 6.1 Dependabot

**File**: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 10
    reviewers:
      - "5amfung"
```

**Note**: `package-ecosystem: "npm"` is correct for pnpm projects (no native pnpm value exists). Dependabot may not correctly update `pnpm-lock.yaml`, so Dependabot PRs may require manual lock file regeneration.

### 6.2 GitHub Security Features

Applied via `gh api` calls:

| Feature | Action |
|---|---|
| Dependabot alerts | Enable |
| Secret scanning | Verify enabled (default for public repos) |
| Push protection | Enable |
| Private vulnerability reporting | Enable |

### 6.3 CodeQL Workflow

**File**: `.github/workflows/codeql.yml`

```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 1 * *'
permissions:
  security-events: write
  contents: read
  actions: read
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

Monthly schedule (1st of each month at 8am).

## 7. New File: `.node-version`

```
24
```

Ensures CI and local development use Node 24.x.

## 8. Files Created / Modified Summary

| File | Action |
|---|---|
| `LICENSE` | Create |
| `.node-version` | Create |
| `CONTRIBUTING.md` | Create |
| `CODE_OF_CONDUCT.md` | Create |
| `SECURITY.md` | Create |
| `.github/CODEOWNERS` | Create |
| `.github/PULL_REQUEST_TEMPLATE.md` | Create |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Create |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Create |
| `.github/ISSUE_TEMPLATE/config.yml` | Create |
| `.github/workflows/ci.yml` | Create |
| `.github/workflows/codeql.yml` | Create |
| `.github/dependabot.yml` | Create |

## 9. Manual / CLI Steps (Not Files)

These are applied via `gh` CLI commands after the files are committed:

1. `gh repo edit` — visibility, merge strategies, features, topics
2. `gh api` — create branch ruleset on `main`
3. `gh api` — enable Dependabot alerts
4. `gh api` — enable push protection
5. `gh api` — enable private vulnerability reporting
6. Verify secret scanning is enabled

**Order matters**: Files must be pushed first (CI workflow must exist before branch protection references its status check), and the repo must be public before some security features can be enabled.
