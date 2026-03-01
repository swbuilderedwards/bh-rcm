"use client"

import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

function FieldGrid({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields).filter(
    ([k]) => k !== "segment_identification",
  )
  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-1 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-muted-foreground truncate">{k}</span>
          <span className="font-mono truncate">{String(v ?? "")}</span>
        </div>
      ))}
    </div>
  )
}

const SEGMENT_NAMES: Record<string, string> = {
  "01": "Patient",
  "02": "Pharmacy Provider",
  "03": "Prescriber",
  "04": "Insurance",
  "05": "COB/Other Payments",
  "07": "Claim",
  "08": "DUR/PPS",
  "10": "Compound",
  "11": "Pricing",
  "12": "Prior Authorization",
  "13": "Clinical",
  "14": "Additional Documentation",
  "15": "Facility",
  "16": "Narrative",
  "20": "Response Message",
  "21": "Response Status",
  "22": "Response Claim",
  "23": "Response Pricing",
  "24": "Response DUR/PPS",
  "25": "Response Insurance",
  "26": "Response Prior Authorization",
}

function SegmentSection({ segment }: { segment: Segment }) {
  const segId = segment.segment_identification ?? "??"
  const { segment_identification: _, ...fields } = segment
  const segName = SEGMENT_NAMES[segId] ?? `Segment ${segId}`

  return (
    <AccordionItem value={`seg-${segId}-${Math.random()}`}>
      <AccordionTrigger className="py-2 text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] px-1.5">
            {segId}
          </Badge>
          <span className="text-muted-foreground">
            {segName}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <FieldGrid fields={fields} />
      </AccordionContent>
    </AccordionItem>
  )
}

function TransmissionCard({
  tx,
  index,
}: {
  tx: Transmission
  index: number
}) {
  const allSegments: Segment[] = [
    ...(tx.segments ?? []),
    ...(tx.transactions ?? []).flatMap((t) => t.segments ?? []),
  ]

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">
          Transmission {index + 1}
          {tx.header && (
            <span className="text-muted-foreground font-normal ml-2 text-xs">
              {tx.header.bin_number ? `BIN ${String(tx.header.bin_number)}` : null}
              {tx.header.transaction_count
                ? ` \u00b7 ${String(tx.header.transaction_count)} txn(s)`
                : null}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {tx.header && (
          <div className="mb-3 p-2 bg-zinc-50 rounded border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              Header
            </div>
            <FieldGrid fields={tx.header} />
          </div>
        )}
        <Accordion type="multiple">
          {allSegments.map((seg, i) => (
            <SegmentSection key={i} segment={seg} />
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}

export function RecordSegmentsView({
  segments,
  header,
}: {
  segments: Segment[]
  header?: Record<string, unknown>
}) {
  return (
    <div className="flex flex-col gap-3">
      {header && (
        <div className="p-2 bg-zinc-50 rounded border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
            Header
          </div>
          <FieldGrid fields={header} />
        </div>
      )}
      <Accordion type="multiple">
        {segments.map((seg, i) => (
          <SegmentSection key={i} segment={seg} />
        ))}
      </Accordion>
    </div>
  )
}

export function NcpdpParsedView({
  parsed,
  parseError,
}: {
  parsed?: { transmissions: Transmission[] }
  parseError?: string
}) {
  if (parseError) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        {parseError}
      </div>
    )
  }

  if (!parsed?.transmissions?.length) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No transmissions found
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {parsed.transmissions.map((tx, i) => (
        <TransmissionCard key={i} tx={tx} index={i} />
      ))}
    </div>
  )
}
