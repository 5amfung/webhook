# Session Isolation for Webhook Endpoints

## Problem

Currently all visitors to the webhook inspector share a single global store. Any browser can see all webhook calls sent to any endpoint. This makes the tool unsuitable for multi-user or hosted deployment.

## Solution

Isolate webhook data by session. Each browser session gets a unique UUID-based namespace. Webhooks sent to `/api/webhook/<session-id>/...` are only visible to the browser that owns that session.

## Session Lifecycle

### New Session

1. Browser visits `/` with no `session_id` cookie.
2. Server generates a UUID via `crypto.randomUUID()`.
3. Server creates the session in the store and sets the `session_id` cookie.
4. Dashboard loads, calls `getSessionFn()` to retrieve the session ID.
5. UI displays the scoped webhook URL: `/api/webhook/<session-id>/...`.

### Existing Session

1. Browser visits `/` with a `session_id` cookie.
2. Server reads the cookie and checks whether the session exists in the store.
3. If the session exists, it is used as-is and `lastActivityAt` is updated.
4. If the session is gone (server restart, eviction, TTL expiry), a new UUID is generated and the cookie is reset.

### Bookmark Access

Users can bookmark their webhook URL. As long as the session is alive in memory (not expired or evicted), sending webhooks to `/api/webhook/<uuid>/...` works regardless of cookies. The cookie controls which session the dashboard displays. Once a session is evicted or expired, bookmarked URLs return 404.

## URL Structure

| Endpoint         | Current              | New                                |
|------------------|----------------------|------------------------------------|
| Webhook receiver | `/api/webhook/...`   | `/api/webhook/<session-id>/...`    |
| SSE stream       | `/api/events`        | `/api/events/<session-id>`         |
| Server functions | `getWebhooksFn()`    | `getWebhooksFn()` (session derived from cookie) |

### Webhook Receiver Behavior

- Valid session → store webhook, return `{ received: true, id }`.
- Non-existent session → return **404**.
- Missing session ID in path → return **404**.

### SSE Behavior

- Valid session → stream only that session's webhooks.
- Non-existent session → return **404**.

## Storage Architecture

### Current

Single flat store:

```
store: Map<webhookId, WebhookRequest>
insertionOrder: string[]
```

### New

Nested structure keyed by session ID:

```
sessions: Map<sessionId, {
  createdAt: number,
  lastActivityAt: number,
  webhooks: Map<webhookId, WebhookRequest>,
  insertionOrder: string[]
}>
```

### Store API

| Current                | New                                    |
|------------------------|----------------------------------------|
| `addWebhook(webhook)`  | `addWebhook(sessionId, webhook)`       |
| `getWebhook(id)`       | `getWebhook(sessionId, id)`            |
| `getAllWebhooks()`      | `getAllWebhooks(sessionId)`             |
| `clearAllWebhooks()`   | `clearAllWebhooks(sessionId)`          |
| —                      | `createSession(): string`              |
| —                      | `sessionExists(sessionId): boolean`    |
| —                      | `getOrCreateSession(sessionId?): string` |
| —                      | `cleanExpiredSessions(): void`         |

### Limits

- Per-session: 100 webhooks with FIFO eviction (reduced from the current global 500 because total memory now grows linearly with session count: 100 webhooks × N sessions).
- Session TTL: 24 hours of inactivity. `lastActivityAt` is updated on webhook receipt and dashboard access. A periodic cleanup runs to evict expired sessions.
- No hard global session cap initially. The TTL provides natural memory bounds.

### Event Bus

The event bus uses namespaced event names for session scoping:

- `webhook:<sessionId>` — emitted when a webhook is received for a session.
- `clear:<sessionId>` — emitted when a session's webhooks are cleared.

SSE connections subscribe only to their session's namespaced events, preventing cross-session data leaks.

## Cookie Configuration

| Property   | Value                                          |
|------------|------------------------------------------------|
| Name       | `session_id`                                   |
| Value      | UUID from `crypto.randomUUID()`                |
| HttpOnly   | `true`                                         |
| SameSite   | `Lax`                                          |
| Path       | `/`                                            |
| Secure     | `true` in production, `false` in dev           |
| Expiry     | Session cookie (no Max-Age / Expires)           |

