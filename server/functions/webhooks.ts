import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import {
  clearAllWebhooks,
  getAllWebhooks,
  getOrCreateSession,
  getWebhook,
} from "../lib/webhook-store"
import { webhookEventBus } from "../lib/event-bus"

const COOKIE_NAME = "session_id"

function resolveSession(): string {
  const existing = getCookie(COOKIE_NAME) ?? undefined
  const sessionId = getOrCreateSession(existing)

  // Set cookie if new session was created (different from cookie value).
  if (sessionId !== existing) {
    setCookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    })
  }

  return sessionId
}

export const getSessionFn = createServerFn({ method: "GET" }).handler(() => {
  return resolveSession()
})

export const getWebhooksFn = createServerFn({ method: "GET" }).handler(() => {
  const sessionId = resolveSession()
  return getAllWebhooks(sessionId)
})

export const getWebhookFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(({ data: id }) => {
    const sessionId = resolveSession()
    return getWebhook(sessionId, id) ?? null
  })

export const clearWebhooksFn = createServerFn({ method: "POST" }).handler(
  () => {
    const sessionId = resolveSession()
    clearAllWebhooks(sessionId)
    webhookEventBus.emitClear(sessionId)
    return { cleared: true }
  },
)
