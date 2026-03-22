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
    // The base-ui onOpenChange passes eventDetails as a second arg, so we wrap to match our simpler signature.
    <Sheet open={open} onOpenChange={(isOpen) => onOpenChange(isOpen)}>
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
