import { EventEmitter } from "node:events"
import type { WebhookRequest } from "../../src/lib/types"

// Each SSE connection registers 2 listeners (webhook + clear).
// Allow up to 50 concurrent connections before warning.
const MAX_LISTENERS = 100

class WebhookEventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(MAX_LISTENERS)
  }

  emitWebhook(sessionId: string, webhook: WebhookRequest): void {
    this.emit(`webhook:${sessionId}`, webhook)
  }

  emitClear(sessionId: string): void {
    this.emit(`clear:${sessionId}`)
  }
}

export const webhookEventBus = new WebhookEventBus()
