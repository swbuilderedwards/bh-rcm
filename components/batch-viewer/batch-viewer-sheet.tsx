"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { NcpdpRawView } from "./ncpdp-raw-view"
import { NcpdpParsedView } from "./ncpdp-parsed-view"

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
  const [viewMode, setViewMode] = useState<ViewMode>("raw")

  const fetchRaw = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setRawData(null)
    setParsedData(null)
    setViewMode("raw")

    try {
      const resp = await fetch(`/api/batches/${id}/ncpdp?view=raw`)
      if (!resp.ok) {
        const body = await resp.json().catch(() => null)
        throw new Error(body?.error ?? `Failed to load (${resp.status})`)
      }
      const data = await resp.json()
      setRawData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchParsed = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`/api/batches/${id}/ncpdp?view=parsed`)
      if (resp.ok) {
        const data = await resp.json()
        setParsedData(data)
      }
    } catch {
      // Parsed view is best-effort; raw view still works
    }
  }, [])

  useEffect(() => {
    if (open && batchId) {
      fetchRaw(batchId)
    }
  }, [open, batchId, fetchRaw])

  // Lazy-load parsed data on first toggle to "formatted"
  useEffect(() => {
    if (viewMode === "formatted" && !parsedData && batchId) {
      fetchParsed(batchId)
    }
  }, [viewMode, parsedData, batchId, fetchParsed])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">
            Batch {batchId?.slice(0, 8)}...
          </SheetTitle>
          <SheetDescription>Raw NCPDP batch file viewer</SheetDescription>
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

        {rawData && (
          <div className="flex flex-col gap-4 px-4 pb-4">
            {/* View mode toggle */}
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger value="raw">Raw</TabsTrigger>
                <TabsTrigger value="formatted">Formatted</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Request / Response tabs */}
            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response" disabled={!rawData.responseBody}>
                  Response
                </TabsTrigger>
              </TabsList>

              <TabsContent value="request">
                {viewMode === "raw" ? (
                  <NcpdpRawView text={rawData.requestBody} />
                ) : (
                  <NcpdpParsedView
                    parsed={parsedData?.requestParsed as never}
                    parseError={parsedData?.requestParseError}
                  />
                )}
              </TabsContent>

              <TabsContent value="response">
                {rawData.responseBody && (
                  viewMode === "raw" ? (
                    <NcpdpRawView text={rawData.responseBody} />
                  ) : (
                    <NcpdpParsedView
                      parsed={parsedData?.responseParsed as never}
                      parseError={parsedData?.responseParseError}
                    />
                  )
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
