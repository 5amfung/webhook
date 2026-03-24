import { EventEmitter } from "node:events"
import type { WebhookRequest } from "../../src/lib/types"

class WebhookEventBus extends EventEmitter {
  emitWebhook(sessionId: string, webhook: WebhookRequest): void {
    this.emit(`webhook:${sessionId}`, webhook)
  }

  emitClear(sessionId: string): void {
    this.emit(`clear:${sessionId}`)
  }
}

export const webhookEventBus = new WebhookEventBus()
