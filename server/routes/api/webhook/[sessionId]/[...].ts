import {
  defineEventHandler,
  getHeaders,
  getMethod,
  getRequestURL,
  getRouterParams,
  readRawBody,
  setResponseStatus,
} from "nitro/h3"
import { addWebhook, sessionExists } from "../../../../lib/webhook-store"
import { webhookEventBus } from "../../../../lib/event-bus"
import type { WebhookRequest } from "../../../../../src/lib/types"

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
  const params = getRouterParams(event)
  const sessionId = params.sessionId

  if (!sessionId || !sessionExists(sessionId)) {
    setResponseStatus(event, 404)
    return { error: "Session not found" }
  }

  const method = getMethod(event)
  const requestUrl = getRequestURL(event)
  const headers = getHeaders(event)
  const contentType = headers["content-type"] ?? null

  // Extract the catch-all rest path from router params.
  // Nitro uses "_" as the key for unnamed catch-all segments ([...]).
  const restPath = (params._ as string | undefined) ?? ""
  const path = restPath.replace(/^\//, "") || "/"

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
      const rawBody = await readRawBody(event)
      if (rawBody != null) {
        const bodyStr = rawBody
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

  addWebhook(sessionId, webhook)
  webhookEventBus.emitWebhook(sessionId, webhook)

  return { received: true, id: webhook.id }
})
