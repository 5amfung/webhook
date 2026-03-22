import { defineEventHandler, createEventStream } from "nitro/h3"
import { webhookEventBus } from "../../lib/event-bus"
import type { WebhookRequest } from "../../../src/lib/types"

const KEEPALIVE_INTERVAL_MS = 30_000

export default defineEventHandler((event) => {
  const eventStream = createEventStream(event)

  // Send initial connection event.
  eventStream.push({ event: "connected", data: "{}" })

  const onWebhook = (webhook: WebhookRequest) => {
    eventStream.push({ event: "webhook", data: JSON.stringify(webhook) })
  }

  const onClear = () => {
    eventStream.push({ event: "clear", data: "{}" })
  }

  webhookEventBus.on("webhook", onWebhook)
  webhookEventBus.on("clear", onClear)

  // Keepalive to prevent proxy/browser timeouts.
  const keepalive = setInterval(() => {
    eventStream.pushComment("keepalive")
  }, KEEPALIVE_INTERVAL_MS)

  // Cleanup on disconnect.
  eventStream.onClosed(() => {
    webhookEventBus.off("webhook", onWebhook)
    webhookEventBus.off("clear", onClear)
    clearInterval(keepalive)
  })

  return eventStream.send()
})
