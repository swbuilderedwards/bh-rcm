import { createClient } from "@/lib/supabase/server"
import { getGateway } from "./gateway-registry"
import type { BatchClaim, BatchSubmission } from "./types"

/**
 * Portal-triggered: submit claims for explicitly selected enrollments.
 */
export async function submitClaims(
  enrollmentIds: string[],
): Promise<string[]> {
  return submitForEnrollments(enrollmentIds)
}

/**
 * Cron-triggered: find all "ready to bill" enrollments and submit.
 * Ready = billing_point_hit_at set, is_billable true,
 *         and either no claims or latest claim rejected.
 */
export async function submitReady(): Promise<string[]> {
  const supabase = await createClient()

  // Get all billable enrollments that have hit their billing point
  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select("id, claims(id, sequence_number, response_status)")
    .not("billing_point_hit_at", "is", null)
    .eq("is_billable", true)

  if (error) throw error
  if (!enrollments || enrollments.length === 0) return []

  // Filter to "ready to bill": no claims, or latest claim is rejected
  const readyIds = enrollments
    .filter((e) => {
      const claims = e.claims ?? []
      if (claims.length === 0) return true
      // Find the latest claim by sequence_number
      const latest = claims.reduce((max, c) =>
        c.sequence_number > max.sequence_number ? c : max,
      )
      return latest.response_status === "R"
    })
    .map((e) => e.id)

  if (readyIds.length === 0) return []

  return submitForEnrollments(readyIds)
}

/**
 * Shared flow: resolve enrollments, group by billing_type, create
 * batches + claims, call gateway for each batch.
 */
async function submitForEnrollments(
  enrollmentIds: string[],
): Promise<string[]> {
  const supabase = await createClient()

  // 1. Query enrollments with org billing_type and existing claim sequence numbers
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select(
      "id, organization_id, organizations(billing_type), claims(sequence_number)",
    )
    .in("id", enrollmentIds)

  if (enrollError) throw enrollError
  if (!enrollments || enrollments.length === 0) return []

  // 2. Group enrollments by billing_type
  const groups = new Map<
    string,
    { enrollmentId: string; maxSequence: number }[]
  >()

  for (const enrollment of enrollments) {
    const billingType = enrollment.organizations?.billing_type ?? "direct"
    const claims = enrollment.claims ?? []
    const maxSequence =
      claims.length > 0
        ? Math.max(...claims.map((c) => c.sequence_number))
        : 0

    if (!groups.has(billingType)) {
      groups.set(billingType, [])
    }
    groups.get(billingType)!.push({
      enrollmentId: enrollment.id,
      maxSequence,
    })
  }

  const today = new Date().toISOString().split("T")[0]
  const now = new Date().toISOString()
  const batchIds: string[] = []

  // 3. For each billing_type group: create batch, create claims, call gateway
  for (const [billingType, enrollmentGroup] of groups) {
    // Insert batch row
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .insert({
        submitted_at: now,
        total_claims: enrollmentGroup.length,
        paid_count: 0,
        rejected_count: 0,
        duplicate_count: 0,
      })
      .select("id")
      .single()

    if (batchError) throw batchError

    // Insert claim rows
    const claimInserts = enrollmentGroup.map((e) => ({
      enrollment_id: e.enrollmentId,
      batch_id: batch.id,
      sequence_number: e.maxSequence + 1,
      status: "submitted" as const,
      service_date: today,
      submitted_at: now,
    }))

    const { data: insertedClaims, error: claimsError } = await supabase
      .from("claims")
      .insert(claimInserts)
      .select("id, enrollment_id, sequence_number, service_date")

    if (claimsError) throw claimsError

    // Build batch submission for the gateway
    const batchClaims: BatchClaim[] = (insertedClaims ?? []).map((c) => ({
      claimId: c.id,
      enrollmentId: c.enrollment_id,
      sequenceNumber: c.sequence_number,
      serviceDate: c.service_date!,
    }))

    const submission: BatchSubmission = {
      batchId: batch.id,
      billingType,
      claims: batchClaims,
    }

    // Call the gateway adapter
    const gateway = getGateway(billingType)
    await gateway.submitBatch(submission)

    batchIds.push(batch.id)
  }

  return batchIds
}
