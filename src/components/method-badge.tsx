import { cn } from "@/lib/utils"

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  PATCH: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  DELETE: "bg-red-500/15 text-red-400 ring-red-500/20",
}

const DEFAULT_STYLE = "bg-gray-500/15 text-gray-400 ring-gray-500/20"

export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide ring-1 ring-inset",
        METHOD_STYLES[method] ?? DEFAULT_STYLE,
      )}
    >
      {method}
    </span>
  )
}
