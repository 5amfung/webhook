# Session Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate webhook data per browser session so each visitor sees only their own webhook calls.

**Architecture:** Cookie-based sessions with UUID identifiers. The webhook store becomes a nested map keyed by session ID. Event bus uses namespaced events for session-scoped SSE. Server functions derive session from cookies — never from client parameters.

**Tech Stack:** TanStack Start, Nitro/h3, `@tanstack/react-start/server` (getCookie/setCookie), crypto.randomUUID(), Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-session-isolation-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `server/lib/webhook-store.ts` | Session-scoped storage with per-session FIFO, TTL cleanup |
| Modify | `server/lib/event-bus.ts` | Namespaced events: `webhook:<sessionId>`, `clear:<sessionId>` |
| Modify | `server/functions/webhooks.ts` | Cookie-based session resolution, scoped data access |
| Delete | `server/routes/api/webhook/[...].ts` | Replaced by session-scoped route |
| Create | `server/routes/api/webhook/[sessionId]/[...].ts` | Session-scoped webhook receiver |
| Delete | `server/routes/api/events.ts` | Replaced by session-scoped route |
| Create | `server/routes/api/events/[sessionId].ts` | Session-scoped SSE endpoint |
| Modify | `src/hooks/use-webhook-sse.ts` | Accept sessionId, scoped query key + SSE URL |
| Modify | `src/routes/index.tsx` | Call getSessionFn, pass sessionId to hooks |
| Modify | `tests/helpers/webhook-factory.ts` | Add default session ID helper |
| Modify | `tests/server/lib/webhook-store.test.ts` | Session-scoped store tests |
| Modify | `tests/server/lib/event-bus.test.ts` | Namespaced event tests |
| Modify | `tests/server/routes/webhook-handler.test.ts` | Session-scoped URL tests |
| Create | `tests/server/routes/sse-endpoint.test.ts` | SSE session validation tests |

---

### Task 1: Refactor webhook-store to session-scoped storage

**Files:**
- Modify: `server/lib/webhook-store.ts`
- Modify: `tests/server/lib/webhook-store.test.ts`
- Modify: `tests/helpers/webhook-factory.ts`

- [ ] **Step 1: Update webhook-factory with session helper**

Add a default test session ID constant to `tests/helpers/webhook-factory.ts`:

```typescript
export const TEST_SESSION_ID = "test-session-00000000"
```

- [ ] **Step 2: Write failing tests for session-scoped store**

Replace the contents of `tests/server/lib/webhook-store.test.ts` with session-aware tests:

