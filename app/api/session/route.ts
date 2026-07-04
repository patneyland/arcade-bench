// GET /api/session -> SessionUser | null (the current grader, or null if anonymous).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic"; // session is request-specific

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json(user);
}
