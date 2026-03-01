import { createClient } from "./server"
import type { ClaimStatus, ClaimAttempt, Enrollment, BatchSummary } from "@/lib/data"

const RESPONSE_LABEL: Record<string, "Paid" | "Rejected" | "Duplicate"> = {
  P: "Paid",
  R: "Rejected",
  D: "Duplicate",
}

const GENDER_LABEL: Record<string, string> = {
  M: "Male",
  F: "Female",
  U: "Unknown",
  X: "Non-binary",
}

function mapClaim(c: {
  id: string
  enrollment_id: string
  sequence_number: number
  status: string
  batch_id: string | null
  submitted_at: string | null
  responded_at: string | null
  response_status: string | null
  reject_codes: string[] | null
  reject_descriptions: string[] | null
}): ClaimAttempt {
  return {
    id: c.id,
    enrollmentId: c.enrollment_id,
    sequence: c.sequence_number,
    status: c.status as ClaimStatus,
    batchId: c.batch_id ?? "",
    submittedAt: c.submitted_at,
    respondedAt: c.responded_at,
    response: c.response_status ? (RESPONSE_LABEL[c.response_status] ?? null) : null,
    rejectCodes: c.reject_codes,
    rejectDescriptions: c.reject_descriptions,
  }
}

function deriveStatus(claims: { status: string; sequence_number: number }[]): ClaimStatus {
  if (claims.length === 0) return "pending"
  const latest = claims.reduce((a, b) =>
    b.sequence_number > a.sequence_number ? b : a
  )
  return latest.status as ClaimStatus
}

type EnrollmentRow = {
  id: string
  enrolled_at: string
  billing_point_hit_at: string | null
  patients: {
    first_name: string
    last_name: string
    date_of_birth: string
    gender: string
    zip_code: string | null
  }
  products: { name: string; gross_amount_due: number }
  organizations: { name: string }
  claims: {
    id: string
    enrollment_id: string
    sequence_number: number
    status: string
    batch_id: string | null
    submitted_at: string | null
    responded_at: string | null
    response_status: string | null
    reject_codes: string[] | null
    reject_descriptions: string[] | null
  }[]
}

function mapEnrollment(row: EnrollmentRow): Enrollment {
  const sortedClaims = [...row.claims].sort(
    (a, b) => a.sequence_number - b.sequence_number
  )
  return {
    id: row.id,
    patientName: `${row.patients.first_name} ${row.patients.last_name}`,
    patientDob: row.patients.date_of_birth,
    patientGender: GENDER_LABEL[row.patients.gender] ?? row.patients.gender,
    patientZip: row.patients.zip_code ?? "",
    product: row.products.name as Enrollment["product"],
    organization: row.organizations.name,
    enrolledDate: row.enrolled_at,
    billingPointDate: row.billing_point_hit_at ?? row.enrolled_at,
    status: deriveStatus(row.claims),
    attempts: row.claims.length,
    claims: sortedClaims.map(mapClaim),
  }
}

const ENROLLMENT_SELECT = `
  id,
  enrolled_at,
  billing_point_hit_at,
  patients!inner ( first_name, last_name, date_of_birth, gender, zip_code ),
  products!inner ( name, gross_amount_due ),
  organizations!inner ( name ),
  claims ( id, enrollment_id, sequence_number, status, batch_id, submitted_at, responded_at, response_status, reject_codes, reject_descriptions )
` as const

export async function getEnrollments(): Promise<Enrollment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("enrollments")
    .select(ENROLLMENT_SELECT)
    .not("billing_point_hit_at", "is", null)
    .order("billing_point_hit_at", { ascending: false })

  if (error) throw error
  return (data as unknown as EnrollmentRow[]).map(mapEnrollment)
}

export async function getEnrollmentById(
  id: string
): Promise<Enrollment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("enrollments")
    .select(ENROLLMENT_SELECT)
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null // not found
    throw error
  }
  return mapEnrollment(data as unknown as EnrollmentRow)
}

type BatchRow = {
  id: string
  submitted_at: string | null
  total_claims: number
  paid_count: number
  rejected_count: number
  duplicate_count: number
  request_body: string | null
  created_at: string
}

export async function getBatches(): Promise<BatchSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("batches")
    .select(
      "id, submitted_at, total_claims, paid_count, rejected_count, duplicate_count, request_body, created_at"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data as unknown as BatchRow[]).map((row) => ({
    id: row.id,
    submittedAt: row.submitted_at,
    totalClaims: row.total_claims,
    paidCount: row.paid_count,
    rejectedCount: row.rejected_count,
    duplicateCount: row.duplicate_count,
    hasNcpdpData: row.request_body != null,
    createdAt: row.created_at,
  }))
}

export async function getDashboardMetrics() {
  const enrollments = await getEnrollments()

  let pending = 0
  let submitted = 0
  let paid = 0
  let rejected = 0
  let duplicate = 0

  for (const e of enrollments) {
    switch (e.status) {
      case "pending":
        pending++
        break
      case "submitted":
        submitted++
        break
      case "paid":
        paid++
        break
      case "rejected":
        rejected++
        break
      case "duplicate":
        duplicate++
        break
    }
  }

  const total = enrollments.length
  const paidRate = total > 0 ? ((paid / total) * 100).toFixed(1) : "0"

  // Calculate revenue from paid enrollments using actual product pricing
  const supabase = await createClient()
  let totalRevenue = 0
  if (paid > 0) {
    const paidIds = enrollments
      .filter((e) => e.status === "paid")
      .map((e) => e.id)
    const { data: paidRows } = await supabase
      .from("enrollments")
      .select("products!inner ( gross_amount_due )")
      .in("id", paidIds)
    if (paidRows) {
      for (const row of paidRows as unknown as { products: { gross_amount_due: number } }[]) {
        totalRevenue += Number(row.products.gross_amount_due)
      }
    }
  }

  return {
    total,
    pending,
    submitted,
    paid,
    rejected,
    duplicate,
    paidRate,
    totalRevenue,
  }
}
