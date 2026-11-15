/// <reference types="vite/client" />
/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { registerPassword } from "@convex-dev/auth/components/password/test";
import { registerUsername } from "@convex-dev/auth/components/username/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { allocatePool } from "./settlement";
import type { Id } from "./_generated/dataModel";

vi.mock("password-hash-wasm/argon2id", async () => {
  const { readFile } = await import("node:fs/promises");
  const wasm =
    await import("../node_modules/password-hash-wasm/rust/pkg/argon2id/argon2id.js");
  const bytes = await readFile(
    "node_modules/password-hash-wasm/rust/pkg/argon2id/argon2id_bg.wasm",
  );
  await wasm.default({ module_or_path: bytes });
  return {
    hashPassword: async (password: string) =>
      wasm.hash_password(password, crypto.getRandomValues(new Uint8Array(16))),
    verifyPassword: async (password: string, hash: string) =>
      wasm.verify_password(password, hash),
  };
});

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
function setup() {
  const t = convexTest(schema, modules);
  registerCore(t);
  registerPassword(t);
  registerUsername(t);
  return t;
}
async function signUp(t: ReturnType<typeof setup>, username: string) {
  const result = await t.mutation(api.auth.signUpWithUsernamePassword, {
    username,
    password: "Dare-correct-horse-47!",
  });
  if (result.status !== "complete") throw new Error(JSON.stringify(result));
  return {
    client: t.withIdentity(sessionIdentity(result.tokens)),
    tokens: result.tokens,
  };
}
async function fixture() {
  const t = setup();
  const sponsor = await signUp(t, "dare-demo-sponsor");
  const profile = await sponsor.client.query(api.profiles.me, {});
  await t.mutation(internal.demo.provisionSponsor, {
    userId: profile!.id,
    expectedUsername: "dare-demo-sponsor",
  });
  const now = Date.now() + 1000;
  const campaignId = await sponsor.client.mutation(api.campaigns.createDraft, {
    templateId: "balance-object",
    winnerCount: 2,
    rewardUsdCents: 1000,
    predictionClosesAt: now + 180_000,
    attemptStartsAt: now + 240_000,
    deadlineAt: now + 360_000,
  });
  await sponsor.client.mutation(internal.payments.recordCheckout, {
    campaignId,
    providerCheckoutId: "ch_test",
    providerVariantId: "plan_test",
    checkoutUrl: "https://sandbox.whop.com/checkout/test",
  });
  const payment = {
    campaignId,
    providerCheckoutId: "ch_test",
    providerPaymentId: "pay_test",
    providerEventId: "evt_test",
    amountUsdCents: 2000,
    currency: "USD" as const,
    sandbox: true as const,
  };
  await t.mutation(internal.payments.activateCampaign, payment);
  return { t, sponsor: sponsor.client, campaignId, now, payment };
}
async function evidence(
  t: ReturnType<typeof setup>,
  client: ReturnType<ReturnType<typeof setup>["withIdentity"]>,
  campaignId: Id<"campaigns">,
  requestId: string,
) {
  const ticket = await client.mutation(api.submissions.generateUploadUrl, {
    campaignId,
  });
  const ticketId = await client.mutation(internal.submissions.claimUpload, {
    uploadToken: ticket.uploadToken,
  });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["test video fixture"], { type: "video/mp4" })),
  );
  expect(
    await client.mutation(internal.submissions.finishUpload, {
      ticketId,
      storageId,
    }),
  ).toBe(true);
  return await client.mutation(api.submissions.submit, {
    campaignId,
    uploadToken: ticket.uploadToken,
    requestId,
  });
}
describe("DARE secured backend", () => {
  beforeEach(() => {
    vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T20:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("adds sandboxUSD metadata without renaming or rescaling stored units", async () => {
    const { t, campaignId, now } = await fixture();
    const alice = (await signUp(t, "alice")).client;
    const metadata = { currency: "USD", moneyMode: "sandbox" };
    const profile = await alice.query(api.profiles.me, {});
    expect(profile).toMatchObject({ ...metadata, balanceUnits: 100000 });
    const before = await t.run((ctx) => ctx.db.get("users", profile!.id));
    const quote = await alice.query(api.predictions.quote, {
      campaignId,
      side: "YES",
      stakeUnits: 2500,
    });
    expect(quote).toMatchObject({
      ...metadata,
      stakeUnits: 2500,
      estimatedGrossPayoutUnits: 2500,
      estimatedNetProfitUnits: 0,
      maximumLossUnits: 2500,
    });
    expect(quote.label).toContain("Sandbox USD (demo dollars), not real money");
    expect(quote.label).toContain("100 units = $1 demo");
    expect(await t.run((ctx) => ctx.db.get("users", profile!.id))).toEqual(
      before,
    );
    const args = {
      campaignId,
      side: "YES" as const,
      stakeUnits: 2500,
      requestId: "sandbox_usd1",
    };
    const placed = await alice.mutation(api.predictions.place, args);
    expect(placed).toMatchObject({ ...metadata, balanceUnits: 97500 });
    expect(await alice.mutation(api.predictions.place, args)).toEqual(placed);
    expect(
      await alice.query(api.predictions.getMarket, { campaignId }),
    ).toMatchObject({
      ...metadata,
      yesStakeUnits: 2500,
      noStakeUnits: 0,
      position: { stakeUnits: 2500 },
    });
    await expect(
      alice.mutation(api.predictions.place, {
        ...args,
        stakeUnits: 100000,
        requestId: "sandbox_usd2",
      }),
    ).rejects.toThrow("Insufficient sandbox USD (demo dollars)");
    vi.setSystemTime(now + 360_000);
    await t.mutation(internal.settlement.resolve, { campaignId });
    expect(await alice.query(api.profiles.me, {})).toMatchObject({
      ...metadata,
      balanceUnits: 100000,
    });
    const ledger = await t.run((ctx) =>
      ctx.db
        .query("ledger")
        .withIndex("by_userId", (q) => q.eq("userId", profile!.id))
        .take(10),
    );
    expect(ledger.map((row) => row.deltaUnits)).toEqual([100000, -2500, 2500]);
  });
  it("uses real Auth v2 sessions and grants once without signup elevation", async () => {
    const t = setup(),
      alice = await signUp(t, "alice");
    expect(await t.query(api.profiles.me, {})).toBeNull();
    expect(await alice.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 100000,
      isSponsor: false,
    });
    const again = await t.mutation(api.auth.signInWithUsernamePassword, {
      username: "alice",
      password: "Dare-correct-horse-47!",
    });
    expect(again.status).toBe("complete");
    expect(await alice.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 100000,
    });
    expect(await t.run((ctx) => ctx.db.query("ledger").take(5))).toHaveLength(
      1,
    );
    await alice.client.mutation(api.auth.signOut, {
      refreshToken: alice.tokens.refreshToken,
    });
    expect(await alice.client.query(api.profiles.me, {})).toBeNull();
  });
  it("binds payment identities and immutable checkout terms", async () => {
    const { t, sponsor, campaignId, payment } = await fixture();
    const result = await t.mutation(
      internal.payments.activateCampaign,
      payment,
    );
    expect(
      await t.mutation(internal.payments.activateCampaign, payment),
    ).toEqual(result);
    await expect(
      t.mutation(internal.payments.activateCampaign, {
        ...payment,
        amountUsdCents: 2001,
      }),
    ).rejects.toThrow("terms mismatch");
    await expect(
      t.mutation(internal.payments.activateCampaign, {
        ...payment,
        providerCheckoutId: "ch_wrong",
      }),
    ).rejects.toThrow("terms mismatch");
    await expect(
      sponsor.mutation(internal.payments.recordCheckout, {
        campaignId,
        providerCheckoutId: "ch_other",
        providerVariantId: "plan_test",
        checkoutUrl: "https://sandbox.whop.com/checkout/test",
      }),
    ).rejects.toThrow("immutable");
    const stranger = await signUp(t, "stranger");
    await expect(
      stranger.client.query(internal.payments.getCheckoutTerms, { campaignId }),
    ).rejects.toThrow("permission");
    expect(
      await t.run((ctx) => ctx.db.query("payments").take(10)),
    ).toHaveLength(1);
  });
  it("prevents overdrafts, payload conflicts, role changes, side switches and late stakes", async () => {
    const { t, sponsor, campaignId, now } = await fixture();
    const alice = (await signUp(t, "alice")).client;
    const args = {
      campaignId,
      side: "YES" as const,
      stakeUnits: 60000,
      requestId: "request_0001",
    };
    const results = await Promise.allSettled([
      alice.mutation(api.predictions.place, args),
      alice.mutation(api.predictions.place, {
        ...args,
        requestId: "request_0002",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const successfulId =
      results[0].status === "fulfilled" ? "request_0001" : "request_0002";
    expect(
      await alice.mutation(api.predictions.place, {
        ...args,
        requestId: successfulId,
      }),
    ).toMatchObject({ balanceUnits: 40000 });
    await expect(
      alice.mutation(api.predictions.place, {
        ...args,
        stakeUnits: 1,
        requestId: successfulId,
      }),
    ).rejects.toThrow("payload conflict");
    await expect(
      alice.mutation(api.predictions.place, {
        ...args,
        side: "NO",
        stakeUnits: 1,
        requestId: "request_0003",
      }),
    ).rejects.toThrow("locked");
    await expect(
      alice.mutation(api.campaigns.join, { campaignId }),
    ).rejects.toThrow("Predictors");
    await expect(sponsor.mutation(api.predictions.place, args)).rejects.toThrow(
      "reviewers",
    );
    await expect(
      sponsor.mutation(api.campaigns.join, { campaignId }),
    ).rejects.toThrow("reviewers");
    const participant = (await signUp(t, "participant")).client;
    const joined = await participant.mutation(api.campaigns.join, {
      campaignId,
    });
    expect(await participant.mutation(api.campaigns.join, { campaignId })).toBe(
      joined,
    );
    await expect(
      participant.mutation(api.predictions.place, args),
    ).rejects.toThrow("Participants");
    vi.setSystemTime(now + 180_000);
    await expect(
      alice.mutation(api.predictions.place, {
        ...args,
        stakeUnits: 1,
        requestId: "request_0004",
      }),
    ).rejects.toThrow("closed");
    expect(await alice.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 40000,
    });
  });
  it("settles NO once, conserves the entire pool and refunds an unstaked winning side", async () => {
    const { t, campaignId, now } = await fixture();
    const alice = (await signUp(t, "alice")).client;
    await alice.mutation(api.predictions.place, {
      campaignId,
      side: "YES",
      stakeUnits: 123,
      requestId: "request_0001",
    });
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toBeNull();
    vi.setSystemTime(now + 360_000);
    const resolved = await t.mutation(internal.settlement.resolve, {
      campaignId,
    });
    expect(resolved?.outcome).toBe("NO");
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toEqual(resolved);
    expect(await alice.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 100000,
    });
    expect(
      await t.run((ctx) => ctx.db.query("settlements").take(5)),
    ).toMatchObject([
      { poolUnits: 123, distributedUnits: 123, refunded: true },
    ]);
  });
  it("allocates deterministic largest remainders using stable IDs", () => {
    expect(
      allocatePool(
        [
          { id: "b", stakeUnits: 1 },
          { id: "a", stakeUnits: 1 },
        ],
        3,
      ),
    ).toEqual([
      { id: "a", units: 2 },
      { id: "b", units: 1 },
    ]);
    expect(
      allocatePool(
        [
          { id: "a", stakeUnits: 10 },
          { id: "b", stakeUnits: 30 },
        ],
        101,
      ).reduce((s, p) => s + p.units, 0),
    ).toBe(101);
  });

  it("keeps drafts private and refuses sponsor membership escalation and cross-sponsor joining", async () => {
    const { t, campaignId } = await fixture();
    const other = (await signUp(t, "dare-demo-other")).client;
    const profile = await other.query(api.profiles.me, {});
    await expect(
      t.mutation(internal.demo.provisionSponsor, {
        userId: profile!.id,
        expectedUsername: "dare-demo-sponsor",
      }),
    ).rejects.toThrow("must match");
    await t.mutation(internal.demo.provisionSponsor, {
      userId: profile!.id,
      expectedUsername: "dare-demo-other",
    });
    expect(
      (await other.query(api.campaigns.get, { campaignId }))?.viewer,
    ).toMatchObject({
      role: null,
      canJoin: false,
      canPredict: false,
      canReview: false,
    });
    await expect(
      other.mutation(api.campaigns.join, { campaignId }),
    ).rejects.toThrow("reviewers");
    const drafts = await other.mutation(internal.demo.seedDrafts, {});
    expect(await other.mutation(internal.demo.seedDrafts, {})).toEqual(drafts);
    expect(drafts).toHaveLength(2);
    expect(
      await t.query(api.campaigns.get, { campaignId: drafts[0] }),
    ).toBeNull();
    expect(
      await other.query(api.campaigns.get, { campaignId: drafts[0] }),
    ).toMatchObject({ state: "draft", isDemo: true });
    expect(
      (
        await t.query(api.campaigns.list, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(1);
  });

  it("binds uploads to authenticated owners, rejects replay, and deletes a losing orphan", async () => {
    const { t, campaignId, now } = await fixture();
    const alice = (await signUp(t, "alice")).client,
      bob = (await signUp(t, "bob")).client;
    await alice.mutation(api.campaigns.join, { campaignId });
    await bob.mutation(api.campaigns.join, { campaignId });
    await expect(
      alice.mutation(api.submissions.generateUploadUrl, { campaignId }),
    ).rejects.toThrow("closed");
    vi.setSystemTime(now + 240_000);
    const ticket = await alice.mutation(api.submissions.generateUploadUrl, {
      campaignId,
    });
    await expect(
      bob.mutation(internal.submissions.claimUpload, {
        uploadToken: ticket.uploadToken,
      }),
    ).rejects.toThrow("unavailable");
    const claims = await Promise.allSettled([
      alice.mutation(internal.submissions.claimUpload, {
        uploadToken: ticket.uploadToken,
      }),
      alice.mutation(internal.submissions.claimUpload, {
        uploadToken: ticket.uploadToken,
      }),
    ]);
    expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const ticketId = ticket.uploadToken as Id<"uploadTickets">;
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["test"], { type: "video/mp4" })),
    );
    await alice.mutation(internal.submissions.finishUpload, {
      ticketId,
      storageId,
    });
    const loser = await t.run((ctx) =>
      ctx.storage.store(new Blob(["test"], { type: "video/mp4" })),
    );
    expect(
      await alice.mutation(internal.submissions.finishUpload, {
        ticketId,
        storageId: loser,
      }),
    ).toBe(false);
    expect(await t.run((ctx) => ctx.storage.get(loser))).toBeNull();
    await expect(
      bob.mutation(api.submissions.submit, {
        campaignId,
        uploadToken: ticket.uploadToken,
        requestId: "submit_bob1",
      }),
    ).rejects.toThrow("unavailable");
    const args = {
      campaignId,
      uploadToken: ticket.uploadToken,
      requestId: "submit_alice1",
    };
    const recorded = await alice.mutation(api.submissions.submit, args);
    expect(await alice.mutation(api.submissions.submit, args)).toEqual(
      recorded,
    );
    await expect(
      alice.mutation(api.submissions.submit, {
        ...args,
        uploadToken: "different",
      }),
    ).rejects.toThrow("payload conflict");
    await expect(
      alice.mutation(api.submissions.submit, {
        ...args,
        requestId: "submit_alice2",
      }),
    ).rejects.toThrow("unavailable");
    expect(await bob.query(api.submissions.mine, { campaignId })).toEqual([]);
    await expect(
      alice.query(api.submissions.listForReview, { campaignId }),
    ).rejects.toThrow("permission");
  });

  it("enforces both upload and submission deadlines and expires abandoned storage", async () => {
    const { t, campaignId, now } = await fixture();
    const alice = (await signUp(t, "alice")).client;
    await alice.mutation(api.campaigns.join, { campaignId });
    vi.setSystemTime(now + 240_000);
    const a = await alice.mutation(api.submissions.generateUploadUrl, {
      campaignId,
    });
    const aId = await alice.mutation(internal.submissions.claimUpload, {
      uploadToken: a.uploadToken,
    });
    const b = await alice.mutation(api.submissions.generateUploadUrl, {
      campaignId,
    });
    const bId = await alice.mutation(internal.submissions.claimUpload, {
      uploadToken: b.uploadToken,
    });
    const stored = await t.run((ctx) =>
      ctx.storage.store(new Blob(["test"], { type: "video/mp4" })),
    );
    await alice.mutation(internal.submissions.finishUpload, {
      ticketId: aId,
      storageId: stored,
    });
    vi.setSystemTime(now + 360_000);
    await expect(
      alice.mutation(api.submissions.submit, {
        campaignId,
        uploadToken: a.uploadToken,
        requestId: "submit_late1",
      }),
    ).rejects.toThrow("closed");
    const late = await t.run((ctx) =>
      ctx.storage.store(new Blob(["test"], { type: "video/mp4" })),
    );
    expect(
      await alice.mutation(internal.submissions.finishUpload, {
        ticketId: bId,
        storageId: late,
      }),
    ).toBe(false);
    expect(await t.run((ctx) => ctx.storage.get(late))).toBeNull();
    await t.mutation(internal.submissions.expireUpload, { ticketId: aId });
    expect(await t.run((ctx) => ctx.storage.get(stored))).toBeNull();
  });

  it("waits for every timely review, chooses earliest distinct winners, and settles the entire YES pool", async () => {
    const { t, sponsor, campaignId, now } = await fixture();
    const a = (await signUp(t, "alice")).client,
      b = (await signUp(t, "bob")).client,
      c = (await signUp(t, "carol")).client;
    const yes = (await signUp(t, "yesplayer")).client,
      no = (await signUp(t, "noplayer")).client;
    for (const client of [a, b, c])
      await client.mutation(api.campaigns.join, { campaignId });
    await yes.mutation(api.predictions.place, {
      campaignId,
      side: "YES",
      stakeUnits: 101,
      requestId: "yes_stake1",
    });
    await yes.mutation(api.predictions.place, {
      campaignId,
      side: "YES",
      stakeUnits: 99,
      requestId: "yes_topup1",
    });
    await no.mutation(api.predictions.place, {
      campaignId,
      side: "NO",
      stakeUnits: 103,
      requestId: "no_stake01",
    });
    vi.setSystemTime(now + 240_000);
    const submissions = [
      await evidence(t, a, campaignId, "alice_sub1"),
      await evidence(t, a, campaignId, "alice_sub2"),
      await evidence(t, b, campaignId, "bob_sub001"),
      await evidence(t, c, campaignId, "carol_sub1"),
    ];
    const tiedAt = now + 250_000;
    await t.run(async (ctx) => {
      for (const s of submissions)
        await ctx.db.patch("submissions", s.submissionId, {
          submittedAt: tiedAt,
        });
    });
    await expect(
      a.mutation(api.submissions.review, {
        submissionId: submissions[0].submissionId,
        decision: "approved",
        reason: "valid",
        requestId: "review_bad1",
      }),
    ).rejects.toThrow("permission");
    vi.setSystemTime(now + 360_000);
    for (let i = 0; i < submissions.length - 1; i++)
      await sponsor.mutation(api.submissions.review, {
        submissionId: submissions[i].submissionId,
        decision: "approved",
        reason: "Continuous valid evidence",
        requestId: `review_000${i}`,
      });
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toBeNull();
    const lastArgs = {
      submissionId: submissions[3].submissionId,
      decision: "approved" as const,
      reason: "Continuous valid evidence",
      requestId: "review_0003",
    };
    expect(
      await sponsor.mutation(api.submissions.review, lastArgs),
    ).toMatchObject({ status: "approved" });
    expect(
      await sponsor.mutation(api.submissions.review, lastArgs),
    ).toMatchObject({ status: "approved" });
    await expect(
      sponsor.mutation(api.submissions.review, {
        ...lastArgs,
        decision: "rejected",
      }),
    ).rejects.toThrow("payload conflict");
    expect(await yes.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 100103,
    });
    expect(await no.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 99897,
    });
    const rewards = await t.run((ctx) =>
      ctx.db
        .query("rewards")
        .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
        .take(20),
    );
    const docs = await t.run((ctx) =>
      ctx.db
        .query("submissions")
        .withIndex("by_campaignId_and_userId", (q) =>
          q.eq("campaignId", campaignId),
        )
        .take(10),
    );
    const seen = new Set<string>();
    const expected = docs
      .sort((x, y) => (x._id < y._id ? -1 : 1))
      .filter((s) => {
        if (seen.has(s.userId)) return false;
        seen.add(s.userId);
        return true;
      })
      .slice(0, 2);
    expect(rewards.map((r) => r.submissionId).sort()).toEqual(
      expected.map((s) => s._id).sort(),
    );
    expect(new Set(rewards.map((r) => r.userId)).size).toBe(2);
    expect(
      rewards.every(
        (r) => r.rewardUsdCents === 1000 && r.status === "represented_not_paid",
      ),
    ).toBe(true);
    const ledgerBefore = await t.run((ctx) => ctx.db.query("ledger").take(100));
    await Promise.all([
      t.mutation(internal.settlement.resolve, { campaignId }),
      t.mutation(internal.settlement.resolve, { campaignId }),
    ]);
    expect(await t.run((ctx) => ctx.db.query("ledger").take(100))).toEqual(
      ledgerBefore,
    );
  });

  it("voids unresolved evidence at review timeout instead of resolving NO and refunds every stake", async () => {
    const { t, sponsor, campaignId, now } = await fixture();
    const participant = (await signUp(t, "participant")).client,
      predictor = (await signUp(t, "predictor")).client;
    await participant.mutation(api.campaigns.join, { campaignId });
    await predictor.mutation(api.predictions.place, {
      campaignId,
      side: "NO",
      stakeUnits: 999,
      requestId: "prediction1",
    });
    vi.setSystemTime(now + 240_000);
    const submitted = await evidence(t, participant, campaignId, "submission1");
    vi.setSystemTime(now + 360_000);
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toBeNull();
    vi.setSystemTime(now + 360_000 + 86400_000);
    await expect(
      sponsor.mutation(api.submissions.review, {
        submissionId: submitted.submissionId,
        decision: "rejected",
        reason: "late review",
        requestId: "review_late",
      }),
    ).rejects.toThrow("closed");
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toMatchObject({ outcome: "VOID" });
    expect(await predictor.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 100000,
    });
    expect(await t.run((ctx) => ctx.db.query("rewards").take(10))).toEqual([]);
  });

  it("authenticates HTTP ingestion and range playback without revealing storage URLs", async () => {
    const { t, sponsor, campaignId, now } = await fixture();
    const alice = (await signUp(t, "alice")).client;
    await alice.mutation(api.campaigns.join, { campaignId });
    vi.setSystemTime(now + 240_000);
    const ticket = await alice.mutation(api.submissions.generateUploadUrl, {
      campaignId,
    });
    const path =
      new URL(ticket.uploadUrl).pathname + new URL(ticket.uploadUrl).search;
    const body = new Uint8Array([
      0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]);
    const init = {
      method: "POST",
      headers: {
        Authorization: "Bearer test-session",
        "Content-Type": "video/mp4",
      },
      body,
    };
    expect((await t.fetch(path, init)).status).toBe(400);
    expect(
      (
        await alice.fetch(path, {
          ...init,
          headers: { "Content-Type": "video/mp4" },
        })
      ).status,
    ).toBe(401);
    expect((await alice.fetch(path, init)).status).toBe(200);
    expect((await alice.fetch(path, init)).status).toBe(400);
    const submitted = await alice.mutation(api.submissions.submit, {
      campaignId,
      uploadToken: ticket.uploadToken,
      requestId: "http_submit1",
    });
    const review = await sponsor.query(api.submissions.listForReview, {
      campaignId,
    });
    expect(review[0].mediaUrl).toContain("/evidence/media?submissionId=");
    const mediaPath = `/evidence/media?submissionId=${submitted.submissionId}`;
    expect((await t.fetch(mediaPath)).status).toBe(401);
    expect(
      (
        await alice.fetch(mediaPath, {
          headers: { Authorization: "Bearer test-session" },
        })
      ).status,
    ).toBe(403);
    const upstream = vi.fn(
      async (_url: string, options: RequestInit) =>
        new Response(options.method === "HEAD" ? null : body.slice(4, 8), {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": "4",
            "Content-Range": "bytes 4-7/16",
            "Accept-Ranges": "bytes",
          },
        }),
    );
    vi.stubGlobal("fetch", upstream);
    const playback = await sponsor.fetch(mediaPath, {
      headers: { Authorization: "Bearer test-session", Range: "bytes=4-7" },
    });
    expect(playback.status).toBe(206);
    expect(playback.headers.get("Cache-Control")).toBe("private, no-store");
    expect(playback.headers.get("Content-Range")).toBe("bytes 4-7/16");
    expect(new Uint8Array(await playback.arrayBuffer())).toEqual(
      body.slice(4, 8),
    );
    expect(upstream.mock.calls[0][1]).toEqual({
      method: "GET",
      headers: { Range: "bytes=4-7" },
    });
    expect(
      (
        await sponsor.fetch(mediaPath, {
          headers: {
            Authorization: "Bearer test-session",
            Range: "bytes=0-1,3-4",
          },
        })
      ).status,
    ).toBe(416);
  });

  it("resolves reviewed rejection as NO without allocating performer prizes", async () => {
    const { t, sponsor, campaignId, now } = await fixture();
    const participant = (await signUp(t, "participant")).client,
      no = (await signUp(t, "noplayer")).client;
    await participant.mutation(api.campaigns.join, { campaignId });
    await no.mutation(api.predictions.place, {
      campaignId,
      side: "NO",
      stakeUnits: 50,
      requestId: "prediction1",
    });
    vi.setSystemTime(now + 240_000);
    const submitted = await evidence(t, participant, campaignId, "submission1");
    await sponsor.mutation(api.submissions.review, {
      submissionId: submitted.submissionId,
      decision: "rejected",
      reason: "Does not satisfy the exact criteria",
      requestId: "review_0001",
    });
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toBeNull();
    vi.setSystemTime(now + 360_000);
    expect(
      await t.mutation(internal.settlement.resolve, { campaignId }),
    ).toMatchObject({ outcome: "NO" });
    expect(await no.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 100000,
    });
    expect(await t.run((ctx) => ctx.db.query("rewards").take(10))).toEqual([]);
  });

  it("materializes scheduled cutoffs and leaves unused YES prizes unallocated", async () => {
    const { t, sponsor, campaignId, now } = await fixture();
    const participant = (await signUp(t, "participant")).client;
    await participant.mutation(api.campaigns.join, { campaignId });
    await vi.advanceTimersByTimeAsync(now + 180_000 - Date.now());
    await t.finishInProgressScheduledFunctions();
    expect(
      await participant.query(api.campaigns.get, { campaignId }),
    ).toMatchObject({
      state: "prediction_open",
      viewer: { canPredict: false },
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await t.finishInProgressScheduledFunctions();
    expect(
      await participant.query(api.campaigns.get, { campaignId }),
    ).toMatchObject({
      state: "attempts_open",
      viewer: { canJoin: false, canSubmit: true },
    });
    const submitted = await evidence(t, participant, campaignId, "submission1");
    await sponsor.mutation(api.submissions.review, {
      submissionId: submitted.submissionId,
      decision: "approved",
      reason: "Exact criteria satisfied",
      requestId: "review_0001",
    });
    await vi.advanceTimersByTimeAsync(120_000);
    await t.finishInProgressScheduledFunctions();
    expect(
      await participant.query(api.campaigns.get, { campaignId }),
    ).toMatchObject({ state: "resolved", outcome: "YES" });
    const awards = await t.run((ctx) => ctx.db.query("rewards").take(10));
    expect(awards).toHaveLength(1);
    expect(awards[0].rewardUsdCents).toBe(1000);
  });
});
