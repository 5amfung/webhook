import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { WebhookRequest } from "@/lib/types"

export function webhooksQueryKey(sessionId: string): readonly [string, string] {
  return ["webhooks", sessionId] as const
}

export function useWebhookSSE(sessionId: string | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionId) return

    const queryKey = webhooksQueryKey(sessionId)
    const eventSource = new EventSource(`/api/events/${sessionId}`)

    eventSource.addEventListener("webhook", (event) => {
      let webhook: WebhookRequest
      try {
        webhook = JSON.parse(event.data)
      } catch {
        return
      }

      queryClient.setQueryData<Array<WebhookRequest>>(
        queryKey,
        (old = []) => {
          // Deduplicate by id to handle reconnection overlap.
          if (old.some((w) => w.id === webhook.id)) return old
          return [webhook, ...old]
        },
      )
    })

    eventSource.addEventListener("clear", () => {
      queryClient.setQueryData(queryKey, [])
    })

    return () => eventSource.close()
  }, [queryClient, sessionId])
}
