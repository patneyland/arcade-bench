// Auth provider — Clerk (the production target per PLAN.md) is now the source of truth.
// Clerk owns sign-in/sign-up (hosted components at /sign-in, /sign-up) and the session;
// here we map the stable Clerk user id onto our User.authId (find-or-create) and return
// the same SessionUser shape, so everything downstream (lib/data, app/api) is unchanged.
//
// CONTRACT: getSessionUser() / requireGrader() signatures are stable. There is no dev
// cookie + no /api/auth/* sign-in routes anymore — auth state flows from Clerk's
// middleware (see middleware.ts) and is read here via auth() / currentUser().

import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./types";

type ClerkUser = Awaited<ReturnType<typeof currentUser>>;

/**
 * Returns the current grader, or null if anonymous.
 * Maps the Clerk user id -> User.authId (find-or-create), preserving voteCount.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // Fast path: a grader we've already seen. This avoids a Clerk profile fetch on the hot
  // path — getSessionUser runs on every authenticated request (Nav session poll + each vote).
  const existing = await prisma.user.findUnique({
    where: { authId: userId },
    include: { _count: { select: { votes: true } } },
  });
  if (existing) return toSessionUser(existing, existing._count.votes);

  // First time we've seen this Clerk user: fetch the profile once to seed handle/provider,
  // then upsert (not create) so two concurrent first-requests can't collide on authId.
  const clerkUser = await currentUser();
  const created = await prisma.user.upsert({
    where: { authId: userId },
    update: {},
    create: {
      authId: userId,
      provider: deriveProvider(clerkUser),
      handle: deriveHandle(clerkUser, userId),
    },
    include: { _count: { select: { votes: true } } },
  });
  return toSessionUser(created, created._count.votes);
}

/** Voting gate. Returns the grader or null; callers reject the vote when null. */
export async function requireGrader(): Promise<SessionUser | null> {
  return getSessionUser();
}

function toSessionUser(user: User, voteCount: number): SessionUser {
  return { id: user.id, handle: user.handle, provider: user.provider, voteCount };
}

/** Map a Clerk external-account provider ("oauth_google") onto our short label (github | google). */
function deriveProvider(user: ClerkUser): string {
  const ext = user?.externalAccounts?.[0]?.provider; // e.g. "oauth_google"
  if (ext) return ext.replace(/^oauth_/, "");
  return "clerk";
}

/** A human-friendly handle: Clerk username -> email local-part -> first name -> id suffix. */
function deriveHandle(user: ClerkUser, userId: string): string {
  if (user?.username) return user.username;
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (email) return email.split("@")[0];
  if (user?.firstName) return user.firstName;
  return `grader-${userId.slice(-6)}`;
}
