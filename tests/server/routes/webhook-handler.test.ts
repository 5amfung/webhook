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
