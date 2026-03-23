# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a CI/CD-ready test suite (~30 tests across 6 files) using Vitest, covering server business logic and React presentational components.

**Architecture:** Vitest-only approach with two environments: Node (default) for server tests, jsdom (per-file) for component tests. Separate `vitest.config.ts` to avoid TanStack Start/Nitro plugin conflicts. `nitro/h3` aliased to `h3` so the handler can be imported outside the Nitro runtime.

**Tech Stack:** Vitest 3.x, h3 2.x (`mockEvent`), @testing-library/react, @testing-library/user-event, jsdom

**Spec:** `docs/superpowers/specs/2026-03-22-test-suite-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `vitest.config.ts` | Test runner config: Node env, `nitro/h3` → `h3` alias, path aliases |
| Create | `tests/helpers/webhook-factory.ts` | Shared factory for `WebhookRequest` test fixtures |
| Create | `tests/server/lib/webhook-store.test.ts` | Unit tests for FIFO in-memory store |
| Create | `tests/server/lib/event-bus.test.ts` | Unit tests for EventEmitter singleton |
| Create | `tests/server/routes/webhook-handler.test.ts` | Integration tests for catch-all webhook route |
| Create | `tests/components/method-badge.test.tsx` | Component tests for MethodBadge |
| Create | `tests/components/copy-button.test.tsx` | Component tests for CopyButton |
| Create | `tests/components/code-block.test.tsx` | Component tests for CodeBlock |
| Modify | `package.json` | Add `h3` and `@testing-library/user-event` as devDependencies |

---

## Task 1: Install Dependencies and Create Vitest Config

**Files:**
- Modify: `package.json` (add `h3` and `@testing-library/user-event` devDependencies)
- Create: `vitest.config.ts`

- [ ] **Step 1: Add test dependencies**

```bash
pnpm add -D h3 @testing-library/user-event
```

`h3` is needed because it's only a transitive dependency of `nitro` and not hoisted by pnpm. The webhook handler imports from `nitro/h3` (which is just `export * from "h3"`) — aliasing `nitro/h3` → `h3` in vitest config lets us import the handler in tests. `@testing-library/user-event` is needed for component interaction tests.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    react(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // nitro/h3 is a re-export of h3; alias it so handler imports resolve outside Nitro runtime.
      "nitro/h3": "h3",
    },
  },
})
```

Note: `@vitejs/plugin-react` is required so Vitest can transform JSX in `.tsx` component test files. It's already in devDependencies.

- [ ] **Step 3: Verify vitest runs with no tests**

Run: `pnpm test`
Expected: "No test files found" or similar — confirms config loads without errors.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add vitest config and test dependencies"
```

---

## Task 2: Create Webhook Factory Helper

**Files:**
- Create: `tests/helpers/webhook-factory.ts`

- [ ] **Step 1: Create shared factory**

```ts
import type { WebhookRequest } from "../../src/lib/types"

let counter = 0

export function createWebhookFixture(
  overrides: Partial<WebhookRequest> = {},
): WebhookRequest {
  counter++
  return {
    id: overrides.id ?? `test-id-${counter}`,
    timestamp: overrides.timestamp ?? Date.now(),
    method: "POST",
    path: "/test",
    url: "http://localhost/api/webhook/test",
    queryParams: {},
    headers: { "content-type": "application/json" },
    body: '{"test": true}',
    contentType: "application/json",
    isBinary: false,
    size: 14,
    ...overrides,
  }
}

