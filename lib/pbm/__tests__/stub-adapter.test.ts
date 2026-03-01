import { describe, it, expect, vi, beforeEach } from "vitest"

// Track all supabase operations for assertions
let operations: { table: string; method: string; data: unknown }[] = []
let paidClaimsResponse: { data: unknown[] | null; error: unknown }

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => {
    return Promise.resolve({
      from: (table: string) => ({
        select: (fields: string) => {
          if (table === "claims" && fields === "enrollment_id") {
            return {
              in: (_col: string, _ids: string[]) => ({
                eq: (_col2: string, _val: string) => {
                  return Promise.resolve(paidClaimsResponse)
                },
              }),
            }
          }
          return {}
        },
        update: (data: unknown) => ({
          eq: (_col: string, id: string) => {
            operations.push({ table, method: "update", data: { ...data as Record<string, unknown>, id } })
            return Promise.resolve({ error: null })
          },
        }),
      }),
    })
  }),
}))

import { StubAdapter } from "../stub-adapter"
import type { BatchSubmission } from "@/lib/claims/types"

describe("StubAdapter", () => {
  let adapter: StubAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    operations = []
    paidClaimsResponse = { data: [], error: null }
    adapter = new StubAdapter()
  })

  it("marks claims for already-paid enrollments as duplicate", async () => {
    paidClaimsResponse = {
      data: [{ enrollment_id: "enr-1" }],
      error: null,
    }

    // Seed Math.random to control outcome (won't matter for duplicates)
    const batch: BatchSubmission = {
      batchId: "bat-1",
      billingType: "cvs",
      claims: [
        { claimId: "clm-1", enrollmentId: "enr-1", sequenceNumber: 2, serviceDate: "2025-02-28" },
      ],
    }

    await adapter.submitBatch(batch)

    const claimUpdate = operations.find(
      (op) => op.table === "claims" && (op.data as Record<string, unknown>).id === "clm-1",
    )
    expect(claimUpdate).toBeDefined()
    expect((claimUpdate!.data as Record<string, unknown>).status).toBe("duplicate")
    expect((claimUpdate!.data as Record<string, unknown>).response_status).toBe("D")

    // Batch should be updated with duplicate_count: 1
    const batchUpdate = operations.find((op) => op.table === "batches")
    expect(batchUpdate).toBeDefined()
    expect((batchUpdate!.data as Record<string, unknown>).duplicate_count).toBe(1)
  })

  it("assigns paid or rejected randomly and updates batch counts", async () => {
    // Control randomness
    let callIndex = 0
    const randomValues = [0.3, 0.7] // first claim < 0.5 → paid, second ≥ 0.5 → rejected
    vi.spyOn(Math, "random").mockImplementation(() => randomValues[callIndex++] ?? 0.5)

    const batch: BatchSubmission = {
      batchId: "bat-1",
      billingType: "cvs",
      claims: [
        { claimId: "clm-1", enrollmentId: "enr-1", sequenceNumber: 1, serviceDate: "2025-02-28" },
        { claimId: "clm-2", enrollmentId: "enr-2", sequenceNumber: 1, serviceDate: "2025-02-28" },
      ],
    }

    await adapter.submitBatch(batch)

    const clm1 = operations.find(
      (op) => op.table === "claims" && (op.data as Record<string, unknown>).id === "clm-1",
    )
    expect((clm1!.data as Record<string, unknown>).status).toBe("paid")
    expect((clm1!.data as Record<string, unknown>).response_status).toBe("P")

    const clm2 = operations.find(
      (op) => op.table === "claims" && (op.data as Record<string, unknown>).id === "clm-2",
    )
    expect((clm2!.data as Record<string, unknown>).status).toBe("rejected")
    expect((clm2!.data as Record<string, unknown>).response_status).toBe("R")
    expect((clm2!.data as Record<string, unknown>).reject_codes).toBeTruthy()

    const batchUpdate = operations.find((op) => op.table === "batches")
    expect((batchUpdate!.data as Record<string, unknown>).paid_count).toBe(1)
    expect((batchUpdate!.data as Record<string, unknown>).rejected_count).toBe(1)
    expect((batchUpdate!.data as Record<string, unknown>).duplicate_count).toBe(0)
  })

  it("detects within-batch duplicates after a paid claim", async () => {
    // Both claims for same enrollment; first is paid, second should be duplicate
    let callIndex = 0
    vi.spyOn(Math, "random").mockImplementation(() => {
      callIndex++
      return 0.1 // always < 0.5 → paid
    })

    const batch: BatchSubmission = {
      batchId: "bat-1",
      billingType: "cvs",
      claims: [
        { claimId: "clm-1", enrollmentId: "enr-1", sequenceNumber: 1, serviceDate: "2025-02-28" },
        { claimId: "clm-2", enrollmentId: "enr-1", sequenceNumber: 2, serviceDate: "2025-02-28" },
      ],
    }

    await adapter.submitBatch(batch)

    const clm1 = operations.find(
      (op) => op.table === "claims" && (op.data as Record<string, unknown>).id === "clm-1",
    )
    expect((clm1!.data as Record<string, unknown>).status).toBe("paid")

    const clm2 = operations.find(
      (op) => op.table === "claims" && (op.data as Record<string, unknown>).id === "clm-2",
    )
    expect((clm2!.data as Record<string, unknown>).status).toBe("duplicate")

    const batchUpdate = operations.find((op) => op.table === "batches")
    expect((batchUpdate!.data as Record<string, unknown>).paid_count).toBe(1)
    expect((batchUpdate!.data as Record<string, unknown>).duplicate_count).toBe(1)
  })

  it("throws when the paid-claims lookup fails", async () => {
    paidClaimsResponse = { data: null, error: { message: "db fail" } }

    const batch: BatchSubmission = {
      batchId: "bat-1",
      billingType: "cvs",
      claims: [
        { claimId: "clm-1", enrollmentId: "enr-1", sequenceNumber: 1, serviceDate: "2025-02-28" },
      ],
    }

    await expect(adapter.submitBatch(batch)).rejects.toEqual({ message: "db fail" })
  })
})
