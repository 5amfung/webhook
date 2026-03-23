# Test Suite Design: Unit Tests & Integration Tests

## Goal

Establish a CI/CD-ready test suite covering server-side business logic and React presentational components using Vitest. Fast, reliable, and minimal setup.

## Approach

**Vitest only** — single test runner for all layers. Server tests run in Node environment, component tests run in jsdom. No Playwright, no Supertest, no server boot required.

## Test Infrastructure

### Configuration

A dedicated `vitest.config.ts` at project root (separate from `vite.config.ts` to avoid TanStack Start / Nitro plugin conflicts):

- **Default environment**: Node (server tests)
- **Per-file override**: `// @vitest-environment jsdom` for component tests
- **Path aliases**: reuse `@/*` → `./src/*` via `vite-tsconfig-paths`
- **Globals**: disabled (explicit imports from `vitest`)

### Directory Structure

```
tests/
├── server/
│   ├── lib/
│   │   ├── webhook-store.test.ts
│   │   └── event-bus.test.ts
│   └── routes/
│       └── webhook-handler.test.ts
└── components/
    ├── method-badge.test.tsx
    ├── copy-button.test.tsx
    └── code-block.test.tsx
```

### CI Script

The existing `"test": "vitest run"` in `package.json` requires no changes.

## Unit Tests: Server

### `tests/server/lib/webhook-store.test.ts`

Tests for the in-memory FIFO store (`server/lib/webhook-store.ts`):

| Test | Description |
|------|-------------|
| addWebhook / getWebhook | Store and retrieve a webhook by ID |
| getAllWebhooks ordering | Returns webhooks in reverse chronological order |
| FIFO eviction at capacity | Adding webhook #501 evicts the oldest entry |
| clearAllWebhooks | Empties the store and insertion order |
| getWebhook unknown ID | Returns `undefined` for nonexistent ID |

Each test gets a clean store via `clearAllWebhooks()` in `beforeEach`.

### `tests/server/lib/event-bus.test.ts`

Tests for the EventEmitter singleton (`server/lib/event-bus.ts`):

| Test | Description |
|------|-------------|
| emitWebhook delivers payload | Listeners on `"webhook"` receive the WebhookRequest |
| emitClear fires event | Listeners on `"clear"` are called |
| Multiple listeners | Both listeners receive the event |
| off removes listener | Callback no longer fires after unsubscribe |

## Integration Tests: Server

### `tests/server/routes/webhook-handler.test.ts`

Tests for the catch-all webhook route handler (`server/routes/api/webhook/[...].ts`). The handler is tested by importing it and invoking with mock H3 events.

| Test | Description |
|------|-------------|
| POST with JSON body | Stores webhook, returns `{ received: true, id }` |
| GET request | No body parsed, size is 0 |
| Query param parsing | Single and repeated query parameter keys |
| Path extraction | `/api/webhook/foo/bar` extracts path as `foo/bar` |
| 413 on oversized body | Body > 1MB returns `{ error: "Payload too large" }` |
| Binary content type | Non-text content type results in base64 body, `isBinary: true` |
| Event bus emission | `webhookEventBus` emits after webhook is stored |

## Component Tests: React

### `tests/components/method-badge.test.tsx`

| Test | Description |
|------|-------------|
| Renders method text | `<MethodBadge method="GET" />` displays "GET" |
| Known methods get styled | GET/POST/PUT/PATCH/DELETE each get their specific color class |
| Unknown method falls back | `"OPTIONS"` gets the default gray style |

### `tests/components/copy-button.test.tsx`

| Test | Description |
|------|-------------|
| Renders copy icon | Button is visible |
| Copies to clipboard on click | Mock `navigator.clipboard.writeText`, verify called with value |
| Shows check icon after copy | Icon switches to checkmark after click |
| Reverts after timeout | After 2000ms (fake timers), icon returns to copy |

### `tests/components/code-block.test.tsx`

| Test | Description |
|------|-------------|
| Renders text content | Displays raw body string |
| Pretty-prints JSON | Valid JSON + `application/json` renders formatted |
| Handles invalid JSON | Malformed JSON renders as-is without crashing |
| Binary payload message | `isBinary: true` shows "Binary payload (N bytes)" |
| Copy button present | CopyButton rendered for text content |

## Coverage Summary

| Layer | File | Tests | Environment |
|-------|------|-------|-------------|
| Server unit | webhook-store.test.ts | 5 | Node |
| Server unit | event-bus.test.ts | 4 | Node |
| Server integration | webhook-handler.test.ts | 7 | Node |
| Component | method-badge.test.tsx | 3 | jsdom |
| Component | copy-button.test.tsx | 4 | jsdom |
| Component | code-block.test.tsx | 5 | jsdom |
| **Total** | **6 files** | **~28** | |

## Out of Scope

Intentionally excluded from this iteration:

- **SSE endpoint** (`server/routes/api/events.ts`) — testing EventStream requires significant mocking with low CI gate value
- **TanStack Start server functions** (`server/functions/webhooks.ts`) — thin wrappers over store functions already tested
- **Route components** (`src/routes/index.tsx`, `src/routes/__root.tsx`) — require full router/query provider setup, low ROI
- **SSE hook** (`src/hooks/use-webhook-sse.ts`) — SSE + React Query integration, complex to mock
- **Mobile hook** (`src/hooks/use-is-mobile.ts`) — trivial media query wrapper

These can be added incrementally if needed after the CI gate is established.