```typescript
import { beforeEach, describe, expect, it } from "vitest"
import {
  addWebhook,
  clearAllWebhooks,
  createSession,
  getAllWebhooks,
  getWebhook,
  sessionExists,
  clearAllSessions,
} from "../../../server/lib/webhook-store"
import { createWebhookFixture, TEST_SESSION_ID } from "../../helpers/webhook-factory"

describe("webhook-store", () => {
  beforeEach(() => {
    clearAllSessions()
  })

  describe("session management", () => {
    it("creates a session and confirms it exists", () => {
      const id = createSession()
      expect(sessionExists(id)).toBe(true)
    })

    it("returns false for non-existent session", () => {
      expect(sessionExists("nonexistent")).toBe(false)
    })
  })

  describe("webhook CRUD within a session", () => {
    it("stores and retrieves a webhook by ID", () => {
      const sessionId = createSession()
      const webhook = createWebhookFixture({ id: "abc-123" })
      addWebhook(sessionId, webhook)
      expect(getWebhook(sessionId, "abc-123")).toEqual(webhook)
    })

    it("returns webhooks newest-first from getAllWebhooks", () => {
      const sessionId = createSession()
      const first = createWebhookFixture({ id: "first" })
      const second = createWebhookFixture({ id: "second" })
      const third = createWebhookFixture({ id: "third" })
      addWebhook(sessionId, first)
      addWebhook(sessionId, second)
      addWebhook(sessionId, third)

      const all = getAllWebhooks(sessionId)
      expect(all[0].id).toBe("third")
      expect(all[1].id).toBe("second")
      expect(all[2].id).toBe("first")
    })

    it("clears only the target session's webhooks", () => {
      const session1 = createSession()
      const session2 = createSession()
      addWebhook(session1, createWebhookFixture({ id: "s1-webhook" }))
      addWebhook(session2, createWebhookFixture({ id: "s2-webhook" }))

      clearAllWebhooks(session1)

      expect(getAllWebhooks(session1)).toHaveLength(0)
      expect(getAllWebhooks(session2)).toHaveLength(1)
    })

    it("returns undefined for unknown webhook ID", () => {
      const sessionId = createSession()
      expect(getWebhook(sessionId, "nonexistent")).toBeUndefined()
    })

    it("returns empty array for non-existent session", () => {
      expect(getAllWebhooks("nonexistent")).toEqual([])
    })
  })

  describe("FIFO eviction", () => {
    it("evicts the oldest entry when exceeding 100 capacity", () => {
      const sessionId = createSession()
      for (let i = 0; i < 100; i++) {
        addWebhook(sessionId, createWebhookFixture({ id: `item-${i}` }))
      }
      expect(getWebhook(sessionId, "item-0")).toBeDefined()

      addWebhook(sessionId, createWebhookFixture({ id: "item-100" }))
      expect(getWebhook(sessionId, "item-0")).toBeUndefined()
      expect(getWebhook(sessionId, "item-100")).toBeDefined()
      expect(getAllWebhooks(sessionId)).toHaveLength(100)
    })

    it("returns correct ordering after FIFO eviction", () => {
      const sessionId = createSession()
      for (let i = 0; i < 101; i++) {
        addWebhook(sessionId, createWebhookFixture({ id: `item-${i}` }))
      }
      const all = getAllWebhooks(sessionId)
      expect(all[0].id).toBe("item-100")
      expect(all[all.length - 1].id).toBe("item-1")
    })
  })

  describe("session isolation", () => {
    it("webhooks in session A are not visible in session B", () => {
      const sessionA = createSession()
      const sessionB = createSession()
      addWebhook(sessionA, createWebhookFixture({ id: "a-only" }))

      expect(getWebhook(sessionA, "a-only")).toBeDefined()
      expect(getWebhook(sessionB, "a-only")).toBeUndefined()
      expect(getAllWebhooks(sessionB)).toHaveLength(0)
    })
  })

  describe("session TTL", () => {
    it("cleanExpiredSessions removes sessions inactive for over 24 hours", async () => {
      // Dynamically import to access cleanExpiredSessions.
      const { cleanExpiredSessions } = await import("../../../server/lib/webhook-store")
      const sessionId = createSession()
      addWebhook(sessionId, createWebhookFixture())

      // Manually set lastActivityAt to 25 hours ago by accessing internals.
      // This requires an exported test helper or direct access.
      const { _getSessionForTest } = await import("../../../server/lib/webhook-store")
      const session = _getSessionForTest(sessionId)!
      session.lastActivityAt = Date.now() - 25 * 60 * 60 * 1000

      cleanExpiredSessions()

      expect(sessionExists(sessionId)).toBe(false)
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/server/lib/webhook-store.test.ts`
Expected: FAIL — functions `createSession`, `sessionExists`, `clearAllSessions`, `cleanExpiredSessions`, `_getSessionForTest` don't exist yet, and `addWebhook`/`getWebhook`/`getAllWebhooks`/`clearAllWebhooks` have wrong signatures.

- [ ] **Step 4: Implement session-scoped webhook-store**

Replace `server/lib/webhook-store.ts`:

