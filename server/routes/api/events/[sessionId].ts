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
