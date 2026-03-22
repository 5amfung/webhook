# Webhook Inspector — Design Spec

## Overview

A local development webhook inspection tool built with TanStack Start, React 19, Vite, and shadcn/ui. Provides a catch-all webhook endpoint that captures incoming HTTP requests and displays them on a real-time dashboard. Functions like a self-hosted RequestBin/Webhook.site for local development.

## Requirements

- Accept webhook calls on any path under `/api/webhook/**`, any HTTP method
- Store webhook calls and request details in-process (no external database)
- Display webhook calls on a real-time dashboard with SSE
- Show formatted request URL, headers, query parameters, and payload
- Responsive UI: desktop and mobile using shadcn components

## Data Model

```ts
interface WebhookRequest {
  id: string                       // crypto.randomUUID()
  timestamp: number                // Date.now()
  method: string                   // GET, POST, PUT, DELETE, PATCH, etc.
  path: string                     // captured path after /api/webhook/
  url: string                      // full request URL including query string
  queryParams: Record<string, string | string[]>
  headers: Record<string, string>
  body: string | null              // raw body text (base64 for binary)
  contentType: string | null
  isBinary: boolean                // true if body is base64-encoded binary
  size: number                     // body size in bytes
}
```

### In-Memory Store

- Singleton `Map<string, WebhookRequest>` keyed by `id`
- Capped at 500 entries; on each insert, if at capacity, the oldest single entry is removed before the new one is added (1:1 eviction)
- `clearAll()` method to reset the store
- No persistence — data resets on server restart

## API Layer

### 1. Webhook Receiver — `server/routes/api/webhook/[...].ts`

- Nitro API route handler catching all HTTP methods (Nitro catch-all uses `[...].ts` naming convention)
- Parses: method, path, full URL, query params, headers, body, content type, size
- Body size limit: 1MB max. Requests exceeding this return `413 Payload Too Large`
- Binary bodies (non-text content types) are stored as base64-encoded strings with a `isBinary: true` flag
- Stores `WebhookRequest` in the in-memory store
- Emits event on `WebhookEventBus` for SSE broadcast
- Returns `200 OK` with `{ received: true, id }`

### 2. Dashboard API — TanStack Start Server Functions

- `getWebhooks()` — returns all stored webhooks, newest first
- `getWebhook(id)` — returns a single webhook by ID
- `clearWebhooks()` — empties the store, emits clear event on event bus

### 3. SSE Stream — `server/routes/api/events.ts`

- Nitro handler returning `text/event-stream` response
- Subscribes each connected client to `WebhookEventBus`
- Pushes new webhook events as `data: JSON.stringify(webhook)` messages
- Sends `clear` event type when store is cleared
- Sends keepalive comment (`: keepalive\n\n`) every 30 seconds to prevent proxy/browser timeouts
- Removes listener on client disconnect

## Real-Time Architecture

### WebhookEventBus

- Singleton `EventEmitter` (Node.js `events` module)
- Events:
  - `"webhook"` — emitted with full `WebhookRequest` when a new webhook is received
  - `"clear"` — emitted when the store is cleared

### Client-Side SSE Hook — `useWebhookSSE()`

- Opens `EventSource` to `/api/events` on mount
- On `"webhook"` message: inserts new webhook into React Query cache via `queryClient.setQueryData` (optimistic, no refetch). Deduplicates by `id` to handle reconnection overlap.
- On `"clear"` message: clears the React Query cache
- Handles reconnection automatically (native EventSource behavior)
- Cleans up EventSource on unmount

### Data Flow

```
External service → POST /api/webhook/stripe/invoice
  → Nitro handler parses request
  → Stores in in-memory Map
  → Emits "webhook" on WebhookEventBus
  → SSE pushes to all connected browsers
  → useWebhookSSE() updates React Query cache
  → Dashboard re-renders with new webhook entry
```

## Frontend

### Route Structure

Single route: `src/routes/index.tsx` — the entire app is a single-page dashboard.

### Page Layout

Clean single-column layout, max-width container, no sidebar. Header with app title and "Clear All" button. The webhook catch-all URL is prominently displayed for easy copying.

### Webhook List

- Live-updating list of all captured webhooks, newest first
- Each row displays: color-coded method badge, path, relative timestamp (e.g., "3s ago" — refreshed every 5s via `setInterval`), content type, body size
- Clicking a row opens the detail pane
- Empty state when no webhooks captured, showing the catch-all URL

### Detail Pane — `WebhookDetailPane`

- **Desktop**: slides in from the right as an inspector panel (shadcn `Sheet` with `side="right"`)
- **Mobile**: slides up from the bottom as a sheet (shadcn `Sheet` with `side="bottom"`)
- Responsive side switching via a media query hook (e.g., `useIsMobile()`)
- Close button and click-outside to dismiss
- Content organized in tabs: Headers, Params, Body
  - **Headers tab**: key/value table of all request headers
  - **Params tab**: key/value table of query parameters
  - **Body tab**: JSON bodies are pretty-printed with `JSON.stringify(data, null, 2)` and displayed in a `<pre>` block with CSS syntax coloring (no external highlighting library — keeps bundle lean). Raw text otherwise. Binary bodies show a "Binary payload" placeholder with size.
- Copy button for individual values

### shadcn Components

| Component | Usage |
|-----------|-------|
| Sheet / SheetContent | Detail pane (right on desktop, bottom on mobile) |
| Card | Webhook list items |
| Badge | HTTP method labels (GET=green, POST=blue, PUT=amber, PATCH=orange, DELETE=red, others=gray) |
| Table | Headers and query params display |
| Tabs | Organize detail pane sections |
| ScrollArea | Scrollable list and pane content |
| Separator | Section dividers |
| Tooltip | Full timestamps on hover |
| Button | Clear all, copy, close actions |

### Custom Components

| Component | Purpose |
|-----------|---------|
| `WebhookList` | Live-updating list with SSE integration |
| `WebhookDetailPane` | Sheet-based detail view with tabs |
| `MethodBadge` | Color-coded HTTP method badge |
| `CodeBlock` | Syntax-highlighted body display |
| `CopyButton` | Click-to-copy for URL and values |

### Responsive Behavior

- **Desktop**: comfortable spacing, full tables, detail pane slides from right
- **Mobile**: cards stack vertically, tables scroll horizontally, detail pane slides from bottom, body section full-width with horizontal scroll

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| In-process memory | Simplest approach, no dependencies, appropriate for a dev tool that resets between sessions |
| SSE over WebSocket | One-directional push is all that's needed; SSE is simpler, auto-reconnects natively |
| Nitro API routes for webhook receiver | Need raw request access that server functions don't provide |
| Server functions for dashboard API | Stays within TanStack Start patterns, type-safe |
| Single route | Detail pane is a Sheet overlay, no navigation needed |
| 500 entry cap | Prevents unbounded memory growth during long dev sessions |
| `/api/webhook/**` path | Avoids collision with dashboard routes |
