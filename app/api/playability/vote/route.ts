// POST /api/playability/vote — record a playable/not-playable verdict.
// Body: { generationId, playable } -> RecordPlayabilityResult JSON.

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordPlayabilityVote } from "@/lib/data";

const BodySchema = z.object({
  generationId: z.string().min(1),
  playable: z.boolean(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const result = await recordPlayabilityVote(parsed.data);

  if (result.ok) return NextResponse.json(result, { status: 200 });

  const status =
    result.error === "unauthenticated"
      ? 401
      : result.error === "duplicate"
        ? 409
        : result.error === "rate_limited"
          ? 429
          : 400;
  return NextResponse.json(result, { status });
}
