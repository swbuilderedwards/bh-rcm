"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Send, X } from "lucide-react"

import type { Enrollment, ClaimStatus, Product } from "@/lib/data"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const PAGE_SIZE = 100

type SortKey =
  | "patientName"
  | "product"
  | "organization"
  | "enrolledDate"
  | "billingPointDate"
  | "status"
  | "attempts"
type SortDir = "asc" | "desc"

function compareEnrollments(a: Enrollment, b: Enrollment, key: SortKey): number {
  switch (key) {
    case "attempts":
      return a.attempts - b.attempts
    case "enrolledDate":
    case "billingPointDate":
      return a[key].localeCompare(b[key])
    default:
      return a[key].localeCompare(b[key])
  }
}

const ALL_PRODUCTS: Product[] = ["Sleepio", "Daylight", "Spark"]
const ALL_STATUSES: ClaimStatus[] = [
  "pending",
  "submitted",
  "paid",
  "rejected",
  "duplicate",
]

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {label}
          {selected.size > 0 && (
            <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
              {selected.size}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="flex flex-col gap-1">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox checked={selected.has(option)} tabIndex={-1} />
              <span className="capitalize">{option}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SortableHead({
  column,
  current,
  dir,
  onSort,
  className,
  children,
}: {
  column: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
  children: React.ReactNode
}) {
  const active = current === column
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-foreground -ml-2 px-2 py-1 rounded-sm hover:bg-accent transition-colors"
      >
        {children}
        <Icon className={`size-3.5 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </TableHead>
  )
}

export function EnrollmentsTable({
  enrollments,
}: {
  enrollments: Enrollment[]
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [productFilter, setProductFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>("patientName")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const result = enrollments.filter((e) => {
      if (productFilter.size > 0 && !productFilter.has(e.product)) return false
      if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false
      return true
    })
    result.sort((a, b) => {
      const cmp = compareEnrollments(a, b, sortKey)
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [enrollments, productFilter, statusFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const allSelected =
    paginated.length > 0 && paginated.every((e) => selectedIds.has(e.id))
  const someSelected =
    !allSelected && paginated.some((e) => selectedIds.has(e.id))

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds)
      paginated.forEach((e) => next.delete(e.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      paginated.forEach((e) => next.add(e.id))
      setSelectedIds(next)
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  function toggleFilter(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    value: string
  ) {
    const next = new Set(set)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setter(next)
    setPage(1)
  }

  async function handleSubmitClaims() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/claims/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentIds: [...selectedIds] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? "Submission failed")
      }
      setSelectedIds(new Set())
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Product"
          options={ALL_PRODUCTS}
          selected={productFilter}
          onToggle={(v) => toggleFilter(productFilter, setProductFilter, v)}
        />
        <MultiSelectFilter
          label="Status"
          options={ALL_STATUSES}
          selected={statusFilter}
          onToggle={(v) => toggleFilter(statusFilter, setStatusFilter, v)}
        />
        <div className="flex-1" />
        {selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="size-3.5" />
            Clear selection
          </Button>
        )}
        <Button
          size="sm"
          disabled={selectedIds.size === 0 || submitting}
          onClick={handleSubmitClaims}
          className="gap-1.5"
        >
          <Send className="size-3.5" />
          {submitting ? "Submitting..." : "Submit Claims"}
          {!submitting && selectedIds.size > 0 && (
            <span className="ml-0.5 text-xs opacity-80">
              ({selectedIds.size})
            </span>
          )}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all on this page"
                />
              </TableHead>
              <SortableHead current={sortKey} dir={sortDir} column="patientName" onSort={toggleSort}>Patient Name</SortableHead>
              <SortableHead current={sortKey} dir={sortDir} column="product" onSort={toggleSort}>Product</SortableHead>
              <SortableHead current={sortKey} dir={sortDir} column="organization" onSort={toggleSort}>Organization</SortableHead>
              <SortableHead current={sortKey} dir={sortDir} column="enrolledDate" onSort={toggleSort}>Enrolled Date</SortableHead>
              <SortableHead current={sortKey} dir={sortDir} column="billingPointDate" onSort={toggleSort}>Billing Point</SortableHead>
              <SortableHead current={sortKey} dir={sortDir} column="status" onSort={toggleSort}>Status</SortableHead>
              <SortableHead current={sortKey} dir={sortDir} column="attempts" onSort={toggleSort} className="text-right">Attempts</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No enrollments found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((enrollment) => (
                <TableRow
                  key={enrollment.id}
                  data-state={
                    selectedIds.has(enrollment.id) ? "selected" : undefined
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(enrollment.id)}
                      onCheckedChange={() => toggleOne(enrollment.id)}
                      aria-label={`Select ${enrollment.patientName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/enrollments/${enrollment.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {enrollment.patientName}
                    </Link>
                  </TableCell>
                  <TableCell>{enrollment.product}</TableCell>
                  <TableCell>{enrollment.organization}</TableCell>
                  <TableCell>
                    {format(new Date(enrollment.enrolledDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(
                      new Date(enrollment.billingPointDate),
                      "MMM d, yyyy"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={enrollment.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {enrollment.attempts}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {selectedIds.size > 0
            ? `${selectedIds.size} of ${filtered.length} row(s) selected`
            : `${filtered.length} enrollment(s)`}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
