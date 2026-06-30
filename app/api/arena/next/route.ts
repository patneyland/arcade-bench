// GET /api/arena/next?game=<slug> — a fresh random ArenaPairing, or 404 if none.

import { NextResponse } from "next/server";
import { getArenaPairing } from "@/lib/data";

export const dynamic = "force-dynamic"; // never cache: each call is a new random pairing

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game") ?? undefined;

  const pairing = await getArenaPairing(game);
  if (!pairing) {
    return NextResponse.json({ error: "no_pairing" }, { status: 404 });
  }
  return NextResponse.json(pairing);
}
