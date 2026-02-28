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

export const enrollments: Enrollment[] = [
  {
    id: "ENR-001",
    patientName: "Sarah Johnson",
    patientDob: "1985-03-14",
    patientGender: "Female",
    patientZip: "94102",
    product: "Sleepio",
    organization: "Acme Corp",
    enrolledDate: "2025-11-01",
    billingPointDate: "2025-12-01",
    status: "paid",
    attempts: 1,
    claims: [
      {
        id: "CLM-001",
        enrollmentId: "ENR-001",
        sequence: 1,
        status: "paid",
        batchId: "BATCH-2025-12-01",
        submittedAt: "2025-12-02T10:30:00Z",
        respondedAt: "2025-12-05T14:00:00Z",
        response: "Paid",
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-002",
    patientName: "Sarah Johnson",
    patientDob: "1985-03-14",
    patientGender: "Female",
    patientZip: "94102",
    product: "Daylight",
    organization: "Acme Corp",
    enrolledDate: "2025-10-15",
    billingPointDate: "2025-11-15",
    status: "paid",
    attempts: 1,
    claims: [
      {
        id: "CLM-002",
        enrollmentId: "ENR-002",
        sequence: 1,
        status: "paid",
        batchId: "BATCH-2025-11-15",
        submittedAt: "2025-11-16T09:00:00Z",
        respondedAt: "2025-11-19T11:30:00Z",
        response: "Paid",
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-003",
    patientName: "Michael Chen",
    patientDob: "1992-07-22",
    patientGender: "Male",
    patientZip: "10001",
    product: "Spark",
    organization: "GlobalTech",
    enrolledDate: "2025-12-01",
    billingPointDate: "2026-01-01",
    status: "pending",
    attempts: 1,
    claims: [
      {
        id: "CLM-003",
        enrollmentId: "ENR-003",
        sequence: 1,
        status: "pending",
        batchId: "BATCH-2026-01-02",
        submittedAt: "2026-01-02T08:15:00Z",
        respondedAt: null,
        response: null,
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-004",
    patientName: "Emily Rodriguez",
    patientDob: "1978-11-30",
    patientGender: "Female",
    patientZip: "60601",
    product: "Sleepio",
    organization: "HealthFirst Inc",
    enrolledDate: "2025-09-20",
    billingPointDate: "2025-10-20",
    status: "rejected",
    attempts: 2,
    claims: [
      {
        id: "CLM-004",
        enrollmentId: "ENR-004",
        sequence: 1,
        status: "rejected",
        batchId: "BATCH-2025-10-21",
        submittedAt: "2025-10-21T10:00:00Z",
        respondedAt: "2025-10-24T16:00:00Z",
        response: "Rejected",
        rejectCodes: ["70", "MA130"],
        rejectDescriptions: [
          "Incorrect Member ID",
          "Patient eligibility not confirmed",
        ],
      },
      {
        id: "CLM-004B",
        enrollmentId: "ENR-004",
        sequence: 2,
        status: "rejected",
        batchId: "BATCH-2025-11-05",
        submittedAt: "2025-11-05T09:30:00Z",
        respondedAt: "2025-11-08T13:45:00Z",
        response: "Rejected",
        rejectCodes: ["MA130"],
        rejectDescriptions: ["Patient eligibility not confirmed"],
      },
    ],
  },
  {
    id: "ENR-005",
    patientName: "Emily Rodriguez",
    patientDob: "1978-11-30",
    patientGender: "Female",
    patientZip: "60601",
    product: "Daylight",
    organization: "HealthFirst Inc",
    enrolledDate: "2025-11-10",
    billingPointDate: "2025-12-10",
    status: "submitted",
    attempts: 1,
    claims: [
      {
        id: "CLM-005",
        enrollmentId: "ENR-005",
        sequence: 1,
        status: "submitted",
        batchId: "BATCH-2025-12-11",
        submittedAt: "2025-12-11T07:45:00Z",
        respondedAt: null,
        response: null,
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-006",
    patientName: "James Wilson",
    patientDob: "1990-05-18",
    patientGender: "Male",
    patientZip: "30301",
    product: "Spark",
    organization: "Acme Corp",
    enrolledDate: "2025-10-05",
    billingPointDate: "2025-11-05",
    status: "paid",
    attempts: 1,
    claims: [
      {
        id: "CLM-006",
        enrollmentId: "ENR-006",
        sequence: 1,
        status: "paid",
        batchId: "BATCH-2025-11-06",
        submittedAt: "2025-11-06T11:00:00Z",
        respondedAt: "2025-11-09T09:20:00Z",
        response: "Paid",
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-007",
    patientName: "James Wilson",
    patientDob: "1990-05-18",
    patientGender: "Male",
    patientZip: "30301",
    product: "Sleepio",
    organization: "Acme Corp",
    enrolledDate: "2025-12-10",
    billingPointDate: "2026-01-10",
    status: "pending",
    attempts: 1,
    claims: [
      {
        id: "CLM-007",
        enrollmentId: "ENR-007",
        sequence: 1,
        status: "pending",
        batchId: "BATCH-2026-01-11",
        submittedAt: "2026-01-11T08:00:00Z",
        respondedAt: null,
        response: null,
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-008",
    patientName: "Lisa Park",
    patientDob: "1988-09-02",
    patientGender: "Female",
    patientZip: "98101",
    product: "Daylight",
    organization: "GlobalTech",
    enrolledDate: "2025-08-15",
    billingPointDate: "2025-09-15",
    status: "duplicate",
    attempts: 1,
    claims: [
      {
        id: "CLM-008",
        enrollmentId: "ENR-008",
        sequence: 1,
        status: "duplicate",
        batchId: "BATCH-2025-09-16",
        submittedAt: "2025-09-16T14:30:00Z",
        respondedAt: "2025-09-19T10:00:00Z",
        response: "Duplicate",
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-009",
    patientName: "Robert Taylor",
    patientDob: "1975-01-25",
    patientGender: "Male",
    patientZip: "02101",
    product: "Spark",
    organization: "HealthFirst Inc",
    enrolledDate: "2025-11-20",
    billingPointDate: "2025-12-20",
    status: "pending",
    attempts: 3,
    claims: [
      {
        id: "CLM-009A",
        enrollmentId: "ENR-009",
        sequence: 1,
        status: "rejected",
        batchId: "BATCH-2025-12-21",
        submittedAt: "2025-12-21T10:00:00Z",
        respondedAt: "2025-12-24T15:30:00Z",
        response: "Rejected",
        rejectCodes: ["75"],
        rejectDescriptions: ["Prior authorization required"],
      },
      {
        id: "CLM-009B",
        enrollmentId: "ENR-009",
        sequence: 2,
        status: "rejected",
        batchId: "BATCH-2026-01-05",
        submittedAt: "2026-01-05T09:00:00Z",
        respondedAt: "2026-01-08T12:00:00Z",
        response: "Rejected",
        rejectCodes: ["75", "N30"],
        rejectDescriptions: [
          "Prior authorization required",
          "Missing documentation",
        ],
      },
      {
        id: "CLM-009C",
        enrollmentId: "ENR-009",
        sequence: 3,
        status: "pending",
        batchId: "BATCH-2026-01-20",
        submittedAt: "2026-01-20T08:30:00Z",
        respondedAt: null,
        response: null,
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
  {
    id: "ENR-010",
    patientName: "Lisa Park",
    patientDob: "1988-09-02",
    patientGender: "Female",
    patientZip: "98101",
    product: "Sleepio",
    organization: "GlobalTech",
    enrolledDate: "2025-12-05",
    billingPointDate: "2026-01-05",
    status: "submitted",
    attempts: 1,
    claims: [
      {
        id: "CLM-010",
        enrollmentId: "ENR-010",
        sequence: 1,
        status: "submitted",
        batchId: "BATCH-2026-01-06",
        submittedAt: "2026-01-06T10:15:00Z",
        respondedAt: null,
        response: null,
        rejectCodes: null,
        rejectDescriptions: null,
      },
    ],
  },
]

export function getEnrollmentById(id: string): Enrollment | undefined {
  return enrollments.find((e) => e.id === id)
}

export function getDashboardMetrics() {
  const total = enrollments.length
  const pending = enrollments.filter((e) => e.status === "pending").length
  const submitted = enrollments.filter((e) => e.status === "submitted").length
  const paid = enrollments.filter((e) => e.status === "paid").length
  const rejected = enrollments.filter((e) => e.status === "rejected").length
  const duplicate = enrollments.filter((e) => e.status === "duplicate").length
  const paidRate = total > 0 ? ((paid / total) * 100).toFixed(1) : "0"
  const totalRevenue = paid * 250 // mock $250 per paid claim

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
