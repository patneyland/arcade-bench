// Focused enforcement test for recordPlayabilityVote (docs/ux-overhaul.md §7):
// unauth / missing-or-unpublished generation / non-boolean verdict / duplicate /
// rate limit / success+reveal, plus the certification threshold math (85% exactly is
// certified; zero votes is never certified; a single 1/1 playable vote certifies) and
// the getArcade / getNextTestCandidate queue behavior built on the same votes.
// Runs against an isolated Postgres schema so it never touches dev/seed data, and
// mocks Clerk's server auth() to drive the (Clerk-backed) auth provider.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "node:child_process";

// --- isolated Postgres schema wiring (must be set BEFORE importing anything that opens
// Prisma). Uses a uniquely-named schema in the local Supabase Postgres so the test never
// touches dev data, and drops it afterward. If no Postgres is reachable (e.g. CI without a
// database, or Supabase not started), the whole suite is skipped so `npm test` stays green.
const TEST_SCHEMA = `arcade_ptest_${process.pid}_${Date.now()}`;
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
let recordPlayabilityVote: typeof import("./data").recordPlayabilityVote;
let getArcade: typeof import("./data").getArcade;
let getNextTestCandidate: typeof import("./data").getNextTestCandidate;
let resetRateLimits: typeof import("./rate-limit").resetRateLimits;

let genPubId: string; // published, never voted on (oldest — queue head)
let genUnpubId: string; // NOT published — must be rejected
let genSoloId: string; // published — gets the single 1/1 playable vote
let genThresholdId: string; // published — driven to exactly 85% playable
let genBadId: string; // published — below the bar (1/3 playable)
let genZeroId: string; // published, zero votes — never certified / never in arcade
const AUTH_ID = "dev_test_tester";
const POOL = 20; // extra tester users for the threshold math (t0..t19)

beforeAll(async () => {
  if (!dbReady) return; // suite is skipped below; nothing to set up

  ({ prisma } = await import("./db"));
  ({ recordPlayabilityVote, getArcade, getNextTestCandidate } = await import("./data"));
  ({ resetRateLimits } = await import("./rate-limit"));

  // Minimal fixture: 2 models, 1 game, 6 generations, 1 main user + a tester pool.
  // Explicit createdAt values make the fewest-votes/oldest-first queue deterministic.
  const model = await prisma.model.create({
    data: { slug: "m1", name: "M1", vendor: "Google", costPerGen: 0.001 },
  });
  const model2 = await prisma.model.create({
    data: { slug: "m2", name: "M2", vendor: "OpenAI", costPerGen: 0.001 },
  });
  const game = await prisma.game.create({
    data: { slug: "g1", title: "G1", year: 1972, creator: "Atari", prompt: "p", roundOrder: 1, status: "live" },
  });

  const mk = (modelId: string, path: string, published: boolean, day: number) =>
    prisma.generation.create({
      data: {
        modelId,
        gameId: game.id,
        artifactPath: path,
        published,
        createdAt: new Date(Date.UTC(2026, 0, day)),
      },
    });
  genPubId = (await mk(model.id, "/pub.html", true, 1)).id;
  genSoloId = (await mk(model.id, "/solo.html", true, 2)).id;
  genThresholdId = (await mk(model2.id, "/threshold.html", true, 3)).id;
  genBadId = (await mk(model2.id, "/bad.html", true, 4)).id;
  genZeroId = (await mk(model2.id, "/zero.html", true, 5)).id;
  genUnpubId = (await mk(model2.id, "/unpub.html", false, 6)).id;

  await prisma.user.create({
    data: { authId: AUTH_ID, provider: "dev", handle: "tester" },
  });
  for (let i = 0; i < POOL; i++) {
    await prisma.user.create({
      data: { authId: `dev_test_t${i}`, provider: "dev", handle: `t${i}` },
    });
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await prisma.$disconnect();
  }
});

function signInAs(authId: string) {
  clerkSession.userId = authId;
}
function signOut() {
  clerkSession.userId = null;
}

