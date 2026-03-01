export interface BatchClaim {
  claimId: string
  enrollmentId: string
  sequenceNumber: number
  serviceDate: string
}

export interface BatchSubmission {
  batchId: string
  billingType: string
  claims: BatchClaim[]
}

export interface PbmGateway {
  submitBatch(batch: BatchSubmission): Promise<void>
}
