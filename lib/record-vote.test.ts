// Focused enforcement test for recordVote: unauth / winner validation / cross-game /
// duplicate / success+reveal. Runs against a throwaway SQLite DB so it never touches the
// dev/seed data, and mocks `next/headers` cookies to drive the dev auth provider.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";

// --- temp DB wiring (must be set BEFORE importing anything that opens Prisma) ---
const dir = mkdtempSync(join(tmpdir(), "arcade-bench-test-"));
const dbFile = join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, "/")}`;

// --- a controllable in-memory cookie store standing in for next/headers ---
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

// Sign a dev cookie the same way lib/auth does (HMAC over the authId).
const DEV_SECRET = process.env.AB_DEV_SECRET ?? "arcade-bench-dev-secret";
function signCookie(authId: string): string {
  const mac = createHmac("sha256", DEV_SECRET).update(authId).digest("base64url");
  return `${authId}.${mac}`;
}

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
  // Create the schema in the temp DB.
  execSync("npx prisma db push --skip-generate", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "ignore",
  });

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
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

function signIn() {
  cookieStore.set("ab_session", signCookie(AUTH_ID));
}
function signOut() {
  cookieStore.clear();
}

describe("recordVote enforcement", () => {
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
