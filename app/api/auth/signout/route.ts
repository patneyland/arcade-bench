// POST /api/auth/signout — clears the session cookie, returns { ok: true }.

import { NextResponse } from "next/server";
import { signOutDev } from "@/lib/auth";

export async function POST() {
  await signOutDev();
  return NextResponse.json({ ok: true });
}
