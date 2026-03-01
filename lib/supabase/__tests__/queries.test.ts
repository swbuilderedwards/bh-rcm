import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the server client module before importing queries
const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockSupabase = { from: mockFrom }

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { getEnrollments, getEnrollmentById, getDashboardMetrics } from "../queries"

function makeEnrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "enr-1",
    enrolled_at: "2025-01-15",
    billing_point_hit_at: "2025-02-01",
    patients: {
      first_name: "Jane",
      last_name: "Doe",
      date_of_birth: "1990-05-20",
      gender: "F",
      zip_code: "90210",
    },
    products: { name: "Sleepio", gross_amount_due: 500 },
    organizations: { name: "Acme Corp" },
    claims: [
      {
        id: "clm-1",
        enrollment_id: "enr-1",
        sequence_number: 1,
        status: "paid",
        batch_id: "bat-1",
        submitted_at: "2025-02-01T00:00:00Z",
        responded_at: "2025-02-02T00:00:00Z",
        response_status: "P",
        reject_codes: null,
        reject_descriptions: null,
      },
    ],
    ...overrides,
  }
}

describe("getEnrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns mapped enrollments from supabase", async () => {
    const row = makeEnrollmentRow()
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    const result = await getEnrollments()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "enr-1",
      patientName: "Jane Doe",
      patientDob: "1990-05-20",
      patientGender: "Female",
      patientZip: "90210",
      product: "Sleepio",
      organization: "Acme Corp",
      enrolledDate: "2025-01-15",
      billingPointDate: "2025-02-01",
      status: "paid",
      attempts: 1,
      claims: [
        {
          id: "clm-1",
          enrollmentId: "enr-1",
          sequence: 1,
          status: "paid",
          batchId: "bat-1",
          submittedAt: "2025-02-01T00:00:00Z",
          respondedAt: "2025-02-02T00:00:00Z",
          response: "Paid",
          rejectCodes: null,
          rejectDescriptions: null,
        },
      ],
    })
  })

  it("throws when supabase returns an error", async () => {
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    await expect(getEnrollments()).rejects.toEqual({ message: "db error" })
  })

  it("derives status as 'pending' when enrollment has no claims", async () => {
    const row = makeEnrollmentRow({ claims: [] })
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    const result = await getEnrollments()
    expect(result[0].status).toBe("pending")
  })

  it("derives status from the latest claim by sequence_number", async () => {
    const row = makeEnrollmentRow({
      claims: [
        {
          id: "clm-1",
          enrollment_id: "enr-1",
          sequence_number: 1,
          status: "paid",
          batch_id: "bat-1",
          submitted_at: null,
          responded_at: null,
          response_status: "P",
          reject_codes: null,
          reject_descriptions: null,
        },
        {
          id: "clm-2",
          enrollment_id: "enr-1",
          sequence_number: 2,
          status: "rejected",
          batch_id: "bat-2",
          submitted_at: null,
          responded_at: null,
          response_status: "R",
          reject_codes: ["75"],
          reject_descriptions: ["Prior Authorization Required"],
        },
      ],
    })
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    const result = await getEnrollments()
    expect(result[0].status).toBe("rejected")
    expect(result[0].attempts).toBe(2)
    // Claims sorted by sequence_number
    expect(result[0].claims[0].sequence).toBe(1)
    expect(result[0].claims[1].sequence).toBe(2)
  })

  it("maps gender codes to labels", async () => {
    const genders = [
      { code: "M", label: "Male" },
      { code: "F", label: "Female" },
      { code: "U", label: "Unknown" },
      { code: "X", label: "Non-binary" },
    ]
    for (const { code, label } of genders) {
      const row = makeEnrollmentRow({
        patients: {
          first_name: "Test",
          last_name: "User",
          date_of_birth: "2000-01-01",
          gender: code,
          zip_code: null,
        },
      })
      const mockNot = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [row], error: null }),
      })
      mockSelect.mockReturnValue({ not: mockNot })

      const result = await getEnrollments()
      expect(result[0].patientGender).toBe(label)
    }
  })

  it("uses enrolled_at as billingPointDate fallback when billing_point_hit_at is null", async () => {
    const row = makeEnrollmentRow({ billing_point_hit_at: null })
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    const result = await getEnrollments()
    expect(result[0].billingPointDate).toBe("2025-01-15")
  })

  it("maps response_status codes to labels", async () => {
    const mappings = [
      { code: "P", label: "Paid" },
      { code: "R", label: "Rejected" },
      { code: "D", label: "Duplicate" },
    ]
    for (const { code, label } of mappings) {
      const row = makeEnrollmentRow({
        claims: [
          {
            id: "clm-1",
            enrollment_id: "enr-1",
            sequence_number: 1,
            status: "paid",
            batch_id: "bat-1",
            submitted_at: null,
            responded_at: null,
            response_status: code,
            reject_codes: null,
            reject_descriptions: null,
          },
        ],
      })
      const mockNot = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [row], error: null }),
      })
      mockSelect.mockReturnValue({ not: mockNot })

      const result = await getEnrollments()
      expect(result[0].claims[0].response).toBe(label)
    }
  })

  it("maps null response_status to null response", async () => {
    const row = makeEnrollmentRow({
      claims: [
        {
          id: "clm-1",
          enrollment_id: "enr-1",
          sequence_number: 1,
          status: "submitted",
          batch_id: "bat-1",
          submitted_at: null,
          responded_at: null,
          response_status: null,
          reject_codes: null,
          reject_descriptions: null,
        },
      ],
    })
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    const result = await getEnrollments()
    expect(result[0].claims[0].response).toBeNull()
  })
})

