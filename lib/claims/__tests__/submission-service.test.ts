import { describe, it, expect, vi, beforeEach } from "vitest"

const mockSubmitBatch = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/claims/gateway-registry", () => ({
  getGateway: vi.fn(() => ({ submitBatch: mockSubmitBatch })),
}))

// Each test configures this array of responses that will be consumed in order
// Each entry corresponds to a full chain resolution (the final awaited value)
let responseQueue: { data: unknown; error: unknown }[] = []

function mockChain() {
  // Returns a proxy that accepts any chain of method calls and resolves
  // to the next response in the queue when awaited
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        const response = responseQueue.shift() ?? { data: null, error: null }
        return (resolve: (v: unknown) => void) => resolve(response)
      }
      // Any method call returns another chainable proxy
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: () => mockChain(),
    }),
  ),
}))

import { submitClaims, submitReady } from "../submission-service"

describe("submitClaims", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    responseQueue = []
  })

  it("creates batches grouped by billing type and calls gateway", async () => {
    responseQueue = [
      // 1. enrollments.select(...).in(...)
      {
        data: [
          {
            id: "enr-1",
            organization_id: "org-1",
            organizations: { billing_type: "cvs" },
            claims: [{ sequence_number: 1 }],
          },
          {
            id: "enr-2",
            organization_id: "org-2",
            organizations: { billing_type: "cvs" },
            claims: [],
          },
        ],
        error: null,
      },
      // 2. batches.insert(...).select("id").single()
      { data: { id: "batch-1" }, error: null },
      // 3. claims.insert(...).select(...)
      {
        data: [
          { id: "clm-1", enrollment_id: "enr-1", sequence_number: 2, service_date: "2025-02-28" },
          { id: "clm-2", enrollment_id: "enr-2", sequence_number: 1, service_date: "2025-02-28" },
        ],
        error: null,
      },
    ]

    const batchIds = await submitClaims(["enr-1", "enr-2"])

    expect(batchIds).toEqual(["batch-1"])
    expect(mockSubmitBatch).toHaveBeenCalledTimes(1)
    expect(mockSubmitBatch).toHaveBeenCalledWith({
      batchId: "batch-1",
      billingType: "cvs",
      claims: [
        { claimId: "clm-1", enrollmentId: "enr-1", sequenceNumber: 2, serviceDate: "2025-02-28" },
        { claimId: "clm-2", enrollmentId: "enr-2", sequenceNumber: 1, serviceDate: "2025-02-28" },
      ],
    })
  })

  it("returns empty array when no enrollments found", async () => {
    responseQueue = [{ data: [], error: null }]

    const batchIds = await submitClaims(["nonexistent"])
    expect(batchIds).toEqual([])
  })

  it("throws when enrollment query fails", async () => {
    responseQueue = [{ data: null, error: { message: "db error" } }]

    await expect(submitClaims(["enr-1"])).rejects.toEqual({ message: "db error" })
  })

  it("increments sequence number from max existing claim", async () => {
    responseQueue = [
      {
        data: [
          {
            id: "enr-1",
            organization_id: "org-1",
            organizations: { billing_type: "direct" },
            claims: [{ sequence_number: 3 }, { sequence_number: 5 }],
          },
        ],
        error: null,
      },
      { data: { id: "batch-1" }, error: null },
      {
        data: [
          { id: "clm-1", enrollment_id: "enr-1", sequence_number: 6, service_date: "2025-02-28" },
        ],
        error: null,
      },
    ]

    const batchIds = await submitClaims(["enr-1"])

    expect(batchIds).toEqual(["batch-1"])
    expect(mockSubmitBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: [expect.objectContaining({ sequenceNumber: 6 })],
      }),
    )
  })

  it("defaults to 'direct' when organization has no billing_type", async () => {
    responseQueue = [
      {
        data: [
          {
            id: "enr-1",
            organization_id: "org-1",
            organizations: null,
            claims: [],
          },
        ],
        error: null,
      },
      { data: { id: "batch-1" }, error: null },
      {
        data: [
          { id: "clm-1", enrollment_id: "enr-1", sequence_number: 1, service_date: "2025-02-28" },
        ],
        error: null,
      },
    ]

    const batchIds = await submitClaims(["enr-1"])

    expect(batchIds).toHaveLength(1)
    expect(mockSubmitBatch).toHaveBeenCalledWith(
      expect.objectContaining({ billingType: "direct" }),
    )
  })

  it("creates separate batches for different billing types", async () => {
    responseQueue = [
      {
        data: [
          {
            id: "enr-1",
            organization_id: "org-1",
            organizations: { billing_type: "cvs" },
            claims: [],
          },
          {
            id: "enr-2",
            organization_id: "org-2",
            organizations: { billing_type: "esi" },
            claims: [],
          },
        ],
        error: null,
      },
      // batch for cvs
      { data: { id: "batch-cvs" }, error: null },
      {
        data: [
          { id: "clm-1", enrollment_id: "enr-1", sequence_number: 1, service_date: "2025-02-28" },
        ],
        error: null,
      },
      // batch for esi
      { data: { id: "batch-esi" }, error: null },
      {
        data: [
          { id: "clm-2", enrollment_id: "enr-2", sequence_number: 1, service_date: "2025-02-28" },
        ],
        error: null,
      },
    ]

    const batchIds = await submitClaims(["enr-1", "enr-2"])

    expect(batchIds).toEqual(["batch-cvs", "batch-esi"])
    expect(mockSubmitBatch).toHaveBeenCalledTimes(2)
  })
})