### Session Resolution

A server function `getSessionFn()`:

1. Accesses the H3 event via `getEvent()` from `@tanstack/react-start/server` or `vinxi/http`.
2. Reads the `session_id` cookie using `getCookie()` from `h3`.
3. If cookie exists and session is in the store → return session ID.
4. If cookie is missing or session is gone → create new session, set cookie via `setCookie()` from `h3`, return new ID.

### Session Authorization

Server functions (`getWebhooksFn`, `clearWebhooksFn`) derive the session ID from the cookie internally rather than accepting it as a client parameter. This prevents any client from reading or clearing another session's data. The session ID is never trusted from client input for data access — only from the cookie.

## Frontend Changes

### Dashboard (`src/routes/index.tsx`)

- Calls `getSessionFn()` on load to get the session ID.
- Displays `/api/webhook/<session-id>/...` as the webhook URL.
- "Clear" button calls `clearWebhooksFn()` (session derived from cookie server-side).

### SSE Hook (`src/hooks/use-webhook-sse.ts`)

- Accepts `sessionId` as a parameter (used only for the SSE URL, not for data access authorization).
- Connects to `/api/events/<session-id>` instead of `/api/events`.
- React Query key scoped to session: `["webhooks", sessionId]`. This ensures cache invalidation if the session ID changes (e.g., cookie reset → new session).
- Dedup logic unchanged.

### Server Functions (`server/functions/webhooks.ts`)

- `getSessionFn()` — reads/creates session from cookie, returns session ID.
- `getWebhooksFn()` — derives session from cookie, fetches that session's webhooks.
- `getWebhookFn({ id })` — derives session from cookie, fetches single webhook within session.
- `clearWebhooksFn()` — derives session from cookie, clears that session + emits scoped `clear:<sessionId>` event.

### Route Files

- `server/routes/api/webhook/[...].ts` → `server/routes/api/webhook/[sessionId]/[...].ts`.
- `server/routes/api/events.ts` → `server/routes/api/events/[sessionId].ts`.

Path extraction in the webhook handler changes: instead of stripping `/api/webhook/` via regex, use `event.context.params` to get both the `sessionId` and the catch-all rest path directly from Nitro's file-based routing.

## Testing Strategy

### Unit Tests (webhook-store)

- Session creation and `sessionExists` checks.
- Per-session webhook CRUD operations.
- Per-session FIFO eviction at 100 webhooks.
- Cross-session isolation — webhooks in session A not visible in session B.
- Operations on non-existent session return empty/null without crashing.
- Session TTL expiry and `cleanExpiredSessions`.
- `lastActivityAt` updates on webhook add and session access.

### Route Tests

- Webhook handler returns 404 for non-existent session ID.
- Webhook handler stores correctly for valid session ID.
- SSE endpoint returns 404 for non-existent session.
- SSE endpoint streams only that session's webhooks.

### Server Function Tests

- `getSessionFn` reads cookie, creates session if missing, sets cookie.
- `getWebhooksFn` returns only the cookie-derived session's data.
- `clearWebhooksFn` clears only the cookie-derived session.

### Existing Test Updates (Breaking Changes)

The following existing tests require updates:

1. **`webhook-store.test.ts`** (7 tests): All store function calls (`addWebhook`, `getWebhook`, `getAllWebhooks`, `clearAllWebhooks`) gain a `sessionId` parameter. A `beforeEach` helper should create a test session. FIFO eviction threshold changes from 500 to 100.
2. **`webhook-handler.test.ts`** (8 tests): Request URLs change from `/api/webhook/...` to `/api/webhook/<sessionId>/...`. Mock events need the new URL structure. `clearAllWebhooks()` and `getAllWebhooks()` calls in setup/teardown need a session parameter or a new `clearAllSessions()` test helper.
3. **`event-bus.test.ts`** (4 tests): Event names change from `"webhook"` / `"clear"` to `"webhook:<sessionId>"` / `"clear:<sessionId>"`.
4. **`webhook-factory.ts`**: May need a default session ID constant for test convenience.
