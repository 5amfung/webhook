import { beforeEach, describe, expect, it } from "vitest"
import { mockEvent } from "h3"
import handler from "../../../server/routes/api/events/[sessionId]"
import { clearAllSessions } from "../../../server/lib/webhook-store"

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