```typescript
import type { WebhookRequest } from "../../src/lib/types"

const MAX_WEBHOOKS_PER_SESSION = 100
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours.

interface Session {
  createdAt: number
  lastActivityAt: number
  webhooks: Map<string, WebhookRequest>
  insertionOrder: Array<string>
}

const sessions = new Map<string, Session>()

export function createSession(): string {
  const id = crypto.randomUUID()
  sessions.set(id, {
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    webhooks: new Map(),
    insertionOrder: [],
  })
  return id
}

export function sessionExists(sessionId: string): boolean {
  return sessions.has(sessionId)
}

export function getOrCreateSession(sessionId?: string): string {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!
    session.lastActivityAt = Date.now()
    return sessionId
  }
  return createSession()
}

export function addWebhook(sessionId: string, webhook: WebhookRequest): void {
  const session = sessions.get(sessionId)
  if (!session) return

  if (session.webhooks.size >= MAX_WEBHOOKS_PER_SESSION) {
    const oldest = session.insertionOrder.shift()
    if (oldest) session.webhooks.delete(oldest)
  }

  session.webhooks.set(webhook.id, webhook)
  session.insertionOrder.push(webhook.id)
  session.lastActivityAt = Date.now()
}

export function getWebhook(
  sessionId: string,
  id: string,
): WebhookRequest | undefined {
  return sessions.get(sessionId)?.webhooks.get(id)
}

export function getAllWebhooks(sessionId: string): Array<WebhookRequest> {
  const session = sessions.get(sessionId)
  if (!session) return []
  return Array.from(session.webhooks.values()).reverse()
}

export function clearAllWebhooks(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.webhooks.clear()
  session.insertionOrder.length = 0
}

export function cleanExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

export function clearAllSessions(): void {
  sessions.clear()
}

// Test-only helper to manipulate session internals.
export function _getSessionForTest(sessionId: string): Session | undefined {
  return sessions.get(sessionId)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/server/lib/webhook-store.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/webhook-store.ts tests/server/lib/webhook-store.test.ts tests/helpers/webhook-factory.ts
git commit -m "feat: refactor webhook-store to session-scoped storage

Each session gets its own Map of webhooks with 100-entry FIFO eviction.
Sessions have a 24h inactivity TTL with cleanExpiredSessions().
Adds createSession, sessionExists, getOrCreateSession, clearAllSessions."
```

---

### Task 2: Update event bus with namespaced events

**Files:**
- Modify: `server/lib/event-bus.ts`
- Modify: `tests/server/lib/event-bus.test.ts`

- [ ] **Step 1: Write failing tests for namespaced event bus**

Replace `tests/server/lib/event-bus.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest"
import { webhookEventBus } from "../../../server/lib/event-bus"
import { createWebhookFixture } from "../../helpers/webhook-factory"

const SESSION_A = "session-a"
const SESSION_B = "session-b"

describe("event-bus", () => {
  afterEach(() => {
    webhookEventBus.removeAllListeners()
  })

  it("delivers webhook payload to session-scoped listeners", () => {
    const listener = vi.fn()
    webhookEventBus.on(`webhook:${SESSION_A}`, listener)

    const webhook = createWebhookFixture()
    webhookEventBus.emitWebhook(SESSION_A, webhook)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(webhook)
  })

  it("does not deliver webhook to a different session's listener", () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    webhookEventBus.on(`webhook:${SESSION_A}`, listenerA)
    webhookEventBus.on(`webhook:${SESSION_B}`, listenerB)

    webhookEventBus.emitWebhook(SESSION_A, createWebhookFixture())

    expect(listenerA).toHaveBeenCalledOnce()
    expect(listenerB).not.toHaveBeenCalled()
  })

  it("fires clear event to session-scoped listeners", () => {
    const listener = vi.fn()
    webhookEventBus.on(`clear:${SESSION_A}`, listener)

    webhookEventBus.emitClear(SESSION_A)

    expect(listener).toHaveBeenCalledOnce()
  })

  it("delivers events to multiple listeners on the same session", () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    webhookEventBus.on(`webhook:${SESSION_A}`, listener1)
    webhookEventBus.on(`webhook:${SESSION_A}`, listener2)

    webhookEventBus.emitWebhook(SESSION_A, createWebhookFixture())

    expect(listener1).toHaveBeenCalledOnce()
    expect(listener2).toHaveBeenCalledOnce()
  })

  it("stops delivering after off()", () => {
    const listener = vi.fn()
    webhookEventBus.on(`webhook:${SESSION_A}`, listener)
    webhookEventBus.off(`webhook:${SESSION_A}`, listener)

    webhookEventBus.emitWebhook(SESSION_A, createWebhookFixture())

    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/server/lib/event-bus.test.ts`
Expected: FAIL — `emitWebhook` and `emitClear` don't accept `sessionId`.

- [ ] **Step 3: Implement namespaced event bus**

Replace `server/lib/event-bus.ts`:

```typescript
import { EventEmitter } from "node:events"
import type { WebhookRequest } from "../../src/lib/types"

class WebhookEventBus extends EventEmitter {
  emitWebhook(sessionId: string, webhook: WebhookRequest): void {
    this.emit(`webhook:${sessionId}`, webhook)
  }

  emitClear(sessionId: string): void {
    this.emit(`clear:${sessionId}`)
  }
}

export const webhookEventBus = new WebhookEventBus()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/server/lib/event-bus.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/event-bus.ts tests/server/lib/event-bus.test.ts
git commit -m "feat: namespace event bus events by session ID

Events now emit as webhook:<sessionId> and clear:<sessionId>,
ensuring SSE connections only receive their session's data."
```

