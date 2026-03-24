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
3. If the session exists, it is used as-is.
4. If the session is gone (server restart, eviction), a new UUID is generated and the cookie is reset.

### Reclaim via URL

Users can bookmark their webhook URL. As long as the session is alive in memory, sending webhooks to `/api/webhook/<uuid>/...` works regardless of cookies. The cookie controls which session the dashboard displays.

## URL Structure

| Endpoint         | Current              | New                                |
|------------------|----------------------|------------------------------------|
| Webhook receiver | `/api/webhook/...`   | `/api/webhook/<session-id>/...`    |
| SSE stream       | `/api/events`        | `/api/events/<session-id>`         |
| Server functions | `getWebhooksFn()`    | `getWebhooksFn({ sessionId })`     |

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

### Limits

- Per-session: 100 webhooks with FIFO eviction.
- No global session cap initially.

### Event Bus

`webhookEventBus.emitWebhook(webhook)` becomes `webhookEventBus.emitWebhook(sessionId, webhook)`. Listeners subscribe per session ID so SSE only broadcasts to the correct clients.

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

1. Reads `session_id` cookie from the request.
2. If cookie exists and session is in the store → return session ID.
3. If cookie is missing or session is gone → create new session, set cookie, return new ID.

## Frontend Changes

### Dashboard (`src/routes/index.tsx`)

- Calls `getSessionFn()` on load to get the session ID.
- Displays `/api/webhook/<session-id>/...` as the webhook URL.
- "Clear" button clears only the current session's webhooks.

### SSE Hook (`src/hooks/use-webhook-sse.ts`)

- Accepts `sessionId` as a parameter.
- Connects to `/api/events/<session-id>` instead of `/api/events`.
- Dedup and cache update logic unchanged.

### Server Functions (`server/functions/webhooks.ts`)

- `getWebhooksFn({ sessionId })` — fetches only that session's webhooks.
- `getWebhookFn({ sessionId, id })` — fetches a single webhook within the session.
- `clearWebhooksFn({ sessionId })` — clears only that session + emits scoped clear event.

### Route Files

- `server/routes/api/webhook/[...].ts` → `server/routes/api/webhook/[sessionId]/[...].ts`.
- `server/routes/api/events.ts` → `server/routes/api/events/[sessionId].ts`.

## Testing Strategy

### Unit Tests (webhook-store)

- Session creation and `sessionExists` checks.
- Per-session webhook CRUD operations.
- Per-session FIFO eviction at 100 webhooks.
- Cross-session isolation — webhooks in session A not visible in session B.
- Operations on non-existent session return empty/null without crashing.

### Route Tests

- Webhook handler returns 404 for non-existent session ID.
- Webhook handler stores correctly for valid session ID.
- SSE endpoint returns 404 for non-existent session.
- SSE endpoint streams only that session's webhooks.

### Server Function Tests

- `getSessionFn` reads cookie, creates session if missing, sets cookie.
- `getWebhooksFn` returns only the requested session's data.
- `clearWebhooksFn` clears only the target session.

### Existing Tests

All store calls gain a `sessionId` parameter. Test factory may need a default session ID helper.
