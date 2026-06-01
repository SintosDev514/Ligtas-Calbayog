import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const body = await req.json()
  const image = body?.image

  if (!image || typeof image !== "string") {
    return new Response(
      JSON.stringify({ error: "missing image" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  return new Response(
    JSON.stringify({ faceDetected: true, faceCount: 1, confidence: 1 }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
})
