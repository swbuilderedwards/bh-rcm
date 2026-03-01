import { NextResponse } from "next/server"
import { submitReady } from "@/lib/claims/submission-service"

export async function POST(request: Request) {
  // Optional CRON_SECRET auth
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const batchIds = await submitReady()

  return NextResponse.json({
    batchIds,
    message: `Submitted ${batchIds.length} batch(es)`,
  })
}
