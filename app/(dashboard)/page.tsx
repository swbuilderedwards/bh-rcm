import {
  Users,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Copy,
  Percent,
  DollarSign,
} from "lucide-react"
import { getDashboardMetrics } from "@/lib/supabase/queries"
import { MetricCard } from "@/components/metric-card"
import { PageHeader } from "@/components/page-header"

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue cycle management overview
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Enrollments"
            value={metrics.total}
            icon={<Users className="size-4" />}
          />
          <MetricCard
            title="Pending Claims"
            value={metrics.pending}
            icon={<Clock className="size-4" />}
            accentClassName="text-amber-500"
          />
          <MetricCard
            title="Submitted Claims"
            value={metrics.submitted}
            icon={<Send className="size-4" />}
            accentClassName="text-sky-500"
          />
          <MetricCard
            title="Paid Claims"
            value={metrics.paid}
            icon={<CheckCircle2 className="size-4" />}
            accentClassName="text-emerald-500"
          />
          <MetricCard
            title="Rejected Claims"
            value={metrics.rejected}
            icon={<XCircle className="size-4" />}
            accentClassName="text-red-500"
          />
          <MetricCard
            title="Duplicate Claims"
            value={metrics.duplicate}
            icon={<Copy className="size-4" />}
            accentClassName="text-zinc-400"
          />
          <MetricCard
            title="Paid Rate"
            value={`${metrics.paidRate}%`}
            icon={<Percent className="size-4" />}
            accentClassName="text-emerald-500"
          />
          <MetricCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="size-4" />}
            accentClassName="text-emerald-500"
          />
        </div>
      </div>
    </>
  )
}
