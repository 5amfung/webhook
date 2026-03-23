# GitHub Repository Public Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the `5amfung/webhook` GitHub repository for public access with community contributions, including branch protection, CI, security features, and community health files.

**Architecture:** File-first approach — create all repository files locally and push, then configure GitHub settings via `gh` CLI. This ordering is critical because branch rulesets reference CI status checks that must exist first.

**Tech Stack:** GitHub Actions, GitHub API (via `gh` CLI), pnpm, Node 24, Vitest, CodeQL

**Spec:** `docs/superpowers/specs/2026-03-22-github-repo-setup-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `LICENSE` | MIT license text |
| `.node-version` | Pin Node major version for CI and local dev |
| `CONTRIBUTING.md` | Contributor guide: setup, standards, PR process |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 |
| `SECURITY.md` | Vulnerability reporting policy |
| `.github/CODEOWNERS` | Auto-assign reviewer |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured bug form |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Structured feature request form |
| `.github/ISSUE_TEMPLATE/config.yml` | Disable blank issues, link Discussions |
| `.github/workflows/ci.yml` | Lint, typecheck, test, build on PRs |
| `.github/workflows/codeql.yml` | Security scanning on push/PR/monthly |
| `.github/dependabot.yml` | Monthly dependency updates |

---

### Task 1: License & Node Version

**Files:**
- Create: `LICENSE`
- Create: `.node-version`

- [ ] **Step 1: Create LICENSE file**

```
MIT License

Copyright (c) 2026 Sam Fung

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create .node-version file**

```
24
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE .node-version
git commit -m "chore: add MIT license and .node-version"
```

---

### Task 2: CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

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

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow for lint, typecheck, test, build"
```

---

### Task 3: CodeQL Workflow

**Files:**
- Create: `.github/workflows/codeql.yml`

- [ ] **Step 1: Create CodeQL workflow**

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

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/codeql.yml'))"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/codeql.yml
git commit -m "ci: add CodeQL security scanning workflow"
```

---

### Task 4: Dependabot Configuration

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create Dependabot config**

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

- [ ] **Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "chore: add Dependabot config for monthly dependency updates"
```

---

### Task 5: Community Health Files — CODEOWNERS & PR Template

**Files:**
- Create: `.github/CODEOWNERS`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create CODEOWNERS**

```
* @5amfung
```

- [ ] **Step 2: Create PR template**

```markdown
## Description

<!-- What does this PR do? Why is it needed? -->

## Related Issue

<!-- Link to the issue this PR addresses, if applicable -->
<!-- Fixes #123 -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor
- [ ] Other (describe below)

## Testing

<!-- How did you test these changes? -->

## Screenshots

<!-- If this is a UI change, add screenshots -->
```

- [ ] **Step 3: Commit**

```bash
git add .github/CODEOWNERS .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add CODEOWNERS and PR template"
```

---

### Task 6: Issue Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create bug report template**

```yaml
name: Bug Report
description: Report a bug or unexpected behavior
labels: ["bug"]
body:
  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear description of the bug.
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. See error
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What you expected to happen.
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened.
    validations:
      required: true
  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: OS, browser, Node version, etc.
      placeholder: |
        - OS: macOS 15
        - Browser: Chrome 130
        - Node: 24
    validations:
      required: false
  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots
      description: If applicable, add screenshots to help explain the problem.
    validations:
      required: false
```

- [ ] **Step 2: Create feature request template**

```yaml
name: Feature Request
description: Suggest a new feature or improvement
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What problem does this feature solve?
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How would you like this to work?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Any other approaches you've considered.
    validations:
      required: false
  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Any other context, screenshots, or examples.
    validations:
      required: false
```

- [ ] **Step 3: Create issue template config**

```yaml
blank_issues_enabled: false
contact_links:
  - name: Questions & Discussion
    url: https://github.com/5amfung/webhook/discussions
    about: Ask questions and share ideas in Discussions
