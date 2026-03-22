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
