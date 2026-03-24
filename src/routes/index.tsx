import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Radio, Terminal, Trash2, Zap } from "lucide-react"
import {
  clearWebhooksFn,
  getSessionFn,
  getWebhooksFn,
} from "../../server/functions/webhooks"
import type { WebhookRequest } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { WebhookList } from "@/components/webhook-list"
import { WebhookDetailPane } from "@/components/webhook-detail-pane"
import { CopyButton } from "@/components/copy-button"
import { useWebhookSSE, webhooksQueryKey } from "@/hooks/use-webhook-sse"

export const Route = createFileRoute("/")({
  component: Dashboard,
})

function buildCurlCommand(baseUrl: string): string {
  return [
    `curl -X POST ${baseUrl}test \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"hello":"world"}'`,
  ].join("\n")
}

function Dashboard() {
  const [selectedWebhook, setSelectedWebhook] =
    useState<WebhookRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Resolve session on mount.
  useEffect(() => {
    getSessionFn().then(setSessionId)
  }, [])

  const queryKey = sessionId ? webhooksQueryKey(sessionId) : ["webhooks", ""]

  const { data: webhooks = [] } = useQuery({
    queryKey,
    queryFn: () => getWebhooksFn(),
    enabled: !!sessionId,
  })

  useWebhookSSE(sessionId)

  const handleSelect = (webhook: WebhookRequest) => {
    setSelectedWebhook(webhook)
    setDetailOpen(true)
  }

  const queryClient = useQueryClient()

  const handleClear = async () => {
    // Optimistically clear the cache before the SSE event arrives.
    queryClient.setQueryData(queryKey, [])
    setSelectedWebhook(null)
    setDetailOpen(false)
    await clearWebhooksFn()
  }

  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    if (sessionId) {
      setWebhookUrl(`${window.location.origin}/api/webhook/${sessionId}/`)
    }
  }, [sessionId])

  const curlCommand = buildCurlCommand(webhookUrl)

  return (
    <div className="flex h-svh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 flex size-8 items-center justify-center rounded-lg">
              <Radio className="text-primary size-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Webhook Inspector
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="status-dot size-1.5 rounded-full bg-emerald-400" />
                <span className="text-muted-foreground text-[10px] uppercase tracking-widest">
                  Listening
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {webhooks.length > 0 && (
            <>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {webhooks.length} request{webhooks.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Endpoint bar */}
      <div className="flex items-center gap-3 border-b border-border/50 px-5 py-2.5">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest">
          Endpoint
        </span>
        <div className="bg-muted/50 flex flex-1 items-center gap-2 rounded-md border border-border/50 px-3 py-1.5">
          <Zap className="text-primary size-3 shrink-0" />
          <code className="flex-1 truncate font-mono text-xs font-medium">
            {webhookUrl || "Loading..."}
          </code>
          <CopyButton value={webhookUrl} />
        </div>
      </div>

      {/* Main content */}
      {webhooks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-card">
              <Radio className="text-primary size-8" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-base font-medium tracking-tight">
              Waiting for webhooks
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Send a request to the endpoint above to get started
            </p>
          </div>
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border/50 bg-card px-4 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="text-muted-foreground size-3.5" />
                <span className="text-muted-foreground text-xs font-medium">
                  Quick start
                </span>
              </div>
              <CopyButton value={curlCommand} />
            </div>
            <pre className="overflow-x-auto rounded-b-lg border border-border/50 bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed text-foreground/80">
              {curlCommand}
            </pre>
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
