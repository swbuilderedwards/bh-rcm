import { createClient } from "@/lib/supabase/server"
import type { PbmGateway, BatchSubmission } from "@/lib/claims/types"

const REJECT_CODES: { code: string; description: string }[] = [
  { code: "75", description: "Prior Authorization Required" },
  { code: "70", description: "Product/Service Not Covered" },
  { code: "65", description: "Patient is Not Covered" },
  { code: "25", description: "Claim Too Old" },
]

export class StubAdapter implements PbmGateway {
  async submitBatch(batch: BatchSubmission): Promise<void> {
    const supabase = await createClient()

    // Query for enrollments that already have a paid claim (duplicate detection)
    const enrollmentIds = [
      ...new Set(batch.claims.map((c) => c.enrollmentId)),
    ]

    const { data: paidClaims, error } = await supabase
      .from("claims")
      .select("enrollment_id")
      .in("enrollment_id", enrollmentIds)
      .eq("response_status", "P")

    if (error) throw error

    const paidEnrollmentIds = new Set(
      (paidClaims ?? []).map((c) => c.enrollment_id),
    )

    const now = new Date().toISOString()
    let paidCount = 0
    let rejectedCount = 0
    let duplicateCount = 0

    for (const claim of batch.claims) {
      let status: "paid" | "rejected" | "duplicate"
      let responseStatus: "P" | "R" | "D"
      let rejectCodes: string[] = []
      let rejectDescriptions: string[] = []

      if (paidEnrollmentIds.has(claim.enrollmentId)) {
        status = "duplicate"
        responseStatus = "D"
        duplicateCount++
      } else if (Math.random() < 0.5) {
        status = "paid"
        responseStatus = "P"
        paidCount++
        // Track within-batch so subsequent claims for same enrollment are duplicates
        paidEnrollmentIds.add(claim.enrollmentId)
      } else {
        status = "rejected"
        responseStatus = "R"
        rejectedCount++
        const reject =
          REJECT_CODES[Math.floor(Math.random() * REJECT_CODES.length)]
        rejectCodes = [reject.code]
        rejectDescriptions = [reject.description]
      }

      const { error: updateError } = await supabase
        .from("claims")
        .update({
          status,
          response_status: responseStatus,
          responded_at: now,
          reject_codes: rejectCodes.length > 0 ? rejectCodes : null,
          reject_descriptions:
            rejectDescriptions.length > 0 ? rejectDescriptions : null,
        })
        .eq("id", claim.claimId)

      if (updateError) throw updateError
    }

    // Update batch summary counts
    const { error: batchError } = await supabase
      .from("batches")
      .update({ paid_count: paidCount, rejected_count: rejectedCount, duplicate_count: duplicateCount })
      .eq("id", batch.batchId)

    if (batchError) throw batchError
  }
}
