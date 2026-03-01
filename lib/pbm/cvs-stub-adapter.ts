import { createClient } from "@/lib/supabase/server"
import type { PbmGateway, BatchSubmission } from "@/lib/claims/types"

interface NcpdpClaimInput {
  bin_number: string
  caremark_id: string
  rx_group: string
  person_code: string
  relationship_code: string
  date_of_birth: string
  first_name: string
  last_name: string
  gender: string
  service_date: string
  reference_number: number
  upc: string
  ingredient_cost: string
  dispensing_fee: string
  usual_and_customary_charge: string
  gross_amount_due: string
  days_supply: number
  quantity: number
}

const NCPDP_SERVICE_URL =
  process.env.NCPDP_SERVICE_URL || "http://localhost:3001"

export class CvsStubAdapter implements PbmGateway {
  async submitBatch(batch: BatchSubmission): Promise<void> {
    const supabase = await createClient()

    // === Phase 1: Duplicate detection ===
    const enrollmentIds = [
      ...new Set(batch.claims.map((c) => c.enrollmentId)),
    ]

    const { data: paidClaims, error: paidError } = await supabase
      .from("claims")
      .select("enrollment_id")
      .in("enrollment_id", enrollmentIds)
      .eq("response_status", "P")

    if (paidError) throw paidError

    const paidEnrollmentIds = new Set(
      (paidClaims ?? []).map((c) => c.enrollment_id),
    )

    const now = new Date().toISOString()
    let duplicateCount = 0

    // Partition: duplicates vs sendable, and within-batch de-dupe
    const seenInBatch = new Set<string>()
    const sendableClaims: typeof batch.claims = []

    for (const claim of batch.claims) {
      if (paidEnrollmentIds.has(claim.enrollmentId)) {
        // Pre-existing duplicate
        await this.markDuplicate(supabase, claim.claimId, now)
        duplicateCount++
      } else if (seenInBatch.has(claim.enrollmentId)) {
        // Within-batch duplicate
        await this.markDuplicate(supabase, claim.claimId, now)
        duplicateCount++
      } else {
        seenInBatch.add(claim.enrollmentId)
        sendableClaims.push(claim)
      }
    }

    if (sendableClaims.length === 0) {
      await supabase
        .from("batches")
        .update({ paid_count: 0, rejected_count: 0, duplicate_count: duplicateCount })
        .eq("id", batch.batchId)
      return
    }

    // === Phase 2: Enrich claims from Supabase ===
    const sendableEnrollmentIds = sendableClaims.map((c) => c.enrollmentId)

    const { data: enriched, error: enrichError } = await supabase
      .from("enrollments")
      .select("id, reference_number, patients(*), products(*), organizations(*)")
      .in("id", sendableEnrollmentIds)

    if (enrichError) throw enrichError

    const enrichmentMap = new Map(
      (enriched ?? []).map((e) => [e.id, e]),
    )

    // Build NcpdpClaimInputs and a reference map for response matching
    const ncpdpInputs: NcpdpClaimInput[] = []
    const refMap = new Map<number, { claimId: string; enrollmentId: string }>()

    for (const claim of sendableClaims) {
      const enrollment = enrichmentMap.get(claim.enrollmentId)
      if (!enrollment?.patients || !enrollment?.products || !enrollment?.organizations) {
        continue
      }

      const patient = enrollment.patients as Record<string, unknown>
      const product = enrollment.products as Record<string, unknown>
      const org = enrollment.organizations as Record<string, unknown>
      const refNumber = enrollment.reference_number as number

      const upc = org.legacy_pricing
        ? (product.upc_legacy as string) || (product.upc as string)
        : (product.upc as string)

      const input: NcpdpClaimInput = {
        bin_number: patient.bin_number as string,
        caremark_id: patient.caremark_id as string,
        rx_group: patient.rx_group as string,
        person_code: patient.person_code as string,
        relationship_code: patient.relationship_code as string,
        date_of_birth: patient.date_of_birth as string,
        first_name: patient.first_name as string,
        last_name: patient.last_name as string,
        gender: patient.gender as string,
        service_date: claim.serviceDate,
        reference_number: refNumber,
        upc,
        ingredient_cost: String(product.ingredient_cost),
        dispensing_fee: String(product.dispensing_fee),
        usual_and_customary_charge: String(product.usual_and_customary_charge),
        gross_amount_due: String(product.gross_amount_due),
        days_supply: product.days_supply as number,
        quantity: product.quantity as number,
      }

      ncpdpInputs.push(input)
      refMap.set(refNumber, {
        claimId: claim.claimId,
        enrollmentId: claim.enrollmentId,
      })
    }

    // === Phase 3: NCPDP pipeline (3 sequential HTTP calls) ===

    // 1. Encode batch
    const encodeResp = await fetch(
      `${NCPDP_SERVICE_URL}/api/claims/ncpdp/batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ncpdpInputs),
      },
    )
    if (!encodeResp.ok) {
      throw new Error(`NCPDP encode failed: ${encodeResp.status} ${await encodeResp.text()}`)
    }
    const batchText = await encodeResp.text()

    // 2. Submit to stub PBM
    const adjResp = await fetch(
      `${NCPDP_SERVICE_URL}/api/claims/ncpdp/stub-adjudicate`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: batchText,
      },
    )
    if (!adjResp.ok) {
      throw new Error(`NCPDP adjudication failed: ${adjResp.status} ${await adjResp.text()}`)
    }
    const responseText = await adjResp.text()

    // 3. Parse response
    const parseResp = await fetch(
      `${NCPDP_SERVICE_URL}/api/claims/ncpdp/parse-response-text`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: responseText,
      },
    )
    if (!parseResp.ok) {
      throw new Error(`NCPDP parse failed: ${parseResp.status} ${await parseResp.text()}`)
    }
    const { transmissions } = (await parseResp.json()) as {
      transmissions: Record<string, unknown>[]
    }

    // === Phase 4: Match responses and write results ===
    let paidCount = 0
    let rejectedCount = 0

    for (const tx of transmissions) {
      // Find segment 22 (ResponseClaimSegment) for reference number
      const allSegments = [
        ...((tx.segments as Record<string, unknown>[]) ?? []),
        ...((tx.transactions as { segments: Record<string, unknown>[] }[]) ?? []).flatMap(
          (t) => t.segments ?? [],
        ),
      ]

      const seg22 = allSegments.find(
        (s) => s.segment_identification === "22",
      )
      if (!seg22) continue

      const refNumber = seg22.prescription_service_reference_number as number
      const match = refMap.get(refNumber)
      if (!match) continue

      // Find segment 21 (ResponseStatusSegment) for paid/rejected
      const seg21 = allSegments.find(
        (s) => s.segment_identification === "21",
      )
      if (!seg21) continue

      const responseStatus = seg21.transaction_response_status as string
      const isPaid = responseStatus === "P"

      let status: string
      let dbResponseStatus: string
      let rejectCodes: string[] | null = null
      let rejectDescriptions: string[] | null = null

      if (isPaid) {
        status = "paid"
        dbResponseStatus = "P"
        paidCount++
        // Mark enrollment as paid for within-batch de-dupe
        paidEnrollmentIds.add(match.enrollmentId)
      } else {
        status = "rejected"
        dbResponseStatus = "R"
        rejectedCount++
        const rejectCode = seg21.reject_code as string | undefined
        if (rejectCode) {
          rejectCodes = [rejectCode]
          rejectDescriptions = [rejectCode] // Stub doesn't have description text
        }
      }

      const { error: updateError } = await supabase
        .from("claims")
        .update({
          status,
          response_status: dbResponseStatus,
          responded_at: now,
          reject_codes: rejectCodes,
          reject_descriptions: rejectDescriptions,
        })
        .eq("id", match.claimId)

      if (updateError) throw updateError
    }

    // Update batch summary counts
    const { error: batchError } = await supabase
      .from("batches")
      .update({
        paid_count: paidCount,
        rejected_count: rejectedCount,
        duplicate_count: duplicateCount,
        request_body: batchText,
        response_body: responseText,
      })
      .eq("id", batch.batchId)

    if (batchError) throw batchError
  }

  private async markDuplicate(
    supabase: Awaited<ReturnType<typeof createClient>>,
    claimId: string,
    now: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("claims")
      .update({
        status: "duplicate",
        response_status: "D",
        responded_at: now,
      })
      .eq("id", claimId)
    if (error) throw error
  }
}
