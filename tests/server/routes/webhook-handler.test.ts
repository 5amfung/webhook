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
  event.context.params = { sessionId: sid, _: restPath }
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
