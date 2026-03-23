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
