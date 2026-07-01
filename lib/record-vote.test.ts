// Focused enforcement test for recordVote: unauth / winner validation / cross-game /
// duplicate / success+reveal. Runs against a throwaway SQLite DB so it never touches the
// dev/seed data, and mocks Clerk's server auth() to drive the (Clerk-backed) auth provider.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "node:child_process";

// --- isolated Postgres schema wiring (must be set BEFORE importing anything that opens
// Prisma). Uses a uniquely-named schema in the local Supabase Postgres so the test never
// touches dev data, and drops it afterward. If no Postgres is reachable (e.g. CI without a
// database, or Supabase not started), the whole suite is skipped so `npm test` stays green.
const TEST_SCHEMA = `arcade_test_${process.pid}_${Date.now()}`;
const BASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const TEST_URL = `${BASE_URL.split("?")[0]}?schema=${TEST_SCHEMA}`;
process.env.DATABASE_URL = TEST_URL;
// `prisma db push` connects via directUrl when the datasource declares one, so it must
// point at the same isolated schema or the tables land in the wrong place.
process.env.DIRECT_URL = TEST_URL;

// Create the schema by pushing the Prisma schema into it. Probe reachability synchronously
// so we can decide whether to run or skip the suite at collection time.
let dbReady = false;
try {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_URL, DIRECT_URL: TEST_URL },
    stdio: "ignore",
    timeout: 90_000,
  });
  dbReady = true;
} catch {
  dbReady = false;
}

// --- a controllable Clerk session standing in for @clerk/nextjs/server ---
// hoisted so the vi.mock factory (which is itself hoisted above imports) can read it.
const clerkSession = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerkSession.userId }),
  currentUser: async () =>
    clerkSession.userId
      ? { id: clerkSession.userId, username: "tester", emailAddresses: [], externalAccounts: [] }
      : null,
}));

// Imported lazily after env + mocks are in place.
let prisma: typeof import("./db").prisma;
let recordVote: typeof import("./data").recordVote;
let resetRateLimits: typeof import("./rate-limit").resetRateLimits;

let gameId: string;
let altGameId: string;
let genAId: string;
let genBId: string;
let altGenId: string;
const AUTH_ID = "dev_test_grader";

beforeAll(async () => {
  if (!dbReady) return; // suite is skipped below; nothing to set up

  ({ prisma } = await import("./db"));
  ({ recordVote } = await import("./data"));
  ({ resetRateLimits } = await import("./rate-limit"));

  // Minimal fixture: 1 model, 2 games, 3 generations, 1 user.
  const model = await prisma.model.create({
    data: { slug: "m1", name: "M1", vendor: "Google", costPerGen: 0.001 },
  });
  const model2 = await prisma.model.create({
    data: { slug: "m2", name: "M2", vendor: "OpenAI", costPerGen: 0.001 },
  });
  const game = await prisma.game.create({
    data: { slug: "g1", title: "G1", year: 1972, creator: "Atari", prompt: "p", roundOrder: 1, status: "live" },
  });
  const altGame = await prisma.game.create({
    data: { slug: "g2", title: "G2", year: 1976, creator: "Atari", prompt: "p", roundOrder: 2, status: "live" },
  });
  gameId = game.id;
  altGameId = altGame.id;

  const ga = await prisma.generation.create({
    data: { modelId: model.id, gameId: game.id, artifactPath: "/a.html", published: true },
  });
  const gb = await prisma.generation.create({
    data: { modelId: model2.id, gameId: game.id, artifactPath: "/b.html", published: true },
  });
  const alt = await prisma.generation.create({
    data: { modelId: model.id, gameId: altGame.id, artifactPath: "/c.html", published: true },
  });
  genAId = ga.id;
  genBId = gb.id;
  altGenId = alt.id;

  await prisma.user.create({
    data: { authId: AUTH_ID, provider: "dev", handle: "tester" },
  });
});

afterAll(async () => {
  if (prisma) {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await prisma.$disconnect();
  }
});

function signIn() {
  clerkSession.userId = AUTH_ID;
}
function signOut() {
  clerkSession.userId = null;
}

describe.skipIf(!dbReady)("recordVote enforcement", () => {
  it("rejects an unauthenticated caller", async () => {
    signOut();
    resetRateLimits();
    const res = await recordVote({ gameId, genAId, genBId, winner: "a" });
    expect(res).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects an invalid winner value", async () => {
    signIn();
    resetRateLimits();
    const res = await recordVote({
      gameId,
      genAId,
      genBId,
      // @ts-expect-error testing runtime validation of a bad winner
      winner: "left",
    });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects identical generations", async () => {
    signIn();
    resetRateLimits();
    const res = await recordVote({ gameId, genAId, genBId: genAId, winner: "a" });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects a generation that does not belong to the game", async () => {
    signIn();
    resetRateLimits();
    const res = await recordVote({ gameId, genAId, genBId: altGenId, winner: "a" });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("records a valid vote and reveals both identities", async () => {
    signIn();
    resetRateLimits();
    const res = await recordVote({ gameId, genAId, genBId, winner: "a" });
    expect(res.ok).toBe(true);
    expect(res.reveal?.a.slug).toBe("m1");
    expect(res.reveal?.b.slug).toBe("m2");

    const count = await prisma.vote.count();
    expect(count).toBe(1);
  });

  it("rejects a duplicate vote for the same pairing", async () => {
    signIn();
    resetRateLimits();
    const res = await recordVote({ gameId, genAId, genBId, winner: "b" });
    expect(res).toEqual({ ok: false, error: "duplicate" });
  });

  it("counts both_bad as a recorded vote (different pairing order)", async () => {
    signIn();
    resetRateLimits();
    // reversed order is a distinct ordered pairing
    const res = await recordVote({ gameId, genAId: genBId, genBId: genAId, winner: "both_bad" });
    expect(res.ok).toBe(true);
    const count = await prisma.vote.count();
    expect(count).toBe(2);
  });

  it("rate-limits a user past the per-minute cap", async () => {
    signIn();
    resetRateLimits();
    // Exhaust the limit with cheap invalid attempts would not consume the bucket
    // (rate check runs after validation). Use the create path: but we only have one
    // valid pairing left. Instead, drive the limiter directly via many valid-shaped
    // calls against fresh pairings is overkill — assert the limiter wiring by spamming
    // the same (now-duplicate) pairing after manually filling the bucket.
    const { rateLimit } = await import("./rate-limit");
    // Look up the user id to match the key used in data.ts (`vote:${user.id}`).
    const user = await prisma.user.findUniqueOrThrow({ where: { authId: AUTH_ID } });
    for (let i = 0; i < 30; i++) {
      rateLimit(`vote:${user.id}`, { limit: 30, windowMs: 60_000 });
    }
    const res = await recordVote({ gameId, genAId, genBId, winner: "a" });
    expect(res).toEqual({ ok: false, error: "rate_limited" });
  });
});