describe("getEnrollmentById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a mapped enrollment", async () => {
    const row = makeEnrollmentRow()
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: row, error: null }),
      }),
    })

    const result = await getEnrollmentById("enr-1")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("enr-1")
    expect(result!.patientName).toBe("Jane Doe")
  })

  it("returns null for not-found (PGRST116)", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "not found" },
        }),
      }),
    })

    const result = await getEnrollmentById("nonexistent")
    expect(result).toBeNull()
  })

  it("throws for other errors", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "42P01", message: "table not found" },
        }),
      }),
    })

    await expect(getEnrollmentById("enr-1")).rejects.toEqual({
      code: "42P01",
      message: "table not found",
    })
  })
})

describe("getDashboardMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("computes counts and paid rate", async () => {
    const enrollments = [
      makeEnrollmentRow({
        id: "e1",
        claims: [{ id: "c1", enrollment_id: "e1", sequence_number: 1, status: "paid", batch_id: "b1", submitted_at: null, responded_at: null, response_status: "P", reject_codes: null, reject_descriptions: null }],
      }),
      makeEnrollmentRow({
        id: "e2",
        claims: [{ id: "c2", enrollment_id: "e2", sequence_number: 1, status: "rejected", batch_id: "b1", submitted_at: null, responded_at: null, response_status: "R", reject_codes: ["75"], reject_descriptions: ["Prior Auth"] }],
      }),
      makeEnrollmentRow({
        id: "e3",
        claims: [],
      }),
    ]

    // First call: getEnrollments
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: enrollments, error: null }),
    })
    // Second call: revenue lookup
    const mockIn = vi.fn().mockResolvedValue({
      data: [{ products: { gross_amount_due: 500 } }],
    })
    const mockSelectRevenue = vi.fn().mockReturnValue({ in: mockIn })

    let callCount = 0
    mockSelect.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return { not: mockNot }
      }
      return mockSelectRevenue()
    })

    const metrics = await getDashboardMetrics()

    expect(metrics.total).toBe(3)
    expect(metrics.paid).toBe(1)
    expect(metrics.rejected).toBe(1)
    expect(metrics.pending).toBe(1)
    expect(metrics.submitted).toBe(0)
    expect(metrics.duplicate).toBe(0)
    expect(metrics.paidRate).toBe("33.3")
    expect(metrics.totalRevenue).toBe(500)
  })

  it("returns zero rate when no enrollments", async () => {
    const mockNot = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    mockSelect.mockReturnValue({ not: mockNot })

    const metrics = await getDashboardMetrics()

    expect(metrics.total).toBe(0)
    expect(metrics.paidRate).toBe("0")
    expect(metrics.totalRevenue).toBe(0)
  })
})
