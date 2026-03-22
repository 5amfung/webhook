export interface WebhookRequest {
  id: string
  timestamp: number
  method: string
  path: string
  url: string
  queryParams: Record<string, string | string[]>
  headers: Record<string, string>
  body: string | null
  contentType: string | null
  isBinary: boolean
  size: number
}
