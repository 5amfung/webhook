import { createServerFn } from "@tanstack/react-start"
import {
  clearAllWebhooks,
  getAllWebhooks,
  getWebhook,
} from "../lib/webhook-store"
import { webhookEventBus } from "../lib/event-bus"

export const getWebhooksFn = createServerFn({ method: "GET" }).handler(() => {
  return getAllWebhooks()
})

export const getWebhookFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(({ data: id }) => {
    return getWebhook(id) ?? null
  })

export const clearWebhooksFn = createServerFn({ method: "POST" }).handler(
  () => {
    clearAllWebhooks()
    webhookEventBus.emitClear()
    return { cleared: true }
  }
)