```

- [ ] **Step 4: Commit**

```bash
git add .github/ISSUE_TEMPLATE/
git commit -m "chore: add issue templates for bug reports and feature requests"
```

---

### Task 7: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create CONTRIBUTING.md**

```markdown
# Contributing to Webhook Inspector

Thank you for your interest in contributing! This guide will help you get started.

## Reporting Bugs

Use the [bug report template](https://github.com/5amfung/webhook/issues/new?template=bug_report.yml) to file a bug. Include steps to reproduce, expected behavior, and actual behavior.

## Suggesting Features

Use the [feature request template](https://github.com/5amfung/webhook/issues/new?template=feature_request.yml) to propose new features.

## Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/webhook.git
   cd webhook
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm run dev
   ```

   The app runs at `http://localhost:3000`.

## Making Changes

1. Create a branch from `main`:

   ```bash
   git checkout -b feat/your-feature
   ```

2. Make your changes and ensure they pass CI:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

3. Commit your changes and push to your fork.

4. Open a pull request against `main`.

## Coding Standards

- TypeScript strict mode is enforced.
- ESLint and Biome handle linting and formatting.
- Run `pnpm lint` before committing.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add contributing guide"
```

---

### Task 8: CODE_OF_CONDUCT.md

**Files:**
- Create: `CODE_OF_CONDUCT.md`

- [ ] **Step 1: Create CODE_OF_CONDUCT.md**

Use the full Contributor Covenant v2.1 text. The enforcement contact should direct to GitHub private vulnerability reporting:

> **Enforcement:** Instances of abusive, harassing, or otherwise unacceptable behavior may be reported via [GitHub's private vulnerability reporting](https://github.com/5amfung/webhook/security/advisories/new).

- [ ] **Step 2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs: add Contributor Covenant Code of Conduct v2.1"
```

---

### Task 9: SECURITY.md

**Files:**
- Create: `SECURITY.md`

- [ ] **Step 1: Create SECURITY.md**

```markdown
# Security Policy

## Supported Versions

Only the latest version on `main` is supported with security updates.

| Version | Supported |
|---|---|
| Latest (`main`) | Yes |
| Older versions | No |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report vulnerabilities through [GitHub's private vulnerability reporting](https://github.com/5amfung/webhook/security/advisories/new).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix or mitigation:** Depends on severity, typically within 2 weeks for critical issues

### What qualifies as a security issue

- Authentication or authorization bypass
- Cross-site scripting (XSS)
- Injection vulnerabilities (SQL, command, etc.)
- Sensitive data exposure
- Denial of service vulnerabilities
- Dependencies with known CVEs

If you're unsure whether something is a security issue, report it privately and we'll assess it.
```

- [ ] **Step 2: Commit**

```bash
git add SECURITY.md
git commit -m "docs: add security policy"
```

---

### Task 10: Push Files & Create GitHub Repository

This task pushes all committed files and ensures the remote repo exists on GitHub.

- [ ] **Step 1: Verify all files are committed**

Run: `git status`
Expected: `nothing to commit, working tree clean`

Run: `git log --oneline -10`
Expected: Commits from Tasks 1-9 visible

- [ ] **Step 2: Check if remote repo exists**

```bash
gh repo view 5amfung/webhook 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
```

If `NOT_FOUND`:
```bash
gh repo create 5amfung/webhook --private --source=. --push
```

If `EXISTS`:
```bash
git push origin main
```

Note: Created as private first. We switch to public in Task 11 after verifying everything is in order.

- [ ] **Step 3: Verify files on GitHub**

Run: `gh api repos/5amfung/webhook/contents/.github/workflows/ci.yml --jq '.name'`
Expected: `ci.yml`

---

### Task 11: Configure Repository Settings

All `gh` CLI commands. Must run after Task 10 (files pushed).

- [ ] **Step 1: Set repository visibility to public**

```bash
gh repo edit 5amfung/webhook --visibility public
```

Note: This will prompt for confirmation. The repo must be public before enabling some security features.

- [ ] **Step 2: Configure merge strategies and features**

```bash
gh repo edit 5amfung/webhook \
  --enable-squash-merge \
  --enable-merge-commit \
  --disable-rebase-merge \
  --delete-branch-on-merge \
  --enable-issues \
  --enable-discussions \
  --enable-wiki=false
```

- [ ] **Step 3: Add topics**

```bash
gh repo edit 5amfung/webhook --add-topic webhook --add-topic inspector --add-topic developer-tools --add-topic tanstack --add-topic react
```

- [ ] **Step 4: Verify settings**

Run: `gh repo view 5amfung/webhook --json isPrivate,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge,hasIssuesEnabled,hasWikiEnabled,hasDiscussionsEnabled`

Expected: `isPrivate: false`, `squashMergeAllowed: true`, `mergeCommitAllowed: true`, `rebaseMergeAllowed: false`, `deleteBranchOnMerge: true`, `hasIssuesEnabled: true`, `hasWikiEnabled: false`, `hasDiscussionsEnabled: true`

---

### Task 12: Create Branch Ruleset

Must run after Task 11 (repo is public, CI workflow exists).

- [ ] **Step 1: Create the "Protect main" ruleset**

```bash
gh api repos/5amfung/webhook/rulesets \
  --method POST \
  --input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "bypass_actors": [],
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          {
            "context": "ci",
            "integration_id": null
          }
        ]
      }
    }
  ]
}
EOF
```

- [ ] **Step 2: Verify ruleset was created**

Run: `gh api repos/5amfung/webhook/rulesets --jq '.[].name'`
Expected: `Protect main`

---

### Task 13: Enable Security Features

Must run after Task 11 (repo is public).

- [ ] **Step 1: Enable Dependabot security updates**

```bash
gh api repos/5amfung/webhook/vulnerability-alerts --method PUT
```

Expected: HTTP 204 (no content)

- [ ] **Step 2: Enable secret scanning push protection**

```bash
gh api repos/5amfung/webhook --method PATCH --input - <<'EOF'
{
  "security_and_analysis": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "enabled"
    }
  }
}
EOF
```

- [ ] **Step 3: Enable private vulnerability reporting**

```bash
gh api repos/5amfung/webhook/private-vulnerability-reporting --method PUT
```

Expected: HTTP 204 (no content)

- [ ] **Step 4: Verify all security features are enabled**

Run: `gh api repos/5amfung/webhook --jq '.security_and_analysis'`
Expected: `secret_scanning.status: "enabled"`, `secret_scanning_push_protection.status: "enabled"`

Run: `gh api repos/5amfung/webhook/vulnerability-alerts --method GET 2>&1 | head -1`
Expected: HTTP 204 (alerts are enabled)

---

### Task 14: Final Verification

- [ ] **Step 1: Verify all community health files exist on GitHub**

```bash
gh api repos/5amfung/webhook/community/profile --jq '{
  license: .files.license.spdx_id,
  code_of_conduct: .files.code_of_conduct.name,
  contributing: .files.contributing.filename,
  security: (.files.security_policy != null),
  issue_template: (.files.issue_template != null),
  pull_request_template: (.files.pull_request_template != null),
  codeowners: (.files.code_owners != null)
}'
```

Expected: All fields populated / `true`.

- [ ] **Step 2: Verify branch ruleset blocks direct push**

Run: `gh api repos/5amfung/webhook/rulesets --jq '.[0] | {name, enforcement, rules: [.rules[].type]}'`
Expected: `name: "Protect main"`, `enforcement: "active"`, rules include `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`

- [ ] **Step 3: Verify CI workflow is valid**

Run: `gh workflow list --repo 5amfung/webhook`
Expected: Lists `CI` and `CodeQL` workflows

- [ ] **Step 4: Record completion**

All done. The repository is now:
- Public with MIT license
- Branch-protected with PR requirement and CI status checks
- Equipped with CI (lint, typecheck, test, build) and CodeQL scanning
- Configured with Dependabot, secret scanning, and push protection
- Ready for community contributions with templates and guides
