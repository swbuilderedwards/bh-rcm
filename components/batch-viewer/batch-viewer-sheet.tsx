"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { NcpdpRawView } from "./ncpdp-raw-view"
import { RecordSegmentsView } from "./ncpdp-parsed-view"
import {
  RecordListView,
  flattenRecords,
  type FlatRecord,
} from "./record-list-view"

interface RawData {
  requestBody: string
  responseBody: string | null
}

interface ParsedData {
  requestParsed?: { transmissions: Record<string, unknown>[] }
  responseParsed?: { transmissions: Record<string, unknown>[] }
  requestParseError?: string
  responseParseError?: string
}

/**
 * Split raw NCPDP batch text into per-transmission chunks.
 * Each transmission starts at an STX (\x02) and extends to the next STX
 * (exclusive) or end of string. NCPDP batch files are line-based and do
 * not use ETX (\x03) as a delimiter.
 */
function splitRawTransmissions(raw: string): string[] {
  const chunks: string[] = []
  let start = raw.indexOf("\x02")
  while (start !== -1) {
    const next = raw.indexOf("\x02", start + 1)
    chunks.push(next === -1 ? raw.slice(start) : raw.slice(start, next))
    start = next
  }
  return chunks
}

interface ParsedTransmission {
  segments?: { segment_identification: string }[]
  transactions?: { segments?: { segment_identification: string }[] }[]
}

/**
 * Extract the raw text for a single record from the full batch body.
 *
 * When a transmission has multiple transactions, the raw text is split using
 * segment counts from the parsed data: header + shared segments come first,
 * then each transaction's segments follow in order.
 */
function extractRecordRawText(
  fullRawBody: string,
  record: FlatRecord,
  transmissions?: Record<string, unknown>[],
): string | null {
  const rawTransmissions = splitRawTransmissions(fullRawBody)
  const rawTx = rawTransmissions[record.transmissionIndex]
  if (!rawTx) return null

  // No sub-transactions — the whole transmission IS this record
  if (record.transactionIndexInTransmission < 0) return rawTx

  const parsedTx = transmissions?.[record.transmissionIndex] as
    | ParsedTransmission
    | undefined
  if (!parsedTx?.transactions?.length) return rawTx

  // Strip STX/ETX wrappers so we can work with the inner content
  let text = rawTx
  const hasStx = text.startsWith("\x02")
  const hasEtx = text.endsWith("\x03")
  if (hasStx) text = text.slice(1)
  if (hasEtx) text = text.slice(0, -1)

  // Split into header (before first GS) + GS-delimited segments
  const parts = text.split("\x1D")
  const headerPart = parts[0]
  const segmentParts = parts.slice(1)

  const sharedCount = parsedTx.segments?.length ?? 0

  // Find the start offset for the target transaction's segments
  let txStart = sharedCount
  for (let i = 0; i < record.transactionIndexInTransmission; i++) {
    txStart += parsedTx.transactions[i]?.segments?.length ?? 0
  }
  const txSegCount =
    parsedTx.transactions[record.transactionIndexInTransmission]?.segments
      ?.length ?? 0

  // Bounds check — fall back to the full transmission if counts don't line up
  if (txStart + txSegCount > segmentParts.length) return rawTx

  const sharedSegments = segmentParts.slice(0, sharedCount)
  const txSegments = segmentParts.slice(txStart, txStart + txSegCount)

  const combined = [headerPart, ...sharedSegments, ...txSegments].join("\x1D")
  return (hasStx ? "\x02" : "") + combined + (hasEtx ? "\x03" : "")
}

export function BatchViewerSheet({
  batchId,
  open,
  onOpenChange,
}: {
  batchId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [rawData, setRawData] = useState<RawData | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null)
  const records: FlatRecord[] = parsedData?.requestParsed
    ? flattenRecords(
        parsedData.requestParsed.transmissions as Parameters<
          typeof flattenRecords
        >[0],
      )
    : []

  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setRawData(null)
    setParsedData(null)
    setSelectedRecord(null)
    try {
      const [rawResp, parsedResp] = await Promise.all([
        fetch(`/api/batches/${id}/ncpdp?view=raw`),
        fetch(`/api/batches/${id}/ncpdp?view=parsed`),
      ])

      if (!rawResp.ok) {
        const body = await rawResp.json().catch(() => null)
        throw new Error(body?.error ?? `Failed to load (${rawResp.status})`)
      }

      setRawData(await rawResp.json())

      if (parsedResp.ok) {
        setParsedData(await parsedResp.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && batchId) {
      fetchData(batchId)
    }
  }, [open, batchId, fetchData])

  const selected = selectedRecord !== null ? records[selectedRecord] : null

  const selectedRawText =
    selected && rawData
      ? extractRecordRawText(
          rawData.requestBody,
          selected,
          parsedData?.requestParsed?.transmissions,
        )
      : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">
            Batch {batchId?.slice(0, 8)}...
          </SheetTitle>
          <SheetDescription>
            {selected
              ? `Record ${selectedRecord! + 1} of ${records.length}`
              : `${records.length} record(s)`}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {/* Record list */}
        {!loading && !error && records.length > 0 && selectedRecord === null && (
          <div className="px-4 pb-4">
            <RecordListView
              records={records}
              onSelectRecord={setSelectedRecord}
            />
          </div>
        )}

        {/* Parse error fallback — show raw */}
        {!loading &&
          !error &&
          records.length === 0 &&
          rawData &&
          parsedData?.requestParseError && (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="text-sm text-muted-foreground">
                {parsedData.requestParseError}
              </div>
              <NcpdpRawView text={rawData.requestBody} />
            </div>
          )}

        {/* Record detail */}
        {selected && (
          <div className="flex flex-col gap-4 px-4 pb-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setSelectedRecord(null)}
            >
              <ArrowLeft className="size-4 mr-1" />
              Back to list
            </Button>

            {selectedRawText && <NcpdpRawView text={selectedRawText} />}

            <RecordSegmentsView
              segments={selected.segments}
              header={selected.header}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
