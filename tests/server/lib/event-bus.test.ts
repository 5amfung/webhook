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
