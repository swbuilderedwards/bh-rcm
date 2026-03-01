import type { PbmGateway } from "./types"
import { StubAdapter } from "@/lib/pbm/stub-adapter"
import { CvsStubAdapter } from "@/lib/pbm/cvs-stub-adapter"

const gateways: Record<string, PbmGateway> = {
  cvs: new CvsStubAdapter(),
  esi: new StubAdapter(),
  direct: new StubAdapter(),
}

export function getGateway(billingType: string): PbmGateway {
  const gateway = gateways[billingType]
  if (!gateway) {
    throw new Error(`No gateway registered for billing type: ${billingType}`)
  }
  return gateway
}
