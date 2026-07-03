// GET /api/playability/next — the next build for a signed-in tester to screen.
// 200 JSON TestCandidate (or null when the queue is empty); 401 null when signed out.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getNextTestCandidate } from "@/lib/data";

export const dynamic = "force-dynamic"; // never cache: the queue moves with every vote

export async function GET() {
  // Distinguish "signed out" (401) from "queue empty" (200 null) — the data layer
  // returns null for both, so check the session here.
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const candidate = await getNextTestCandidate();
  return NextResponse.json(candidate);
}
