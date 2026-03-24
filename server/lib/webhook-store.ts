import type { WebhookRequest } from "../../src/lib/types"

const MAX_WEBHOOKS_PER_SESSION = 100
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours.

interface Session {
  createdAt: number
  lastActivityAt: number
  webhooks: Map<string, WebhookRequest>
  insertionOrder: Array<string>
}

const sessions = new Map<string, Session>()

export function createSession(): string {
  const id = crypto.randomUUID()
  sessions.set(id, {
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    webhooks: new Map(),
    insertionOrder: [],
  })
  return id
}

export function sessionExists(sessionId: string): boolean {
  return sessions.has(sessionId)
}

export function getOrCreateSession(sessionId?: string): string {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!
    session.lastActivityAt = Date.now()
    return sessionId
  }
  return createSession()
}

export function addWebhook(sessionId: string, webhook: WebhookRequest): void {
  const session = sessions.get(sessionId)
  if (!session) return

  if (session.webhooks.size >= MAX_WEBHOOKS_PER_SESSION) {
    const oldest = session.insertionOrder.shift()
    if (oldest) session.webhooks.delete(oldest)
  }

  session.webhooks.set(webhook.id, webhook)
  session.insertionOrder.push(webhook.id)
  session.lastActivityAt = Date.now()
}

export function getWebhook(
  sessionId: string,
  id: string,
): WebhookRequest | undefined {
  return sessions.get(sessionId)?.webhooks.get(id)
}

export function getAllWebhooks(sessionId: string): Array<WebhookRequest> {
  const session = sessions.get(sessionId)
  if (!session) return []
  return Array.from(session.webhooks.values()).reverse()
}

export function clearAllWebhooks(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.webhooks.clear()
  session.insertionOrder.length = 0
  session.lastActivityAt = Date.now()
}

export function cleanExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

export function clearAllSessions(): void {
  sessions.clear()
}

// Test-only helper to manipulate session internals.
export function _getSessionForTest(sessionId: string): Session | undefined {
  return sessions.get(sessionId)
}
