import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Globe, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WebhookList } from "@/components/webhook-list"
import { WebhookDetailPane } from "@/components/webhook-detail-pane"
import { CopyButton } from "@/components/copy-button"
import { useWebhookSSE, WEBHOOKS_QUERY_KEY } from "@/hooks/use-webhook-sse"
import { getWebhooksFn, clearWebhooksFn } from "../../server/functions/webhooks"
import type { WebhookRequest } from "@/lib/types"

export const Route = createFileRoute("/")({
  component: Dashboard,
})

function Dashboard() {
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: webhooks = [] } = useQuery({
    queryKey: WEBHOOKS_QUERY_KEY,
    queryFn: () => getWebhooksFn(),
  })

  useWebhookSSE()

  const handleSelect = (webhook: WebhookRequest) => {
    setSelectedWebhook(webhook)
    setDetailOpen(true)
  }

  const handleClear = async () => {
    await clearWebhooksFn()
    setSelectedWebhook(null)
    setDetailOpen(false)
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook/`
      : "/api/webhook/"

  return (
    <div className="flex h-svh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="text-muted-foreground size-5" />
          <h1 className="text-lg font-semibold">Webhook Inspector</h1>
        </div>
        {webhooks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="size-4" />
            Clear All
          </Button>
        )}
      </header>

      {/* Webhook URL bar */}
      <div className="bg-muted/30 flex items-center gap-2 border-b px-4 py-2">
        <span className="text-muted-foreground text-xs">Endpoint:</span>
        <code className="flex-1 truncate text-sm font-medium">{webhookUrl}</code>
        <CopyButton value={webhookUrl} />
      </div>

      {/* Main content */}
      {webhooks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <Globe className="text-muted-foreground/50 size-16" />
          <div className="text-center">
            <p className="text-lg font-medium">No webhooks received yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Send a request to the endpoint above to get started
            </p>
          </div>
          <div className="bg-muted mt-4 max-w-lg rounded-md p-3">
            <p className="text-muted-foreground mb-1 text-xs">Try it:</p>
            <code className="text-xs">
              curl -X POST {webhookUrl}test -H &quot;Content-Type: application/json&quot; -d
              &apos;{`{"hello":"world"}`}&apos;
            </code>
          </div>
        </div>
      ) : (
        <WebhookList
          webhooks={webhooks}
          onSelect={handleSelect}
          selectedId={selectedWebhook?.id ?? null}
        />
      )}

      {/* Detail pane */}
      <WebhookDetailPane
        webhook={selectedWebhook}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
