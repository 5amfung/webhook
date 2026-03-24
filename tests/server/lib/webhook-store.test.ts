import { beforeEach, describe, expect, it } from "vitest"
import {
  addWebhook,
  clearAllWebhooks,
  cleanExpiredSessions,
  createSession,
  getAllWebhooks,
  getOrCreateSession,
  getWebhook,
  sessionExists,
  clearAllSessions,
  _getSessionForTest,
} from "../../../server/lib/webhook-store"
import { createWebhookFixture } from "../../helpers/webhook-factory"

describe("webhook-store", () => {
  beforeEach(() => {
    clearAllSessions()
  })

  describe("getOrCreateSession", () => {
    it("returns the same sessionId when the session exists", () => {
      const sessionId = createSession()
      const result = getOrCreateSession(sessionId)
      expect(result).toBe(sessionId)
    })

    it("creates a new session when sessionId is undefined", () => {
      const result = getOrCreateSession(undefined)
      expect(sessionExists(result)).toBe(true)
    })

    it("creates a new session when sessionId is not in the store", () => {
      const result = getOrCreateSession("nonexistent-session-id")
      expect(result).not.toBe("nonexistent-session-id")
      expect(sessionExists(result)).toBe(true)
    })

    it("updates lastActivityAt on access to an existing session", async () => {
      const sessionId = createSession()
      const session = _getSessionForTest(sessionId)!
      const originalActivity = session.lastActivityAt

      // Ensure enough time passes so the timestamp changes.
      await new Promise((resolve) => setTimeout(resolve, 5))
      getOrCreateSession(sessionId)

      expect(session.lastActivityAt).toBeGreaterThan(originalActivity)
    })
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
      const sessionId = createSession()
      addWebhook(sessionId, createWebhookFixture())

      const session = _getSessionForTest(sessionId)!
      session.lastActivityAt = Date.now() - 25 * 60 * 60 * 1000

      cleanExpiredSessions()

      expect(sessionExists(sessionId)).toBe(false)
    })
  })
})
