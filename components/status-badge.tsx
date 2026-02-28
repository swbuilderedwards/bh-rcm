import { Badge } from "@/components/ui/badge"
import type { ClaimStatus } from "@/lib/data"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  ClaimStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100",
  },
  submitted: {
    label: "Submitted",
    className:
      "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-100",
  },
  paid: {
    label: "Paid",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
  },
  duplicate: {
    label: "Duplicate",
    className:
      "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-100",
  },
}

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}
