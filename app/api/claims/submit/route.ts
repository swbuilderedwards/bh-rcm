import { NextResponse } from "next/server"
import { z } from "zod"
import { submitClaims } from "@/lib/claims/submission-service"

const submitSchema = z.object({
  enrollmentIds: z.array(z.string().uuid()).min(1),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (body === null) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const parsed = submitSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const batchIds = await submitClaims(parsed.data.enrollmentIds)

  return NextResponse.json({ batchIds })
}
