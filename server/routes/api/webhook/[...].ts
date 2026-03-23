import { defineEventHandler, getHeaders, getMethod, getRequestURL, readBody, setResponseStatus } from "nitro/h3"
import { addWebhook } from "../../../lib/webhook-store"
import { webhookEventBus } from "../../../lib/event-bus"
import type { WebhookRequest } from "../../../../src/lib/types"

const MAX_BODY_SIZE = 1024 * 1024 // 1MB.

const TEXT_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
]

function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return true
  return TEXT_CONTENT_TYPES.some((type) => contentType.includes(type))
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  const requestUrl = getRequestURL(event)
  const headers = getHeaders(event)
  const contentType = headers["content-type"] ?? null

  // Extract path after /api/webhook/.
  const fullPath = requestUrl.pathname
  const path = fullPath.replace(/^\/api\/webhook\/?/, "") || "/"

  // Parse query params.
  const queryParams: Record<string, string | Array<string>> = {}
  requestUrl.searchParams.forEach((value, key) => {
    const existing = queryParams[key]
    if (existing) {
      queryParams[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value]
    } else {
      queryParams[key] = value
    }
  })

  // Read body.
  let body: string | null = null
  let isBinary = false
  let size = 0

  if (method !== "GET" && method !== "HEAD") {
    try {
      const rawBody = await readBody(event)
      if (rawBody != null) {
        const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody)
        size = new TextEncoder().encode(bodyStr).length

        if (size > MAX_BODY_SIZE) {
          setResponseStatus(event, 413)
          return { error: "Payload too large", maxSize: "1MB" }
        }

        if (isTextContentType(contentType)) {
          body = bodyStr
        } else {
          body = Buffer.from(bodyStr).toString("base64")
          isBinary = true
        }
      }
    } catch {
      body = null
    }
  }

  const webhook: WebhookRequest = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    method,
    path,
    url: requestUrl.href,
    queryParams,
    headers: { ...headers },
    body,
    contentType,
    isBinary,
    size,
  }

  addWebhook(webhook)
  webhookEventBus.emitWebhook(webhook)

  return { received: true, id: webhook.id }
})
