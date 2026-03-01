"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, Eye } from "lucide-react"

import type { BatchSummary } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BatchViewerSheet } from "@/components/batch-viewer/batch-viewer-sheet"

const PAGE_SIZE = 10

export function BatchesTable({ batches }: { batches: BatchSummary[] }) {
  const [page, setPage] = useState(1)
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = batches.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch ID</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Total Claims</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Duplicate</TableHead>
              <TableHead>NCPDP</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No batches found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-mono text-xs">
                    {batch.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    {batch.submittedAt
                      ? format(new Date(batch.submittedAt), "MMM d, yyyy h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {batch.totalClaims}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {batch.paidCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {batch.rejectedCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {batch.duplicateCount}
                  </TableCell>
                  <TableCell>
                    {batch.hasNcpdpData ? (
                      <Badge variant="secondary">Available</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={!batch.hasNcpdpData}
                      onClick={() => setViewingBatchId(batch.id)}
                      aria-label="View NCPDP"
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{batches.length} batch(es)</span>
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

      <BatchViewerSheet
        batchId={viewingBatchId}
        open={viewingBatchId !== null}
        onOpenChange={(open) => {
          if (!open) setViewingBatchId(null)
        }}
      />
    </div>
  )
}