---

### Task 3: Update server functions with cookie-based session resolution

**Files:**
- Modify: `server/functions/webhooks.ts`

**Note:** Server functions use TanStack Start's async request context (`getCookie`/`setCookie`), which requires a live server environment to test. Unit-testing these would require mocking the entire TanStack Start request context pipeline, which is brittle and low-value. Session resolution is verified through integration testing in Task 8 (manual browser verification with cookie inspection).

- [ ] **Step 1: Implement session-aware server functions**

Replace `server/functions/webhooks.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import {
  clearAllWebhooks,
  getAllWebhooks,
  getOrCreateSession,
  getWebhook,
  sessionExists,
} from "../lib/webhook-store"
import { webhookEventBus } from "../lib/event-bus"

const COOKIE_NAME = "session_id"

function resolveSession(): string {
  const existing = getCookie(COOKIE_NAME) ?? undefined
  const sessionId = getOrCreateSession(existing)

  // Set cookie if new session was created (different from cookie value).
  if (sessionId !== existing) {
    setCookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    })
  }

  return sessionId
}

export const getSessionFn = createServerFn({ method: "GET" }).handler(() => {
  return resolveSession()
})

export const getWebhooksFn = createServerFn({ method: "GET" }).handler(() => {
  const sessionId = resolveSession()
  return getAllWebhooks(sessionId)
})

export const getWebhookFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(({ data: id }) => {
    const sessionId = resolveSession()
    return getWebhook(sessionId, id) ?? null
  })

export const clearWebhooksFn = createServerFn({ method: "POST" }).handler(
  () => {
    const sessionId = resolveSession()
    clearAllWebhooks(sessionId)
    webhookEventBus.emitClear(sessionId)
    return { cleared: true }
  },
)
```

- [ ] **Step 2: Verify the module compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors in `server/functions/webhooks.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/functions/webhooks.ts
git commit -m "feat: add cookie-based session resolution to server functions

getSessionFn resolves or creates sessions from cookies.
All data access functions derive sessionId from cookies,
preventing cross-session data leaks."
```

---

### Task 4: Create session-scoped webhook handler route

**Files:**
- Delete: `server/routes/api/webhook/[...].ts`
- Create: `server/routes/api/webhook/[sessionId]/[...].ts`
- Modify: `tests/server/routes/webhook-handler.test.ts`

- [ ] **Step 1: Write failing tests for session-scoped webhook handler**

