# Webhook Inspector Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local development webhook inspector with a real-time dashboard.

**Architecture:** Nitro API route catches all HTTP methods on `/api/webhook/**`, stores requests in an in-memory Map, and broadcasts via SSE. A single-page TanStack Start dashboard shows live webhook traffic with a shadcn Sheet detail pane.

**Tech Stack:** TanStack Start, React 19, Vite 7, Nitro, shadcn/ui v4, Tailwind v4, React Query

**Spec:** `docs/superpowers/specs/2026-03-22-webhook-inspector-design.md`

---

## File Structure

```
src/
├── lib/
│   ├── utils.ts                          (existing — cn utility)
│   └── types.ts                          (shared WebhookRequest interface)
├── hooks/
│   ├── use-webhook-sse.ts                (SSE client hook)
│   └── use-is-mobile.ts                  (responsive breakpoint hook)
├── components/
│   ├── ui/
│   │   ├── button.tsx                    (existing)
│   │   ├── badge.tsx                     (shadcn — install)
│   │   ├── card.tsx                      (shadcn — install)
│   │   ├── scroll-area.tsx               (shadcn — install)
│   │   ├── separator.tsx                 (shadcn — install)
│   │   ├── sheet.tsx                     (shadcn — install)
│   │   ├── table.tsx                     (shadcn — install)
│   │   ├── tabs.tsx                      (shadcn — install)
│   │   └── tooltip.tsx                   (shadcn — install)
│   ├── webhook-list.tsx                  (main list component)
│   ├── webhook-detail-pane.tsx           (sheet-based detail view)
│   ├── method-badge.tsx                  (color-coded HTTP method badge)
│   ├── code-block.tsx                    (pre-formatted body display)
│   └── copy-button.tsx                   (click-to-copy utility)
├── routes/
│   ├── __root.tsx                        (existing — update title)
│   └── index.tsx                         (existing — replace with dashboard)
├── router.tsx                            (existing — no changes)
└── styles.css                            (existing — no changes)
server/
├── lib/
│   ├── webhook-store.ts                  (in-memory store singleton)
│   └── event-bus.ts                      (EventEmitter singleton)
├── routes/
│   └── api/
│       ├── webhook/
│       │   └── [...].ts                  (catch-all webhook receiver)
│       └── events.ts                     (SSE stream endpoint)
└── functions/
    └── webhooks.ts                       (server functions: getWebhooks, getWebhook, clearWebhooks)
```

---

## Chunk 1: Backend Infrastructure

### Task 1: Install shadcn components

**Files:**
- Modify: `src/components/ui/` (new component files added by CLI)

- [ ] **Step 1: Install all required shadcn components**

Run:
```bash
npx shadcn@latest add badge card scroll-area separator sheet table tabs tooltip
```

- [ ] **Step 2: Verify components installed**

Run:
```bash
ls src/components/ui/
```

Expected: `badge.tsx`, `card.tsx`, `scroll-area.tsx`, `separator.tsx`, `sheet.tsx`, `table.tsx`, `tabs.tsx`, `tooltip.tsx` all present alongside existing `button.tsx`.

- [ ] **Step 3: Verify the app still builds**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "chore: install shadcn components for webhook inspector"
```

---

### Task 2: In-memory webhook store

**Files:**
- Create: `server/lib/webhook-store.ts`
- Create: `src/lib/types.ts` (shared WebhookRequest interface)

- [ ] **Step 1: Create the shared WebhookRequest type**

Create `src/lib/types.ts`:
```ts
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
```

- [ ] **Step 2: Create the in-memory store**

Create `server/lib/webhook-store.ts`:
```ts
import type { WebhookRequest } from "../../src/lib/types"

const MAX_ENTRIES = 500

const store = new Map<string, WebhookRequest>()
const insertionOrder: string[] = []

export function addWebhook(webhook: WebhookRequest): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = insertionOrder.shift()
    if (oldest) store.delete(oldest)
  }
  store.set(webhook.id, webhook)
  insertionOrder.push(webhook.id)
}

export function getWebhook(id: string): WebhookRequest | undefined {
  return store.get(id)
}

export function getAllWebhooks(): WebhookRequest[] {
  return Array.from(store.values()).reverse()
}

