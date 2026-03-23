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
