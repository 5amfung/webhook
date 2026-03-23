import type { WebhookRequest } from "@/lib/types"
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
import { MethodBadge } from "@/components/method-badge"
import { CodeBlock } from "@/components/code-block"
import { CopyButton } from "@/components/copy-button"
import { useIsMobile } from "@/hooks/use-is-mobile"

interface WebhookDetailPaneProps {
  webhook: WebhookRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function KeyValueTable({ data }: { data: Record<string, string | Array<string>> }) {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground text-sm">None</p>
      </div>
    )
  }

  return (
    <div className="px-1">
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead className="text-muted-foreground w-2/5 text-[10px] font-medium uppercase tracking-widest">
              Key
            </TableHead>
            <TableHead className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest">
              Value
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => {
            const displayValue = Array.isArray(value) ? value.join(", ") : value
            return (
              <TableRow
                key={key}
                className="border-border/20 hover:bg-muted/20"
              >
                <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                  {key}
                </TableCell>
                <TableCell className="py-2 font-mono text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate">
                      {displayValue}
                    </span>
                    <CopyButton value={displayValue} />
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
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
        className={
          isMobile
            ? "h-[85vh] bg-card"
            : "w-[480px] bg-card sm:w-[560px] lg:w-[620px]"
        }
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="px-5 pb-4 pt-5">
            <SheetTitle className="flex items-center gap-2.5">
              <MethodBadge method={webhook.method} />
              <span className="truncate font-mono text-sm font-medium">
                /{webhook.path}
              </span>
            </SheetTitle>
            <p className="text-muted-foreground mt-1 font-mono text-[11px]">
              {formatTimestamp(webhook.timestamp)}
            </p>
          </SheetHeader>

          <div className="mx-5 flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest">
              URL
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs">
              {webhook.url}
            </code>
            <CopyButton value={webhook.url} />
          </div>

          <Tabs defaultValue="headers" className="mt-4 flex flex-1 flex-col">
            <TabsList className="mx-5 w-auto">
              <TabsTrigger value="headers">
                Headers
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                  {Object.keys(webhook.headers).length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="params">
                Params
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                  {Object.keys(webhook.queryParams).length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-4">
              <TabsContent value="headers" className="mt-2">
                <KeyValueTable data={webhook.headers} />
              </TabsContent>

              <TabsContent value="params" className="mt-2">
                <KeyValueTable data={webhook.queryParams} />
              </TabsContent>

              <TabsContent value="body" className="mt-2 px-1">
                {webhook.body ? (
                  <CodeBlock
                    content={webhook.body}
                    contentType={webhook.contentType}
                    isBinary={webhook.isBinary}
                    size={webhook.size}
                  />
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground text-sm">No body</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
