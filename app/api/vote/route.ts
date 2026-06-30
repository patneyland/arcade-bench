// POST /api/vote — record a pairwise vote.
// Body: { gameId, genAId, genBId, winner } -> RecordVoteResult JSON.

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordVote } from "@/lib/data";
import { VOTE_WINNERS } from "@/lib/constants";

const BodySchema = z.object({
  gameId: z.string().min(1),
  genAId: z.string().min(1),
  genBId: z.string().min(1),
  winner: z.enum(VOTE_WINNERS),
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

  const result = await recordVote(parsed.data);

  if (result.ok) return NextResponse.json(result, { status: 201 });

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