export function clearAllWebhooks(): void {
  store.clear()
  insertionOrder.length = 0
}
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts server/lib/webhook-store.ts
git commit -m "feat: add WebhookRequest type and in-memory store"
```

---

### Task 3: Event bus

**Files:**
- Create: `server/lib/event-bus.ts`

- [ ] **Step 1: Create the event bus singleton**

Create `server/lib/event-bus.ts`:
```ts
import { EventEmitter } from "node:events"
import type { WebhookRequest } from "../../src/lib/types"

class WebhookEventBus extends EventEmitter {
  emitWebhook(webhook: WebhookRequest): void {
    this.emit("webhook", webhook)
  }

  emitClear(): void {
    this.emit("clear")
  }
}

export const webhookEventBus = new WebhookEventBus()
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/lib/event-bus.ts
git commit -m "feat: add webhook event bus for SSE broadcasting"
```

---

### Task 4: Webhook receiver (catch-all Nitro route)

**Files:**
- Create: `server/routes/api/webhook/[...].ts`

- [ ] **Step 1: Create the catch-all webhook handler**

Create `server/routes/api/webhook/[...].ts`:
```ts
import { defineEventHandler, getMethod, getRequestURL, getHeaders, readBody } from "h3"
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
  const queryParams: Record<string, string | string[]> = {}
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
          event.node.res.statusCode = 413
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
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test**

Run:
```bash
npm run dev &
sleep 3
curl -X POST http://localhost:3000/api/webhook/test -H "Content-Type: application/json" -d '{"hello":"world"}'
```

Expected: `{"received":true,"id":"<some-uuid>"}`

- [ ] **Step 4: Commit**

```bash
git add server/routes/api/webhook/
git commit -m "feat: add catch-all webhook receiver endpoint"
```

---

### Task 5: SSE stream endpoint

**Files:**
- Create: `server/routes/api/events.ts`

- [ ] **Step 1: Create the SSE handler**

Create `server/routes/api/events.ts`:
```ts
import { defineEventHandler, setResponseHeaders } from "h3"
import { webhookEventBus } from "../../lib/event-bus"
import type { WebhookRequest } from "../../../src/lib/types"

const KEEPALIVE_INTERVAL_MS = 30_000

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })

  const res = event.node.res

  // Send initial connection event.
  res.write("event: connected\ndata: {}\n\n")

  const onWebhook = (webhook: WebhookRequest) => {
    res.write(`event: webhook\ndata: ${JSON.stringify(webhook)}\n\n`)
  }

  const onClear = () => {
    res.write("event: clear\ndata: {}\n\n")
  }

  webhookEventBus.on("webhook", onWebhook)
  webhookEventBus.on("clear", onClear)

  // Keepalive to prevent timeouts.
  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n")
  }, KEEPALIVE_INTERVAL_MS)

  // Cleanup on disconnect.
  event.node.req.on("close", () => {
    webhookEventBus.off("webhook", onWebhook)
    webhookEventBus.off("clear", onClear)
    clearInterval(keepalive)
  })

  // Keep connection open by not ending the response.
  event._handled = true
})
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test — SSE streams events**

With the dev server still running from Task 4:
```bash
# In one terminal, connect to SSE:
curl -N http://localhost:3000/api/events &
SSE_PID=$!
sleep 1

# In another, send a webhook:
curl -X POST http://localhost:3000/api/webhook/sse-test -H "Content-Type: application/json" -d '{"test":true}'

# The SSE curl should output an event like:
# event: webhook
# data: {"id":"...","method":"POST","path":"sse-test",...}

kill $SSE_PID 2>/dev/null
```

Expected: SSE stream receives the webhook event within 1 second of sending.

- [ ] **Step 4: Commit**

```bash
git add server/routes/api/events.ts
git commit -m "feat: add SSE stream endpoint for real-time updates"
```

---

### Task 6: Server functions for dashboard API

**Files:**
- Create: `server/functions/webhooks.ts`

- [ ] **Step 1: Create server functions**

Create `server/functions/webhooks.ts`:
```ts
import { createServerFn } from "@tanstack/react-start"
import {
  getAllWebhooks,
  getWebhook,
  clearAllWebhooks,
} from "../lib/webhook-store"
import { webhookEventBus } from "../lib/event-bus"

