import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MethodBadge } from "@/components/method-badge"
import type { WebhookRequest } from "@/lib/types"

const TIMESTAMP_REFRESH_MS = 5000

function formatRelativeTime(timestamp: number, now: number): string {
  const diffSeconds = Math.floor((now - timestamp) / 1000)
  if (diffSeconds < 5) return "just now"
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return new Date(timestamp).toLocaleDateString()
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ""
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

interface WebhookListProps {
  webhooks: WebhookRequest[]
  onSelect: (webhook: WebhookRequest) => void
  selectedId: string | null
}

export function WebhookList({
  webhooks,
  onSelect,
  selectedId,
}: WebhookListProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TIMESTAMP_REFRESH_MS)
    return () => clearInterval(interval)
  }, [])

  if (webhooks.length === 0) return null

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2 p-1">
        {webhooks.map((webhook) => (
          <Card
            key={webhook.id}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedId === webhook.id ? "border-primary/50 bg-muted/30" : ""
            }`}
            onClick={() => onSelect(webhook)}
          >
            <CardContent className="flex items-center gap-3 p-3">
              <MethodBadge method={webhook.method} />
              <span className="flex-1 truncate font-mono text-sm">
                /{webhook.path}
              </span>
              {webhook.contentType && (
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {webhook.contentType.split(";")[0]}
                </span>
              )}
              {webhook.size > 0 && (
                <span className="text-muted-foreground text-xs">
                  {formatSize(webhook.size)}
                </span>
              )}
              <Tooltip>
                {/* Use render prop to avoid a nested button, since the card is already clickable. */}
                <TooltipTrigger
                  render={<span />}
                  className="text-muted-foreground w-16 text-right text-xs"
                >
                  {formatRelativeTime(webhook.timestamp, now)}
                </TooltipTrigger>
                <TooltipContent>
                  {new Date(webhook.timestamp).toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
