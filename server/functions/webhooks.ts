import { createServerFn } from "@tanstack/react-start"
import {
  getAllWebhooks,
  getWebhook,
  clearAllWebhooks,
} from "../lib/webhook-store"
import { webhookEventBus } from "../lib/event-bus"

export const getWebhooksFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return getAllWebhooks()
  }
)

export const getWebhookFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    return getWebhook(id) ?? null
  })

export const clearWebhooksFn = createServerFn({ method: "POST" }).handler(
  async () => {
    clearAllWebhooks()
    webhookEventBus.emitClear()
    return { cleared: true }
  }
)
