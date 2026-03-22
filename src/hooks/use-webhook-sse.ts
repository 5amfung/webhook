import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { WebhookRequest } from "@/lib/types"

const WEBHOOKS_QUERY_KEY = ["webhooks"] as const

export function useWebhookSSE(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const eventSource = new EventSource("/api/events")

    eventSource.addEventListener("webhook", (event) => {
      let webhook: WebhookRequest
      try {
        webhook = JSON.parse(event.data)
      } catch {
        return
      }

      queryClient.setQueryData<WebhookRequest[]>(
        WEBHOOKS_QUERY_KEY,
        (old = []) => {
          // Deduplicate by id to handle reconnection overlap.
          if (old.some((w) => w.id === webhook.id)) return old
          return [webhook, ...old]
        }
      )
    })

    eventSource.addEventListener("clear", () => {
      queryClient.setQueryData(WEBHOOKS_QUERY_KEY, [])
    })

    return () => eventSource.close()
  }, [queryClient])
}

export { WEBHOOKS_QUERY_KEY }
