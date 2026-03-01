export type ClaimStatus = "pending" | "submitted" | "paid" | "rejected" | "duplicate"

export type Product = "Sleepio" | "Daylight" | "Spark"

export interface ClaimAttempt {
  id: string
  enrollmentId: string
  sequence: number
  status: ClaimStatus
  batchId: string
  submittedAt: string | null
  respondedAt: string | null
  response: "Paid" | "Rejected" | "Duplicate" | null
  rejectCodes: string[] | null
  rejectDescriptions: string[] | null
}

export interface Enrollment {
  id: string
  patientName: string
  patientDob: string
  patientGender: string
  patientZip: string
  product: Product
  organization: string
  enrolledDate: string
  billingPointDate: string
  status: ClaimStatus
  attempts: number
  claims: ClaimAttempt[]
}
