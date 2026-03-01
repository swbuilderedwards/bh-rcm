import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const NCPDP_SERVICE_URL =
  process.env.NCPDP_SERVICE_URL || "http://localhost:3001"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const view = searchParams.get("view") ?? "raw"

  const supabase = await createClient()

  const { data: batch, error } = await supabase
    .from("batches")
    .select("id, submitted_at, request_body, response_body")
    .eq("id", id)
    .single()

  if (error || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  if (!batch.request_body) {
    return NextResponse.json(
      { error: "No NCPDP data for this batch" },
      { status: 404 },
    )
  }

  const result: Record<string, unknown> = {
    requestBody: batch.request_body,
    responseBody: batch.response_body,
  }

  if (view === "parsed") {
    // Parse request batch
    try {
      const reqResp = await fetch(
        `${NCPDP_SERVICE_URL}/api/claims/ncpdp/parse-batch-text`,
        {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: batch.request_body,
        },
      )
      if (reqResp.ok) {
        result.requestParsed = await reqResp.json()
      } else {
        result.requestParseError = `Parse failed: ${reqResp.status}`
      }
    } catch {
      result.requestParseError = "NCPDP service unavailable"
    }

    // Parse response batch
    if (batch.response_body) {
      try {
        const resResp = await fetch(
          `${NCPDP_SERVICE_URL}/api/claims/ncpdp/parse-response-text`,
          {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: batch.response_body,
          },
        )
        if (resResp.ok) {
          result.responseParsed = await resResp.json()
        } else {
          result.responseParseError = `Parse failed: ${resResp.status}`
        }
      } catch {
        result.responseParseError = "NCPDP service unavailable"
      }
    }
  }

  return NextResponse.json(result)
}
