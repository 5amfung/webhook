import { EventEmitter } from "node:events"
import type { WebhookRequest } from "../../src/lib/types"

class WebhookEventBus extends EventEmitter {
  emitWebhook(webhook: WebhookRequest): void {
    this.emit("webhook", webhook)
  }

  emitClear(): void {
    this.emit("clear")
  }
}

export const webhookEventBus = new WebhookEventBus()
