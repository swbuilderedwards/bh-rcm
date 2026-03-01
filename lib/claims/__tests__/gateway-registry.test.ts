import { describe, it, expect } from "vitest"
import { getGateway } from "../gateway-registry"
import { StubAdapter } from "@/lib/pbm/stub-adapter"
import { CvsStubAdapter } from "@/lib/pbm/cvs-stub-adapter"

describe("getGateway", () => {
  it("returns a gateway for 'cvs'", () => {
    const gw = getGateway("cvs")
    expect(gw).toBeInstanceOf(CvsStubAdapter)
  })

  it("returns a gateway for 'esi'", () => {
    const gw = getGateway("esi")
    expect(gw).toBeInstanceOf(StubAdapter)
  })

  it("returns a gateway for 'direct'", () => {
    const gw = getGateway("direct")
    expect(gw).toBeInstanceOf(StubAdapter)
  })

  it("throws for unknown billing type", () => {
    expect(() => getGateway("unknown")).toThrow(
      "No gateway registered for billing type: unknown",
    )
  })

  it("throws for empty string", () => {
    expect(() => getGateway("")).toThrow(
      "No gateway registered for billing type: ",
    )
  })
})
