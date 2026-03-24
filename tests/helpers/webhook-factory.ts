import type { WebhookRequest } from "../../src/lib/types"

export const TEST_SESSION_ID = "test-session-00000000"

let counter = 0

export function createWebhookFixture(
  overrides: Partial<WebhookRequest> = {},
): WebhookRequest {
  counter++
  return {
    id: overrides.id ?? `test-id-${counter}`,
    timestamp: overrides.timestamp ?? Date.now(),
    method: "POST",
    path: "/test",
    url: "http://localhost/api/webhook/test",
    queryParams: {},
    headers: { "content-type": "application/json" },
    body: '{"test": true}',
    contentType: "application/json",
    isBinary: false,
    size: 14,
    ...overrides,
  }
}

export function resetFixtureCounter(): void {
  counter = 0
}
