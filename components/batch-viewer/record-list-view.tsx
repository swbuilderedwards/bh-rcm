"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Segment {
  segment_identification: string
  [key: string]: unknown
}

interface Transaction {
  segments: Segment[]
  [key: string]: unknown
}

interface Transmission {
  header?: Record<string, unknown>
  segments?: Segment[]
  transactions?: Transaction[]
}

export interface FlatRecord {
  index: number
  transmissionIndex: number
  segments: Segment[]
  header?: Record<string, unknown>
}

const PAGE_SIZE = 100

function getField(
  segments: Segment[],
  segId: string,
  ...fieldNames: string[]
): string {
  const seg = segments.find((s) => s.segment_identification === segId)
  if (!seg) return "—"
  for (const name of fieldNames) {
    const val = seg[name]
    if (val != null && val !== "") return String(val)
  }
  return "—"
}

function getPatientName(segments: Segment[]): string {
  const seg = segments.find((s) => s.segment_identification === "01")
  if (!seg) return "—"
  const first = seg.patient_first_name ?? seg.first_name ?? ""
  const last = seg.patient_last_name ?? seg.last_name ?? ""
  const name = `${first} ${last}`.trim()
  return name || "—"
}

export function flattenRecords(transmissions: Transmission[]): FlatRecord[] {
  const records: FlatRecord[] = []
  for (let txIdx = 0; txIdx < transmissions.length; txIdx++) {
    const tx = transmissions[txIdx]
    const txSegments = tx.segments ?? []
    const transactions = tx.transactions ?? []
    if (transactions.length === 0) {
      if (txSegments.length) {
        records.push({
          index: records.length,
          transmissionIndex: txIdx,
          segments: txSegments,
          header: tx.header,
        })
      }
    } else {
      for (const t of transactions) {
        // Merge transmission-level segments (patient, insurance) with
        // transaction-level segments (claim, pricing) so lookups work
        records.push({
          index: records.length,
          transmissionIndex: txIdx,
          segments: [...txSegments, ...(t.segments ?? [])],
          header: tx.header,
        })
      }
    }
  }
  return records
}

export function RecordListView({
  records,
  onSelectRecord,
}: {
  records: FlatRecord[]
  onSelectRecord: (index: number) => void
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = records.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Cardholder ID</TableHead>
              <TableHead>RX #</TableHead>
              <TableHead>Date of Service</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((rec) => (
                <TableRow
                  key={rec.index}
                  className="cursor-pointer"
                  onClick={() => onSelectRecord(rec.index)}
                >
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {rec.index + 1}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getPatientName(rec.segments)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {getField(rec.segments, "04", "cardholder_id")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {getField(
                      rec.segments,
                      "07",
                      "prescription_service_reference_number",
                      "prescription_reference_number",
                    )}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {rec.header?.date_of_service
                      ? String(rec.header.date_of_service)
                      : getField(rec.segments, "07", "date_of_service", "date_prescription_written")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, records.length)} of{" "}
            {records.length}
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
      )}
    </div>
  )
}
