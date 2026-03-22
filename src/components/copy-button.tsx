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
