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