export const getWebhooksFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return getAllWebhooks()
  }
)

export const getWebhookFn = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    return getWebhook(id) ?? null
  })

export const clearWebhooksFn = createServerFn({ method: "POST" }).handler(
  async () => {
    clearAllWebhooks()
    webhookEventBus.emitClear()
    return { cleared: true }
  }
)
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/functions/webhooks.ts
git commit -m "feat: add server functions for webhook dashboard API"
```

---

## Chunk 2: Frontend — Components & Dashboard

### Task 7: Utility hooks

**Files:**
- Create: `src/hooks/use-is-mobile.ts`
- Create: `src/hooks/use-webhook-sse.ts`

- [ ] **Step 1: Create useIsMobile hook**

Create `src/hooks/use-is-mobile.ts`:
```ts
import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
```

- [ ] **Step 2: Create useWebhookSSE hook**

Create `src/hooks/use-webhook-sse.ts`:
```ts
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { WebhookRequest } from "@/lib/types"

const WEBHOOKS_QUERY_KEY = ["webhooks"] as const

export function useWebhookSSE(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const eventSource = new EventSource("/api/events")

    eventSource.addEventListener("webhook", (event) => {
      const webhook: WebhookRequest = JSON.parse(event.data)

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
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useIsMobile and useWebhookSSE hooks"
```

---

### Task 8: Small UI components

**Files:**
- Create: `src/components/method-badge.tsx`
- Create: `src/components/code-block.tsx`
- Create: `src/components/copy-button.tsx`

- [ ] **Step 1: Create MethodBadge**

Create `src/components/method-badge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge"

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PATCH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const DEFAULT_COLOR = "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"

export function MethodBadge({ method }: { method: string }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-xs ${METHOD_COLORS[method] ?? DEFAULT_COLOR}`}
    >
      {method}
    </Badge>
  )
}
```

- [ ] **Step 2: Create CodeBlock**

Create `src/components/code-block.tsx`:
```tsx
import { cn } from "@/lib/utils"

interface CodeBlockProps {
  content: string
  contentType: string | null
  isBinary: boolean
  size: number
  className?: string
}

function formatBody(content: string, contentType: string | null): string {
  if (contentType?.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      return content
    }
  }
  return content
}

export function CodeBlock({
  content,
  contentType,
  isBinary,
  size,
  className,
}: CodeBlockProps) {
  if (isBinary) {
    return (
      <div className={cn("text-muted-foreground rounded-md border p-4", className)}>
        Binary payload ({size} bytes)
      </div>
    )
  }

  return (
    <pre
      className={cn(
        "bg-muted overflow-auto rounded-md p-4 text-sm leading-relaxed",
        className
      )}
    >
      <code>{formatBody(content, contentType)}</code>
    </pre>
  )
}
```

- [ ] **Step 3: Create CopyButton**

Create `src/components/copy-button.tsx`:
```tsx
import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

const COPIED_FEEDBACK_MS = 2000

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  return (
    <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </Button>
  )
}
```

- [ ] **Step 4: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/method-badge.tsx src/components/code-block.tsx src/components/copy-button.tsx
git commit -m "feat: add MethodBadge, CodeBlock, and CopyButton components"
```

---

### Task 9: WebhookDetailPane component

**Files:**
- Create: `src/components/webhook-detail-pane.tsx`

- [ ] **Step 1: Create the detail pane component**

Create `src/components/webhook-detail-pane.tsx`:
```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MethodBadge } from "@/components/method-badge"
import { CodeBlock } from "@/components/code-block"
import { CopyButton } from "@/components/copy-button"
import { useIsMobile } from "@/hooks/use-is-mobile"
import type { WebhookRequest } from "@/lib/types"

interface WebhookDetailPaneProps {
  webhook: WebhookRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function KeyValueTable({ data }: { data: Record<string, string | string[]> }) {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">None</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/3">Key</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(([key, value]) => {
          const displayValue = Array.isArray(value) ? value.join(", ") : value
          return (
            <TableRow key={key}>
              <TableCell className="font-mono text-xs">{key}</TableCell>
              <TableCell className="font-mono text-xs">
                <span className="flex items-center gap-1">
                  <span className="truncate">{displayValue}</span>
                  <CopyButton value={displayValue} />
                </span>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function WebhookDetailPane({
  webhook,
  open,
  onOpenChange,
}: WebhookDetailPaneProps) {
  const isMobile = useIsMobile()

  if (!webhook) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "h-[85vh]" : "w-[500px] sm:w-[600px]"}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MethodBadge method={webhook.method} />
            <span className="font-mono text-sm truncate">/{webhook.path}</span>
          </SheetTitle>
          <p className="text-muted-foreground text-xs">
            {formatTimestamp(webhook.timestamp)}
          </p>
        </SheetHeader>

        <Separator />

        <div className="flex items-center gap-2 px-1 py-2">
          <span className="text-muted-foreground text-xs">URL:</span>
          <code className="flex-1 truncate text-xs">{webhook.url}</code>
          <CopyButton value={webhook.url} />
        </div>

        <Separator />

        <Tabs defaultValue="headers" className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="headers" className="flex-1">
              Headers
            </TabsTrigger>
            <TabsTrigger value="params" className="flex-1">
              Params
            </TabsTrigger>
            <TabsTrigger value="body" className="flex-1">
              Body
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100%-3rem)]">
            <TabsContent value="headers" className="mt-0">
              <KeyValueTable data={webhook.headers} />
            </TabsContent>

            <TabsContent value="params" className="mt-0">
              <KeyValueTable data={webhook.queryParams} />
            </TabsContent>

            <TabsContent value="body" className="mt-0 p-2">
              {webhook.body ? (
                <CodeBlock
                  content={webhook.body}
                  contentType={webhook.contentType}
                  isBinary={webhook.isBinary}
                  size={webhook.size}
                />
              ) : (
                <p className="text-muted-foreground py-4 text-sm">
                  No body
                </p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/webhook-detail-pane.tsx
git commit -m "feat: add WebhookDetailPane sheet component"
```

---

### Task 10: WebhookList component

**Files:**
- Create: `src/components/webhook-list.tsx`

- [ ] **Step 1: Create the webhook list component**

Create `src/components/webhook-list.tsx`:
```tsx
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
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground w-16 text-right text-xs">
                    {formatRelativeTime(webhook.timestamp, now)}
                  </span>
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
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/webhook-list.tsx
git commit -m "feat: add WebhookList component with relative timestamps"
```

---

### Task 11: Dashboard page (wire everything together)

**Files:**
- Modify: `src/routes/index.tsx` (replace starter content)
- Modify: `src/routes/__root.tsx` (update page title)

- [ ] **Step 1: Update root route title and add TooltipProvider**

In `src/routes/__root.tsx`:
1. Change the title meta tag from `"TanStack Start Starter"` to `"Webhook Inspector"`
2. Add `TooltipProvider` import and wrap `{children}` in the `RootDocument` body:

```tsx
import { TooltipProvider } from "@/components/ui/tooltip"
// ... existing imports ...

// In RootDocument, wrap children:
<body>
  <TooltipProvider>
    {children}
  </TooltipProvider>
  {/* TanStackDevtools stays outside TooltipProvider */}
  <TanStackDevtools ... />
  <Scripts />
</body>
```

- [ ] **Step 2: Replace index route with dashboard**

Replace `src/routes/index.tsx` with:
```tsx
import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Globe, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Manual end-to-end smoke test**

Run:
```bash
npm run dev &
sleep 3

# Open http://localhost:3000 in browser — should show empty state with endpoint URL.

# Send a test webhook.
curl -X POST http://localhost:3000/api/webhook/stripe/invoice \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_123","type":"invoice.paid","amount":2000}'

# Dashboard should show the new webhook in real-time.
# Click it — detail pane should slide in from right (desktop) or bottom (mobile).
```

- [ ] **Step 5: Stop dev server and run full build**

```bash
# Kill the backgrounded dev server.
kill %1 2>/dev/null

# Full production build to catch SSR issues typecheck misses.
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx src/routes/__root.tsx
git commit -m "feat: add webhook inspector dashboard with real-time updates"
```
