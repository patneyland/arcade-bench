// POST /api/auth/dev-signin — optional { handle } -> sets the dev cookie, returns SessionUser.
// Dev-only mock sign-in. === CLERK SEAM === production sign-in flows through Clerk instead.

import { NextResponse } from "next/server";
import { z } from "zod";
import { signInDev } from "@/lib/auth";

const BodySchema = z.object({ handle: z.string().trim().min(1).max(40).optional() });

export async function POST(req: Request) {
  let handle: string | undefined;
  // Body is optional; tolerate empty/missing JSON.
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (json && !parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    handle = parsed.success ? parsed.data.handle : undefined;
  } catch {
    handle = undefined;
  }

  const user = await signInDev(handle);
  return NextResponse.json(user, { status: 201 });
}