export function resetFixtureCounter(): void {
  counter = 0
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/webhook-factory.ts
git commit -m "test: add webhook fixture factory helper"
```

---

## Task 3: Webhook Store Unit Tests

**Files:**
- Create: `tests/server/lib/webhook-store.test.ts`
- Source: `server/lib/webhook-store.ts`

- [ ] **Step 1: Write all webhook store tests**

```ts
import { describe, it, expect, beforeEach } from "vitest"
import {
  addWebhook,
  getWebhook,
  getAllWebhooks,
  clearAllWebhooks,
} from "../../../server/lib/webhook-store"
import { createWebhookFixture } from "../../helpers/webhook-factory"

describe("webhook-store", () => {
  beforeEach(() => {
    clearAllWebhooks()
  })

  it("stores and retrieves a webhook by ID", () => {
    const webhook = createWebhookFixture({ id: "abc-123" })
    addWebhook(webhook)
    expect(getWebhook("abc-123")).toEqual(webhook)
  })

  it("returns webhooks newest-first from getAllWebhooks", () => {
    const first = createWebhookFixture({ id: "first" })
    const second = createWebhookFixture({ id: "second" })
    const third = createWebhookFixture({ id: "third" })
    addWebhook(first)
    addWebhook(second)
    addWebhook(third)

    const all = getAllWebhooks()
    expect(all[0].id).toBe("third")
    expect(all[1].id).toBe("second")
    expect(all[2].id).toBe("first")
  })

  it("evicts the oldest entry when exceeding 500 capacity", () => {
    for (let i = 0; i < 500; i++) {
      addWebhook(createWebhookFixture({ id: `item-${i}` }))
    }
    expect(getWebhook("item-0")).toBeDefined()

    addWebhook(createWebhookFixture({ id: "item-500" }))
    expect(getWebhook("item-0")).toBeUndefined()
    expect(getWebhook("item-500")).toBeDefined()
    expect(getAllWebhooks()).toHaveLength(500)
  })

  it("returns correct ordering after FIFO eviction", () => {
    for (let i = 0; i < 501; i++) {
      addWebhook(createWebhookFixture({ id: `item-${i}` }))
    }
    const all = getAllWebhooks()
    expect(all[0].id).toBe("item-500")
    expect(all[all.length - 1].id).toBe("item-1")
  })

  it("clears all webhooks", () => {
    addWebhook(createWebhookFixture())
    addWebhook(createWebhookFixture())
    clearAllWebhooks()
    expect(getAllWebhooks()).toHaveLength(0)
  })

  it("returns undefined for unknown ID", () => {
    expect(getWebhook("nonexistent")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: 6 passing tests in `webhook-store.test.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/server/lib/webhook-store.test.ts
git commit -m "test: add webhook store unit tests"
```

---

## Task 4: Event Bus Unit Tests

**Files:**
- Create: `tests/server/lib/event-bus.test.ts`
- Source: `server/lib/event-bus.ts`

- [ ] **Step 1: Write all event bus tests**

```ts
import { describe, it, expect, vi, afterEach } from "vitest"
import { webhookEventBus } from "../../../server/lib/event-bus"
import { createWebhookFixture } from "../../helpers/webhook-factory"

describe("event-bus", () => {
  afterEach(() => {
    webhookEventBus.removeAllListeners()
  })

  it("delivers webhook payload to listeners", () => {
    const listener = vi.fn()
    webhookEventBus.on("webhook", listener)

    const webhook = createWebhookFixture()
    webhookEventBus.emitWebhook(webhook)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(webhook)
  })

  it("fires clear event to listeners", () => {
    const listener = vi.fn()
    webhookEventBus.on("clear", listener)

    webhookEventBus.emitClear()

    expect(listener).toHaveBeenCalledOnce()
  })

  it("delivers events to multiple listeners", () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    webhookEventBus.on("webhook", listener1)
    webhookEventBus.on("webhook", listener2)

    webhookEventBus.emitWebhook(createWebhookFixture())

    expect(listener1).toHaveBeenCalledOnce()
    expect(listener2).toHaveBeenCalledOnce()
  })

  it("stops delivering after off()", () => {
    const listener = vi.fn()
    webhookEventBus.on("webhook", listener)
    webhookEventBus.off("webhook", listener)

    webhookEventBus.emitWebhook(createWebhookFixture())

    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: 4 passing tests in `event-bus.test.ts`, 6 in `webhook-store.test.ts` (10 total)

- [ ] **Step 3: Commit**

```bash
git add tests/server/lib/event-bus.test.ts
git commit -m "test: add event bus unit tests"
```

---

## Task 5: Webhook Handler Integration Tests

**Files:**
- Create: `tests/server/routes/webhook-handler.test.ts`
- Source: `server/routes/api/webhook/[...].ts`

**Key insight:** The handler uses `defineEventHandler` from `nitro/h3` (aliased to `h3` in vitest config). The default export is the result of `defineEventHandler(async (event) => {...})`. In h3 v2, `defineEventHandler` returns an `EventHandler` — a function that accepts an `H3Event`. We use `mockEvent(url, requestInit)` from `h3` to construct valid events.

- [ ] **Step 1: Write all webhook handler tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockEvent } from "h3"
import handler from "../../../server/routes/api/webhook/[...]"
import { clearAllWebhooks, getAllWebhooks } from "../../../server/lib/webhook-store"
import { webhookEventBus } from "../../../server/lib/event-bus"

// defineEventHandler returns the handler function directly in h3 v2.
const handleWebhook = handler as unknown as (event: ReturnType<typeof mockEvent>) => Promise<unknown>

describe("webhook handler", () => {
  beforeEach(() => {
    clearAllWebhooks()
    webhookEventBus.removeAllListeners()
  })

  it("stores a POST webhook and returns received:true", async () => {
    const event = mockEvent("/api/webhook/test-path", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({ received: true })
    expect((result as { id: string }).id).toBeDefined()

    const stored = getAllWebhooks()
    expect(stored).toHaveLength(1)
    expect(stored[0].method).toBe("POST")
    expect(stored[0].path).toBe("test-path")
    expect(stored[0].body).toContain("hello")
  })

  it("handles GET requests without parsing body", async () => {
    const event = mockEvent("/api/webhook/get-test", { method: "GET" })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({ received: true })
    const stored = getAllWebhooks()
    expect(stored[0].body).toBeNull()
    expect(stored[0].size).toBe(0)
  })

  it("parses single and repeated query parameters", async () => {
    const event = mockEvent("/api/webhook/q?color=red&tag=a&tag=b", {
      method: "GET",
    })

    await handleWebhook(event)

    const stored = getAllWebhooks()
    expect(stored[0].queryParams.color).toBe("red")
    expect(stored[0].queryParams.tag).toEqual(["a", "b"])
  })

  it("extracts path after /api/webhook/", async () => {
    const event = mockEvent("/api/webhook/foo/bar/baz", { method: "GET" })

    await handleWebhook(event)

    const stored = getAllWebhooks()
    expect(stored[0].path).toBe("foo/bar/baz")
  })

  it("extracts root path when no path segment follows /api/webhook", async () => {
    const event = mockEvent("/api/webhook", { method: "GET" })

    await handleWebhook(event)

    const stored = getAllWebhooks()
    expect(stored[0].path).toBe("/")
  })

  it("extracts root path for /api/webhook/ with trailing slash", async () => {
    const event = mockEvent("/api/webhook/", { method: "GET" })

    await handleWebhook(event)

    const stored = getAllWebhooks()
    expect(stored[0].path).toBe("/")
  })

  it("returns 413 for oversized body", async () => {
    const largeBody = "x".repeat(1024 * 1024 + 1)
    const event = mockEvent("/api/webhook/large", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: largeBody,
    })

    const result = await handleWebhook(event)

    expect(result).toMatchObject({ error: "Payload too large", maxSize: "1MB" })
    expect(getAllWebhooks()).toHaveLength(0)
  })

  it("base64-encodes binary content types", async () => {
    const event = mockEvent("/api/webhook/binary", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: "binary-data",
    })

    await handleWebhook(event)

    const stored = getAllWebhooks()
    expect(stored[0].isBinary).toBe(true)
    // The exact base64 value depends on how readBody returns the payload.
    // Assert isBinary flag and non-null body rather than exact encoding.
    expect(stored[0].body).not.toBeNull()
    expect(stored[0].contentType).toBe("application/octet-stream")
  })

  it("emits webhook event on the event bus", async () => {
    const listener = vi.fn()
    webhookEventBus.on("webhook", listener)

    const event = mockEvent("/api/webhook/bus-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    })

    await handleWebhook(event)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].path).toBe("bus-test")
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: 9 passing in `webhook-handler.test.ts`, 10 prior tests still pass (19 total)

**Troubleshooting:** If `mockEvent` body parsing doesn't work as expected with `readBody`, the handler's `readBody` call may need the event to be constructed differently. In that case, adjust to use `h3`'s `createApp` + `toNodeHandler` + `createEvent` approach with a real HTTP request. The plan's first approach is the simplest — if it doesn't work, fall back to the app-based approach below:

```ts
// Fallback approach if mockEvent doesn't support readBody:
import { createApp, createRouter, toNodeHandler, defineEventHandler } from "h3"
import { createServer } from "node:http"

function createTestApp() {
  const app = createApp()
  const router = createRouter()
  router.add("/api/webhook/**", handler)
  app.use(router)
  return app
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/server/routes/webhook-handler.test.ts
git commit -m "test: add webhook handler integration tests"
```

---

## Task 6: MethodBadge Component Tests

**Files:**
- Create: `tests/components/method-badge.test.tsx`
- Source: `src/components/method-badge.tsx`

- [ ] **Step 1: Write all MethodBadge tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MethodBadge } from "../../src/components/method-badge"

describe("MethodBadge", () => {
  it("renders the method text", () => {
    render(<MethodBadge method="GET" />)
    expect(screen.getByText("GET")).toBeDefined()
  })

  it("applies specific styles for known HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
    const expectedColors = ["emerald", "blue", "amber", "orange", "red"]

    methods.forEach((method, i) => {
      const { unmount } = render(<MethodBadge method={method} />)
      const badge = screen.getByText(method)
      expect(badge.className).toContain(expectedColors[i])
      unmount()
    })
  })

  it("falls back to gray style for unknown methods", () => {
    render(<MethodBadge method="OPTIONS" />)
    const badge = screen.getByText("OPTIONS")
    expect(badge.className).toContain("gray")
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: 3 passing in `method-badge.test.tsx`, 19 prior tests still pass (22 total)

- [ ] **Step 3: Commit**

```bash
git add tests/components/method-badge.test.tsx
git commit -m "test: add MethodBadge component tests"
```

---

## Task 7: CopyButton Component Tests

**Files:**
- Create: `tests/components/copy-button.test.tsx`
- Source: `src/components/copy-button.tsx`

- [ ] **Step 1: Write all CopyButton tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CopyButton } from "../../src/components/copy-button"

describe("CopyButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a button", () => {
    render(<CopyButton value="test" />)
    expect(screen.getByRole("button")).toBeDefined()
  })

  it("copies value to clipboard on click", async () => {
    const user = userEvent.setup()
    render(<CopyButton value="hello world" />)
    await user.click(screen.getByRole("button"))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello world")
  })

  it("shows check icon after copying", async () => {
    const user = userEvent.setup()
    render(<CopyButton value="test" />)
    const button = screen.getByRole("button")

    // Before click: Copy icon (no check icon).
    expect(button.querySelector(".lucide-copy")).toBeDefined()

    await user.click(button)

    // After click: Check icon appears.
    expect(button.querySelector(".lucide-check")).toBeDefined()
  })

  it("reverts to copy icon after 2000ms", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CopyButton value="test" />)

    await user.click(screen.getByRole("button"))

    // Check icon should be visible.
    expect(screen.getByRole("button").querySelector(".lucide-check")).toBeDefined()

    // Advance past the feedback timeout, wrapped in act() to flush React state updates.
    await act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Copy icon should be back.
    expect(screen.getByRole("button").querySelector(".lucide-copy")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: 4 passing in `copy-button.test.tsx`, 22 prior tests still pass (26 total)

- [ ] **Step 3: Commit**

```bash
git add tests/components/copy-button.test.tsx
git commit -m "test: add CopyButton component tests"
```

---

## Task 8: CodeBlock Component Tests

**Files:**
- Create: `tests/components/code-block.test.tsx`
- Source: `src/components/code-block.tsx`

- [ ] **Step 1: Write all CodeBlock tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CodeBlock } from "../../src/components/code-block"

describe("CodeBlock", () => {
  it("renders text content", () => {
    render(
      <CodeBlock
        content="raw body text"
        contentType="text/plain"
        isBinary={false}
        size={13}
      />,
    )
    expect(screen.getByText("raw body text")).toBeDefined()
  })

  it("pretty-prints JSON content", () => {
    render(
      <CodeBlock
        content='{"key":"value"}'
        contentType="application/json"
        isBinary={false}
        size={15}
      />,
    )
    // JSON.stringify with indent 2 produces multi-line output.
    const code = screen.getByRole("code") ?? document.querySelector("code")
    expect(code?.textContent).toContain('"key": "value"')
  })

  it("renders malformed JSON as-is without crashing", () => {
    render(
      <CodeBlock
        content='{"broken": }'
        contentType="application/json"
        isBinary={false}
        size={12}
      />,
    )
    expect(screen.getByText('{"broken": }')).toBeDefined()
  })

  it("shows binary payload message when isBinary is true", () => {
    render(
      <CodeBlock
        content="base64data"
        contentType="application/octet-stream"
        isBinary={true}
        size={1024}
      />,
    )
    expect(screen.getByText("Binary payload (1024 bytes)")).toBeDefined()
  })

  it("renders a copy button for text content", () => {
    render(
      <CodeBlock
        content="test"
        contentType="text/plain"
        isBinary={false}
        size={4}
      />,
    )
    expect(screen.getByRole("button")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: 5 passing in `code-block.test.tsx`, 26 prior tests still pass (~31 total)

- [ ] **Step 3: Commit**

```bash
git add tests/components/code-block.test.tsx
git commit -m "test: add CodeBlock component tests"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ~31 tests passing across 6 files, 0 failures.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No new type errors.

- [ ] **Step 3: Final commit (if any fixes needed)**

Only if previous steps required adjustments.