Replace `tests/server/routes/webhook-handler.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockEvent } from "h3"
import handler from "../../../server/routes/api/webhook/[sessionId]/[...]"
import {
  clearAllSessions,
  createSession,
  getAllWebhooks,
} from "../../../server/lib/webhook-store"
import { webhookEventBus } from "../../../server/lib/event-bus"

const handleWebhook = handler as unknown as (
  event: ReturnType<typeof mockEvent>,
) => Promise<unknown>

// mockEvent does not run Nitro routing, so event.context.params is empty.
// Manually set params to simulate what Nitro's router would provide.
function createWebhookEvent(
  sid: string,
  restPath: string,
  options: Parameters<typeof mockEvent>[1] = {},
): ReturnType<typeof mockEvent> {
  const url = restPath
    ? `/api/webhook/${sid}/${restPath}`
    : `/api/webhook/${sid}`
  const event = mockEvent(url, options)
  event.context.params = { sessionId: sid, _0: restPath }
  return event
}

describe("webhook handler", () => {
  let sessionId: string

  beforeEach(() => {
    clearAllSessions()
    webhookEventBus.removeAllListeners()
    sessionId = createSession()
  })

  it("stores a POST webhook and returns received:true", async () => {
    const event = createWebhookEvent(sessionId, "test-path", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({ received: true })
    expect((result as { id: string }).id).toBeDefined()

    const stored = getAllWebhooks(sessionId)
    expect(stored).toHaveLength(1)
    expect(stored[0].method).toBe("POST")
    expect(stored[0].path).toBe("test-path")
    expect(stored[0].body).toContain("hello")
  })

  it("returns 404 for non-existent session", async () => {
    const event = createWebhookEvent("nonexistent-session", "test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({ error: "Session not found" })
  })

  it("handles GET requests without parsing body", async () => {
    const event = createWebhookEvent(sessionId, "get-test", {
      method: "GET",
    })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({ received: true })
    const stored = getAllWebhooks(sessionId)
    expect(stored[0].body).toBeNull()
    expect(stored[0].size).toBe(0)
  })

  it("parses single and repeated query parameters", async () => {
    const event = createWebhookEvent(sessionId, "q?color=red&tag=a&tag=b", {
      method: "GET",
    })

    await handleWebhook(event)

    const stored = getAllWebhooks(sessionId)
    expect(stored[0].queryParams.color).toBe("red")
    expect(stored[0].queryParams.tag).toEqual(["a", "b"])
  })

  it("extracts path after /api/webhook/<sessionId>/", async () => {
    const event = createWebhookEvent(sessionId, "foo/bar/baz", {
      method: "GET",
    })

    await handleWebhook(event)

    const stored = getAllWebhooks(sessionId)
    expect(stored[0].path).toBe("foo/bar/baz")
  })

  it("extracts root path when no path follows session ID", async () => {
    const event = createWebhookEvent(sessionId, "", { method: "GET" })

    await handleWebhook(event)

    const stored = getAllWebhooks(sessionId)
    expect(stored[0].path).toBe("/")
  })

  it("returns 413 for oversized body", async () => {
    const largeBody = "x".repeat(1024 * 1024 + 1)
    const event = createWebhookEvent(sessionId, "large", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: largeBody,
    })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({
      error: "Payload too large",
      maxSize: "1MB",
    })
    expect(getAllWebhooks(sessionId)).toHaveLength(0)
  })

  it("base64-encodes binary content types", async () => {
    const event = createWebhookEvent(sessionId, "binary", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: "binary-data",
    })

    await handleWebhook(event)

    const stored = getAllWebhooks(sessionId)
    expect(stored[0].isBinary).toBe(true)
    expect(stored[0].body).not.toBeNull()
    expect(stored[0].contentType).toBe("application/octet-stream")
  })

  it("emits session-scoped webhook event on the event bus", async () => {
    const listener = vi.fn()
    webhookEventBus.on(`webhook:${sessionId}`, listener)

    const event = createWebhookEvent(sessionId, "bus-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    })

    await handleWebhook(event)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].path).toBe("bus-test")
  })

  it("does not emit to other sessions' listeners", async () => {
    const otherSession = createSession()
    const otherListener = vi.fn()
    webhookEventBus.on(`webhook:${otherSession}`, otherListener)

    const event = createWebhookEvent(sessionId, "isolated", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    })

    await handleWebhook(event)

    expect(otherListener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/server/routes/webhook-handler.test.ts`
Expected: FAIL — import path `server/routes/api/webhook/[sessionId]/[...]` doesn't exist yet.

- [ ] **Step 3: Delete old webhook handler**

```bash
rm server/routes/api/webhook/\[...\].ts
```

- [ ] **Step 4: Create session-scoped webhook handler**

Create `server/routes/api/webhook/[sessionId]/[...].ts`:

```typescript
import {
  defineEventHandler,
  getHeaders,
  getMethod,
  getRequestURL,
  getRouterParams,
  readRawBody,
  setResponseStatus,
} from "nitro/h3"
import { addWebhook, sessionExists } from "../../../../lib/webhook-store"
import { webhookEventBus } from "../../../../lib/event-bus"
import type { WebhookRequest } from "../../../../../src/lib/types"

const MAX_BODY_SIZE = 1024 * 1024 // 1MB.

const TEXT_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
]

function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return true
  return TEXT_CONTENT_TYPES.some((type) => contentType.includes(type))
}

export default defineEventHandler(async (event) => {
  const params = getRouterParams(event)
  const sessionId = params.sessionId

  if (!sessionId || !sessionExists(sessionId)) {
    setResponseStatus(event, 404)
    return { error: "Session not found" }
  }

  const method = getMethod(event)
  const requestUrl = getRequestURL(event)
  const headers = getHeaders(event)
  const contentType = headers["content-type"] ?? null

  // Extract path after /api/webhook/<sessionId>/.
  const fullPath = requestUrl.pathname
  const prefix = `/api/webhook/${sessionId}`
  const remaining = fullPath.startsWith(prefix)
    ? fullPath.slice(prefix.length)
    : fullPath
  const path = remaining.replace(/^\//, "") || "/"

  // Parse query params.
  const queryParams: Record<string, string | Array<string>> = {}
  requestUrl.searchParams.forEach((value, key) => {
    const existing = queryParams[key]
    if (existing) {
      queryParams[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value]
    } else {
      queryParams[key] = value
    }
  })

  // Read body.
  let body: string | null = null
  let isBinary = false
  let size = 0

  if (method !== "GET" && method !== "HEAD") {
    try {
      const rawBody = await readRawBody(event)
      if (rawBody != null) {
        const bodyStr = rawBody
        size = new TextEncoder().encode(bodyStr).length

        if (size > MAX_BODY_SIZE) {
          setResponseStatus(event, 413)
          return { error: "Payload too large", maxSize: "1MB" }
        }

        if (isTextContentType(contentType)) {
          body = bodyStr
        } else {
          body = Buffer.from(bodyStr).toString("base64")
          isBinary = true
        }
      }
    } catch {
      body = null
    }
  }

  const webhook: WebhookRequest = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    method,
    path,
    url: requestUrl.href,
    queryParams,
    headers: { ...headers },
    body,
    contentType,
    isBinary,
    size,
  }

  addWebhook(sessionId, webhook)
  webhookEventBus.emitWebhook(sessionId, webhook)

  return { received: true, id: webhook.id }
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/server/routes/webhook-handler.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A server/routes/api/webhook/ tests/server/routes/webhook-handler.test.ts
git commit -m "feat: add session-scoped webhook handler route

Moves webhook handler to [sessionId]/[...].ts. Returns 404 for
non-existent sessions. Emits namespaced events. Path extraction
uses prefix stripping with session ID."
```

---

### Task 5: Create session-scoped SSE endpoint

**Files:**
- Delete: `server/routes/api/events.ts`
- Create: `server/routes/api/events/[sessionId].ts`
- Create: `tests/server/routes/sse-endpoint.test.ts`

**Note:** SSE streaming is hard to unit-test with `mockEvent` since `createEventStream` requires a real HTTP connection. The SSE endpoint tests focus on the session validation gate (404 for invalid sessions). Full SSE streaming is verified in integration testing (Task 8).

- [ ] **Step 1: Delete old SSE endpoint**

```bash
rm server/routes/api/events.ts
```

- [ ] **Step 2: Create session-scoped SSE endpoint**

Create `server/routes/api/events/[sessionId].ts`:

```typescript
import {
  createEventStream,
  defineEventHandler,
  getRouterParams,
  setResponseStatus,
} from "nitro/h3"
import { webhookEventBus } from "../../../lib/event-bus"
import { sessionExists } from "../../../lib/webhook-store"
import type { WebhookRequest } from "../../../../src/lib/types"

const KEEPALIVE_INTERVAL_MS = 30_000

export default defineEventHandler((event) => {
  const params = getRouterParams(event)
  const sessionId = params.sessionId

  if (!sessionId || !sessionExists(sessionId)) {
    setResponseStatus(event, 404)
    return { error: "Session not found" }
  }

  const eventStream = createEventStream(event)

  // Send initial connection event.
  eventStream.push({ event: "connected", data: "{}" })

  const onWebhook = (webhook: WebhookRequest) => {
    eventStream.push({ event: "webhook", data: JSON.stringify(webhook) })
  }

  const onClear = () => {
    eventStream.push({ event: "clear", data: "{}" })
  }

  webhookEventBus.on(`webhook:${sessionId}`, onWebhook)
  webhookEventBus.on(`clear:${sessionId}`, onClear)

  // Keepalive to prevent proxy/browser timeouts.
  const keepalive = setInterval(() => {
    eventStream.pushComment("keepalive")
  }, KEEPALIVE_INTERVAL_MS)

  // Cleanup on disconnect.
  eventStream.onClosed(() => {
    webhookEventBus.off(`webhook:${sessionId}`, onWebhook)
    webhookEventBus.off(`clear:${sessionId}`, onClear)
    clearInterval(keepalive)
  })

  return eventStream.send()
})
```

- [ ] **Step 3: Write SSE endpoint session validation test**