describe("submitReady", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    responseQueue = []
  })

  it("returns empty when no billable enrollments", async () => {
    responseQueue = [{ data: [], error: null }]

    const result = await submitReady()
    expect(result).toEqual([])
  })

  it("filters to enrollments with no claims or latest rejected", async () => {
    responseQueue = [
      // 1. submitReady query: enrollments with claims
      {
        data: [
          { id: "enr-1", claims: [] },
          {
            id: "enr-2",
            claims: [
              { id: "c1", sequence_number: 1, response_status: "P" },
              { id: "c2", sequence_number: 2, response_status: "R" },
            ],
          },
          {
            id: "enr-3",
            claims: [
              { id: "c3", sequence_number: 1, response_status: "R" },
              { id: "c4", sequence_number: 2, response_status: "P" },
            ],
          },
        ],
        error: null,
      },
      // 2. submitForEnrollments: enrollments query
      {
        data: [
          {
            id: "enr-1",
            organization_id: "org-1",
            organizations: { billing_type: "cvs" },
            claims: [],
          },
          {
            id: "enr-2",
            organization_id: "org-1",
            organizations: { billing_type: "cvs" },
            claims: [{ sequence_number: 2 }],
          },
        ],
        error: null,
      },
      // 3. batch insert
      { data: { id: "batch-1" }, error: null },
      // 4. claims insert
      {
        data: [
          { id: "clm-1", enrollment_id: "enr-1", sequence_number: 1, service_date: "2025-02-28" },
          { id: "clm-2", enrollment_id: "enr-2", sequence_number: 3, service_date: "2025-02-28" },
        ],
        error: null,
      },
    ]

    const result = await submitReady()

    expect(result).toEqual(["batch-1"])
    expect(mockSubmitBatch).toHaveBeenCalledTimes(1)
    const submission = mockSubmitBatch.mock.calls[0][0]
    expect(submission.claims).toHaveLength(2)
  })

  it("returns empty when all enrollments already paid", async () => {
    responseQueue = [
      {
        data: [
          {
            id: "enr-1",
            claims: [{ id: "c1", sequence_number: 1, response_status: "P" }],
          },
        ],
        error: null,
      },
    ]

    const result = await submitReady()
    expect(result).toEqual([])
  })
})