describe.skipIf(!dbReady)("recordPlayabilityVote enforcement", () => {
  it("rejects an unauthenticated caller", async () => {
    signOut();
    resetRateLimits();
    const res = await recordPlayabilityVote({ generationId: genPubId, playable: true });
    expect(res).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects a generation that does not exist", async () => {
    signInAs(AUTH_ID);
    resetRateLimits();
    const res = await recordPlayabilityVote({ generationId: "nope", playable: true });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects an unpublished generation", async () => {
    signInAs(AUTH_ID);
    resetRateLimits();
    const res = await recordPlayabilityVote({ generationId: genUnpubId, playable: true });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects a non-boolean playable value", async () => {
    signInAs(AUTH_ID);
    resetRateLimits();
    const res = await recordPlayabilityVote({
      generationId: genPubId,
      // @ts-expect-error testing runtime validation of a bad verdict
      playable: "yes",
    });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("records a verdict and reveals the model — one 1/1 playable vote certifies", async () => {
    signInAs(AUTH_ID);
    resetRateLimits();
    const res = await recordPlayabilityVote({ generationId: genSoloId, playable: true });
    expect(res.ok).toBe(true);
    expect(res.reveal?.model.slug).toBe("m1");
    expect(res.reveal?.playablePct).toBe(100);
    expect(res.reveal?.votes).toBe(1);
    expect(res.reveal?.certified).toBe(true);

    const count = await prisma.playabilityVote.count();
    expect(count).toBe(1);
  });

  it("rejects a duplicate verdict on the same build", async () => {
    signInAs(AUTH_ID);
    resetRateLimits();
    const res = await recordPlayabilityVote({ generationId: genSoloId, playable: false });
    expect(res).toEqual({ ok: false, error: "duplicate" });
    expect(await prisma.playabilityVote.count()).toBe(1);
  });

  it("rate-limits a user past the per-minute cap", async () => {
    signInAs(AUTH_ID);
    resetRateLimits();
    const { rateLimit } = await import("./rate-limit");
    // Fill the bucket for the key used in data.ts (`pvote:${user.id}`), then verify the
    // next real call is rejected without creating a vote.
    const user = await prisma.user.findUniqueOrThrow({ where: { authId: AUTH_ID } });
    for (let i = 0; i < 30; i++) {
      rateLimit(`pvote:${user.id}`, { limit: 30, windowMs: 60_000 });
    }
    const res = await recordPlayabilityVote({ generationId: genPubId, playable: true });
    expect(res).toEqual({ ok: false, error: "rate_limited" });
    expect(await prisma.playabilityVote.count()).toBe(1);
  });
});

describe.skipIf(!dbReady)("certification threshold math", () => {
  it("84.2% is not certified; exactly 85% is", async () => {
    resetRateLimits();
    // 16 playable + 3 unplayable = 16/19 ≈ 84.2% — below the bar.
    let last: Awaited<ReturnType<typeof recordPlayabilityVote>> | undefined;
    for (let i = 0; i < 19; i++) {
      signInAs(`dev_test_t${i}`);
      last = await recordPlayabilityVote({ generationId: genThresholdId, playable: i < 16 });
      expect(last.ok).toBe(true);
    }
    expect(last?.reveal?.votes).toBe(19);
    expect(last?.reveal?.playablePct).toBeCloseTo((16 / 19) * 100, 5);
    expect(last?.reveal?.certified).toBe(false);

    // One more playable: 17/20 = 85% exactly — certified (threshold is inclusive).
    signInAs("dev_test_t19");
    const res = await recordPlayabilityVote({ generationId: genThresholdId, playable: true });
    expect(res.ok).toBe(true);
    expect(res.reveal?.votes).toBe(20);
    expect(res.reveal?.playablePct).toBe(85);
    expect(res.reveal?.certified).toBe(true);
  });

  it("getArcade lists certified builds only — zero votes is never certified", async () => {
    // Arrange a below-the-bar build directly (1/3 playable = 33%).
    const testers = await prisma.user.findMany({
      where: { authId: { in: ["dev_test_t0", "dev_test_t1", "dev_test_t2"] } },
    });
    await prisma.playabilityVote.createMany({
      data: testers.map((u, i) => ({
        userId: u.id,
        generationId: genBadId,
        playable: i === 0,
      })),
    });

    const arcade = await getArcade();
    const ids = arcade.map((e) => e.generationId);
    expect(ids).toContain(genSoloId); // 1/1 = 100%
    expect(ids).toContain(genThresholdId); // 17/20 = 85% exactly
    expect(ids).not.toContain(genBadId); // 33% — reported unplayable
    expect(ids).not.toContain(genZeroId); // zero votes — never certified
    expect(ids).not.toContain(genPubId); // zero votes — never certified
    expect(ids).not.toContain(genUnpubId); // unpublished

    // Identity is SHOWN in the arcade, and stats are populated.
    const solo = arcade.find((e) => e.generationId === genSoloId);
    expect(solo?.model.slug).toBe("m1");
    expect(solo?.playablePct).toBe(100);
    expect(solo?.votes).toBe(1);
  });

  it("getNextTestCandidate serves fewest-votes-first, oldest-first, never re-serves", async () => {
    // Main user has voted only on genSolo. Fewest votes = genPub and genZero (0 each);
    // genPub is older, so it wins the tie. Model identity must be omitted.
    signInAs(AUTH_ID);
    const cand = await getNextTestCandidate();
    expect(cand?.generationId).toBe(genPubId);
    expect(cand?.votes).toBe(0);
    expect(cand && "model" in cand).toBe(false);

    // Unauthenticated -> null.
    signOut();
    expect(await getNextTestCandidate()).toBeNull();
  });

  it("returns null when the tester has screened everything", async () => {
    const done = await prisma.user.create({
      data: { authId: "dev_test_done", provider: "dev", handle: "done" },
    });
    await prisma.playabilityVote.createMany({
      data: [genPubId, genSoloId, genThresholdId, genBadId, genZeroId].map((id) => ({
        userId: done.id,
        generationId: id,
        playable: true,
      })),
    });
    signInAs("dev_test_done");
    expect(await getNextTestCandidate()).toBeNull();
  });
});