Create `tests/server/routes/sse-endpoint.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest"
import { mockEvent } from "h3"
import handler from "../../../server/routes/api/events/[sessionId]"
import {
  clearAllSessions,
  createSession,
} from "../../../server/lib/webhook-store"

const handleSSE = handler as unknown as (
  event: ReturnType<typeof mockEvent>,
) => unknown

describe("SSE endpoint", () => {
  beforeEach(() => {
    clearAllSessions()
  })

  it("returns 404 for non-existent session", () => {
    const event = mockEvent("/api/events/nonexistent-session", {
      method: "GET",
    })
    event.context.params = { sessionId: "nonexistent-session" }

    const result = handleSSE(event)

    expect(result).toMatchObject({ error: "Session not found" })
  })

  it("returns 404 when sessionId param is missing", () => {
    const event = mockEvent("/api/events/", { method: "GET" })
    event.context.params = {}

    const result = handleSSE(event)

    expect(result).toMatchObject({ error: "Session not found" })
  })
})
```

- [ ] **Step 4: Run SSE tests**

Run: `pnpm vitest run tests/server/routes/sse-endpoint.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Verify the module compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add -A server/routes/api/events/ server/routes/api/events.ts tests/server/routes/sse-endpoint.test.ts
git commit -m "feat: add session-scoped SSE endpoint

Moves SSE from /api/events to /api/events/[sessionId].
Subscribes only to namespaced events for the given session.
Returns 404 for non-existent sessions."
```

---

### Task 6: Update frontend SSE hook with session scoping

**Files:**
- Modify: `src/hooks/use-webhook-sse.ts`

- [ ] **Step 1: Update SSE hook to accept sessionId**

Replace `src/hooks/use-webhook-sse.ts`:

```typescript
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { WebhookRequest } from "@/lib/types"

export function webhooksQueryKey(sessionId: string): readonly [string, string] {
  return ["webhooks", sessionId] as const
}

export function useWebhookSSE(sessionId: string | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionId) return

    const queryKey = webhooksQueryKey(sessionId)
    const eventSource = new EventSource(`/api/events/${sessionId}`)

    eventSource.addEventListener("webhook", (event) => {
      let webhook: WebhookRequest
      try {
        webhook = JSON.parse(event.data)
      } catch {
        return
      }

      queryClient.setQueryData<Array<WebhookRequest>>(
        queryKey,
        (old = []) => {
          // Deduplicate by id to handle reconnection overlap.
          if (old.some((w) => w.id === webhook.id)) return old
          return [webhook, ...old]
        },
      )
    })

    eventSource.addEventListener("clear", () => {
      queryClient.setQueryData(queryKey, [])
    })

    return () => eventSource.close()
  }, [queryClient, sessionId])
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors. (Dashboard will have errors until Task 7.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-webhook-sse.ts
git commit -m "feat: scope SSE hook and query key to session ID

useWebhookSSE now takes sessionId param, connects to
/api/events/<sessionId>, and uses ['webhooks', sessionId]
as the React Query cache key."
```

---

### Task 7: Update dashboard to use session-aware data flow

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Update dashboard component**

Update `src/routes/index.tsx` to call `getSessionFn` and pass `sessionId` through:

Key changes:
- Import `getSessionFn` from server functions.
- Add `useState` for `sessionId`, initialized to `null`.
- Call `getSessionFn()` in a `useEffect` to get the session ID and set cookie.
- Pass `sessionId` to `useWebhookSSE(sessionId)`.
- Use `webhooksQueryKey(sessionId)` for the React Query key.
- Update webhook URL to include session ID: `/api/webhook/<sessionId>/`.
- Update `handleClear` to use scoped query key.

```typescript
import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Radio, Terminal, Trash2, Zap } from "lucide-react"
import {
  clearWebhooksFn,
  getSessionFn,
  getWebhooksFn,
} from "../../server/functions/webhooks"
import type { WebhookRequest } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { WebhookList } from "@/components/webhook-list"
import { WebhookDetailPane } from "@/components/webhook-detail-pane"
import { CopyButton } from "@/components/copy-button"
import { useWebhookSSE, webhooksQueryKey } from "@/hooks/use-webhook-sse"

export const Route = createFileRoute("/")({
  component: Dashboard,
})

function buildCurlCommand(baseUrl: string): string {
  return [
    `curl -X POST ${baseUrl}test \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"hello":"world"}'`,
  ].join("\n")
}

