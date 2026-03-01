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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type ViewMode = "raw" | "formatted"

/**
 * Split raw NCPDP batch text into per-transmission chunks.
 * Each transmission is delimited by STX (\x02) ... ETX (\x03).
 */
function splitRawTransmissions(raw: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < raw.length) {
    const stxIdx = raw.indexOf("\x02", i)
    if (stxIdx === -1) break
    const etxIdx = raw.indexOf("\x03", stxIdx)
    if (etxIdx === -1) {
      chunks.push(raw.slice(stxIdx))
      break
    }
    chunks.push(raw.slice(stxIdx, etxIdx + 1))
    i = etxIdx + 1
  }
  return chunks
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
  const [viewMode, setViewMode] = useState<ViewMode>("formatted")

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
    setViewMode("formatted")

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
      ? (splitRawTransmissions(rawData.requestBody)[
          selected.transmissionIndex
        ] ?? rawData.requestBody)
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

            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger value="formatted">Formatted</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
            </Tabs>

            {viewMode === "formatted" ? (
              <RecordSegmentsView
                segments={selected.segments}
                header={selected.header}
              />
            ) : selectedRawText ? (
              <NcpdpRawView text={selectedRawText} />
            ) : (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Raw data not available
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
