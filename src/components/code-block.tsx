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