function Dashboard() {
  const [selectedWebhook, setSelectedWebhook] =
    useState<WebhookRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Resolve session on mount.
  useEffect(() => {
    getSessionFn().then(setSessionId)
  }, [])

  const queryKey = sessionId ? webhooksQueryKey(sessionId) : ["webhooks", ""]

  const { data: webhooks = [] } = useQuery({
    queryKey,
    queryFn: () => getWebhooksFn(),
    enabled: !!sessionId,
  })

  useWebhookSSE(sessionId)

  const handleSelect = (webhook: WebhookRequest) => {
    setSelectedWebhook(webhook)
    setDetailOpen(true)
  }

  const queryClient = useQueryClient()

  const handleClear = async () => {
    // Optimistically clear the cache before the SSE event arrives.
    queryClient.setQueryData(queryKey, [])
    setSelectedWebhook(null)
    setDetailOpen(false)
    await clearWebhooksFn()
  }

  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    if (sessionId) {
      setWebhookUrl(`${window.location.origin}/api/webhook/${sessionId}/`)
    }
  }, [sessionId])

  const curlCommand = buildCurlCommand(webhookUrl)

  return (
    <div className="flex h-svh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 flex size-8 items-center justify-center rounded-lg">
              <Radio className="text-primary size-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Webhook Inspector
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="status-dot size-1.5 rounded-full bg-emerald-400" />
                <span className="text-muted-foreground text-[10px] uppercase tracking-widest">
                  Listening
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {webhooks.length > 0 && (
            <>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {webhooks.length} request{webhooks.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Endpoint bar */}
      <div className="flex items-center gap-3 border-b border-border/50 px-5 py-2.5">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest">
          Endpoint
        </span>
        <div className="bg-muted/50 flex flex-1 items-center gap-2 rounded-md border border-border/50 px-3 py-1.5">
          <Zap className="text-primary size-3 shrink-0" />
          <code className="flex-1 truncate font-mono text-xs font-medium">
            {webhookUrl || "Loading..."}
          </code>
          <CopyButton value={webhookUrl} />
        </div>
      </div>

      {/* Main content */}
      {webhooks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-card">
              <Radio className="text-primary size-8" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-base font-medium tracking-tight">
              Waiting for webhooks
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Send a request to the endpoint above to get started
            </p>
          </div>
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border/50 bg-card px-4 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="text-muted-foreground size-3.5" />
                <span className="text-muted-foreground text-xs font-medium">
                  Quick start
                </span>
              </div>
              <CopyButton value={curlCommand} />
            </div>
            <pre className="overflow-x-auto rounded-b-lg border border-border/50 bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed text-foreground/80">
              {curlCommand}
            </pre>
          </div>
        </div>
      ) : (
        <WebhookList
          webhooks={webhooks}
          onSelect={handleSelect}
          selectedId={selectedWebhook?.id ?? null}
        />
      )}

      {/* Detail pane */}
      <WebhookDetailPane
        webhook={selectedWebhook}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the full app compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: integrate session-aware data flow in dashboard

Dashboard resolves session on mount via getSessionFn(),
displays session-scoped webhook URL, uses scoped query key,
and passes sessionId to useWebhookSSE."
```

---

### Task 8: Full integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Run dev server and manually verify**

Run: `pnpm dev`

Manual checks:
1. Open browser → session cookie is set → unique webhook URL appears.
2. Send curl to the displayed URL → webhook appears in UI.
3. Open second browser/incognito → different session ID → different webhook URL.
4. Send curl to second session's URL → only visible in second browser.
5. First browser should NOT see second browser's webhooks.
6. Send curl to a random/invalid session UUID → returns 404.

- [ ] **Step 4: Commit any remaining fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: address integration test findings"
```

---

### Task 9: Add session TTL cleanup interval

**Files:**
- Modify: `server/routes/api/webhook/[sessionId]/[...].ts` (or a new server init file)

- [ ] **Step 1: Add periodic cleanup call**

Add a `setInterval` to run `cleanExpiredSessions` every hour. This can be placed at module scope in the webhook handler or in a dedicated server plugin. The simplest approach is a module-level side effect in `server/lib/webhook-store.ts`:

Add to the bottom of `server/lib/webhook-store.ts`:

```typescript
// Run session cleanup every hour. unref() prevents this timer from
// keeping the Node.js process (and Vitest) alive.
setInterval(cleanExpiredSessions, 60 * 60 * 1000).unref()
```

- [ ] **Step 2: Verify tests still pass**

Run: `pnpm vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add server/lib/webhook-store.ts
git commit -m "feat: add periodic session TTL cleanup

Runs cleanExpiredSessions every hour to evict sessions
inactive for more than 24 hours."
```
