// Auth abstraction — structured so Clerk (the production target per PLAN.md) or
// Auth.js can drop in behind these functions. In dev, a cookie-based mock lets the
// whole vote loop run with zero external credentials.
//
// CONTRACT: getSessionUser() / requireGrader() signatures are stable. This file
// implements the DEV provider. To go to production, swap the bodies marked
// `=== CLERK SEAM ===` for Clerk's `auth()` / `currentUser()` — everything downstream
// (lib/data, app/api) only depends on getSessionUser() returning a SessionUser.
//
// The dev session is a simple signed cookie `ab_session` carrying a stable authId. It is
// NOT cryptographically strong auth — it exists purely so votes can be attributed to a
// consistent identity in local dev. Real trust comes from Clerk in production.

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import type { SessionUser } from "./types";

const COOKIE_NAME = "ab_session";
const DEV_PROVIDER = "dev";
// A throwaway secret for signing the dev cookie. Override via env in shared dev setups.
const DEV_SECRET = process.env.AB_DEV_SECRET ?? "arcade-bench-dev-secret";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(authId: string): string {
  const mac = createHmac("sha256", DEV_SECRET).update(authId).digest("base64url");
  return `${authId}.${mac}`;
}

/** Verify a signed cookie value, returning the authId or null if tampered/invalid. */
function verify(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const authId = value.slice(0, idx);
  const provided = value.slice(idx + 1);
  const expected = createHmac("sha256", DEV_SECRET).update(authId).digest("base64url");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return authId;
}

/**
 * Returns the current grader, or null if anonymous.
 * === CLERK SEAM === In production, read Clerk's session here instead of the cookie,
 * map the Clerk user id -> authId, and keep the same find-or-create + voteCount shape.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const authId = verify(store.get(COOKIE_NAME)?.value);
  if (!authId) return null;

  // Find-or-create the User row keyed by the stable authId.
  const user = await prisma.user.upsert({
    where: { authId },
    update: {},
    create: { authId, provider: DEV_PROVIDER, handle: deriveHandle(authId) },
    include: { _count: { select: { votes: true } } },
  });

  return {
    id: user.id,
    handle: user.handle,
    provider: user.provider,
    voteCount: user._count.votes,
  };
}

/** Voting gate. Returns the grader or null; callers reject the vote when null. */
export async function requireGrader(): Promise<SessionUser | null> {
  return getSessionUser();
}

/**
 * Dev sign-in: create or find a `dev` User and set the signed cookie.
 * Must be called from a Route Handler / Server Action (it writes a cookie).
 */
export async function signInDev(handle?: string): Promise<SessionUser> {
  const authId = `dev_${randomBytes(8).toString("hex")}`;
  const resolvedHandle = handle?.trim() || deriveHandle(authId);

  const user = await prisma.user.create({
    data: { authId, provider: DEV_PROVIDER, handle: resolvedHandle },
    include: { _count: { select: { votes: true } } },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, sign(authId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return {
    id: user.id,
    handle: user.handle,
    provider: user.provider,
    voteCount: user._count.votes,
  };
}

/** Clear the dev session cookie. */
export async function signOutDev(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

function deriveHandle(authId: string): string {
  const suffix = authId.replace(/^dev_/, "").slice(0, 6);
  return `grader-${suffix}`;
}
