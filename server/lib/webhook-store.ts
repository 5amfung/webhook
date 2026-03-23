import type { WebhookRequest } from "../../src/lib/types"

const MAX_ENTRIES = 500

const store = new Map<string, WebhookRequest>()
const insertionOrder: Array<string> = []

export function addWebhook(webhook: WebhookRequest): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = insertionOrder.shift()
    if (oldest) store.delete(oldest)
  }
  store.set(webhook.id, webhook)
  insertionOrder.push(webhook.id)
}

export function getWebhook(id: string): WebhookRequest | undefined {
  return store.get(id)
}

export function getAllWebhooks(): Array<WebhookRequest> {
  return Array.from(store.values()).reverse()
}

export function clearAllWebhooks(): void {
  store.clear()
  insertionOrder.length = 0
}
