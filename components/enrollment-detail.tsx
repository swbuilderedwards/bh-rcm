"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { RotateCw } from "lucide-react"

import type { Enrollment } from "@/lib/data"
import { BatchViewerSheet } from "@/components/batch-viewer/batch-viewer-sheet"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export function EnrollmentDetail({
  enrollment,
}: {
  enrollment: Enrollment
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null)
  const lastClaim = enrollment.claims[enrollment.claims.length - 1]
  const showResubmit = lastClaim?.response === "Rejected"

  async function handleResubmit() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/claims/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentIds: [enrollment.id] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? "Resubmission failed")
      }
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Resubmission failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Patient & Enrollment Info */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollment Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Patient" value={enrollment.patientName} />
            <InfoItem
              label="Date of Birth"
              value={format(new Date(enrollment.patientDob), "MMM d, yyyy")}
            />
            <InfoItem label="Gender" value={enrollment.patientGender} />
            <InfoItem label="ZIP Code" value={enrollment.patientZip} />
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Product" value={enrollment.product} />
            <InfoItem label="Organization" value={enrollment.organization} />
            <InfoItem
              label="Enrolled Date"
              value={format(new Date(enrollment.enrolledDate), "MMM d, yyyy")}
            />
            <InfoItem
              label="Billing Point"
              value={format(
                new Date(enrollment.billingPointDate),
                "MMM d, yyyy"
              )}
            />
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Current Status
            </span>
            <StatusBadge status={enrollment.status} />
          </div>
        </CardContent>
      </Card>

      {/* Claim History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Claim History</CardTitle>
          {showResubmit && (
            <Button size="sm" disabled={submitting} onClick={handleResubmit} className="gap-1.5">
              <RotateCw className={`size-3.5 ${submitting ? "animate-spin" : ""}`} />
              {submitting ? "Submitting..." : "Resubmit"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Seq #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Responded At</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Reject Codes</TableHead>
                  <TableHead>Reject Descriptions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollment.claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="tabular-nums font-medium">
                      {claim.sequence}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {claim.batchId && claim.status !== "pending" ? (
                        <button
                          type="button"
                          className="hover:underline truncate max-w-24 inline-block text-left"
                          title={claim.batchId}
                          onClick={() => setViewingBatchId(claim.batchId!)}
                        >
                          {claim.batchId.slice(0, 8)}...
                        </button>
                      ) : (
                        claim.batchId ?? "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      {claim.submittedAt
                        ? format(
                            new Date(claim.submittedAt),
                            "MMM d, yyyy h:mm a"
                          )
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {claim.respondedAt
                        ? format(
                            new Date(claim.respondedAt),
                            "MMM d, yyyy h:mm a"
                          )
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {claim.response ? (
                        <span
                          className={
                            claim.response === "Paid"
                              ? "text-emerald-600 font-medium"
                              : claim.response === "Rejected"
                                ? "text-red-600 font-medium"
                                : "text-zinc-500 font-medium"
                          }
                        >
                          {claim.response}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      {claim.rejectCodes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {claim.rejectCodes.map((code) => (
                            <span
                              key={code}
                              className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-mono text-red-700 border border-red-200"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="max-w-64">
                      {claim.rejectDescriptions?.length ? (
                        <ul className="text-xs text-muted-foreground leading-relaxed">
                          {claim.rejectDescriptions.map((desc) => (
                            <li key={desc}>{desc}</li>
                          ))}
                        </ul>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BatchViewerSheet
        batchId={viewingBatchId}
        open={viewingBatchId !== null}
        onOpenChange={(open) => { if (!open) setViewingBatchId(null) }}
      />
    </div>
  )
}
