import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/copy-button"

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
      <div
        className={cn(
          "text-muted-foreground rounded-lg border border-border/40 p-4 text-sm",
          className,
        )}
      >
        Binary payload ({size} bytes)
      </div>
    )
  }

  const formatted = formatBody(content, contentType)

  return (
    <div className={cn("relative", className)}>
      <div className="absolute right-2 top-2 z-10">
        <CopyButton value={formatted} />
      </div>
      <pre className="overflow-auto rounded-lg border border-border/40 bg-muted/30 p-4 pr-10 font-mono text-xs leading-relaxed text-foreground/80">
        <code>{formatted}</code>
      </pre>
    </div>
  )
}
