/// <reference types="vite/client" />

import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "../_generated/api";
import schema from "../schema";
import { whopConfig } from "./client";

const modules = import.meta.glob("/convex/**/*.{ts,js}");
const testSecret = "ws_test_fixture_only_not_a_real_credential";
const checkoutUrl = "https://sandbox.whop.com/checkout/ch_test/";
const money = (amount: string) => ({
  amount,
  currency: "usd",
  decimals: 2,
  display_decimals: 2,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("CONVEX_CLOUD_URL", "https://dare-test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://dare-test.convex.site");
  vi.stubEnv("WHOP_API_KEY", "sandbox_unit_test_not_a_real_key");
  vi.stubEnv("WHOP_ACCOUNT_ID", "biz_test");
  vi.stubEnv("WHOP_WEBHOOK_SECRET", testSecret);
  vi.stubEnv("WHOP_CHECKOUT_RETURN_URL", "https://dare.example/sponsor");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function sponsorSession(t: TestConvex<typeof schema>) {
  const userId = await t.mutation(internal.users.createUser, {
    method: { name: "usernamePassword", profile: {} },
  });
  const tokens = await t.mutation(
    components.auth.public._internal_dangerous_signIn,
    {
      userId,
      claims: { method: "usernamePassword", profile: {} },
      componentPath: "authPassword",
      accessTokenTtlSeconds: 60,
      refreshInactivityTimeoutSeconds: 86400,
      sessionMaxLifetimeSeconds: 86400,
    },
  );
  const sponsorId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("sponsors", {
      name: "Payment test sponsor",
      isDemo: true,
      campaignCount: 0,
    });
    await ctx.db.insert("memberships", { userId, sponsorId: id });
    return id;
  });
  return { sponsor: t.withIdentity(sessionIdentity(tokens)), sponsorId };
}

async function fixture() {
  const t = convexTest(schema, modules);
  registerCore(t);
  const { sponsor, sponsorId } = await sponsorSession(t);
  const campaignId = await sponsor.mutation(api.campaigns.createDraft, {
    templateId: "balance-object",
    winnerCount: 2,
    rewardUsdCents: 1250,
    predictionClosesAt: Date.now() + 600_000,
    attemptStartsAt: Date.now() + 600_000,
    deadlineAt: Date.now() + 1_200_000,
  });
  return { t, sponsor, campaignId, sponsorId };
}

async function boundFixture() {
  const f = await fixture();
  await f.sponsor.mutation(internal.payments.recordCheckout, {
    campaignId: f.campaignId,
    providerCheckoutId: "ch_test",
    providerVariantId: "plan_test",
    checkoutUrl,
  });
  return f;
}

function providerPayment(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    id: "pay_test",
    account_id: "biz_test",
    checkout_configuration_id: "ch_test",
    variant_id: "plan_test",
    status: "paid",
    substatus: "succeeded",
    currency: "usd",
    paid_at: "2026-11-15T12:00:00Z",
    total: money("25.00"),
    refunded_amount: money("0.00"),
    refunded_at: null,
    auto_refunded: false,
    promo_code_id: null,
    metadata: {
      dare_campaign_id: f.campaignId,
      dare_sponsor_id: f.sponsorId,
      dare_environment: "sandbox",
    },
  };
}

async function signedRequest(type = "payment.succeeded", eventId = "msg_test") {
  const body = JSON.stringify({
    id: eventId,
    type,
    account_id: "biz_test",
    data: { id: "pay_test", checkout_configuration_id: "ch_test" },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(testSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${eventId}.${timestamp}.${body}`),
  );
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": eventId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`,
    },
    body,
  };
}

async function state(f: Awaited<ReturnType<typeof fixture>>) {
  return await f.t.run(async (ctx) => ({
    campaign: await ctx.db.get("campaigns", f.campaignId),
    payments: await ctx.db
      .query("payments")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", f.campaignId))
      .take(10),
    events: await ctx.db.query("paymentEvents").take(10),
  }));
}

describe("sandbox checkout through real Convex functions", () => {
  it("advertises and enforces the same three-minute minimum for new drafts", async () => {
    const f = await fixture();
    expect(
      (await f.t.query(api.campaigns.templates, {})).limits.minLeadMs,
    ).toBe(180_000);
    const base = {
      templateId: "paper-plane" as const,
      winnerCount: 1,
      rewardUsdCents: 1000,
      attemptStartsAt: Date.now() + 600_000,
      deadlineAt: Date.now() + 1_200_000,
    };
    await expect(
      f.sponsor.mutation(api.campaigns.createDraft, {
        ...base,
        predictionClosesAt: Date.now() + 60_000,
      }),
    ).rejects.toThrow("Invalid predictionClosesAt");
    await expect(
      f.sponsor.mutation(api.campaigns.createDraft, {
        ...base,
        predictionClosesAt: Date.now() + 179_999,
      }),
    ).rejects.toThrow("Invalid predictionClosesAt");
    expect(
      await f.sponsor.mutation(api.campaigns.createDraft, {
        ...base,
        predictionClosesAt: Date.now() + 181_000,
      }),
    ).toBeTruthy();
  });
  it.each([120_000, 119_999, 0])(
    "refuses checkout with %i milliseconds before cutoff without contacting Whop",
    async (remaining) => {
      const f = await boundFixture();
      const cutoff = (await state(f)).campaign!.predictionClosesAt;
      vi.setSystemTime(cutoff - remaining);
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(
        f.sponsor.action(api.whop.checkout.create, {
          campaignId: f.campaignId,
        }),
      ).rejects.toThrow(
        "Not enough time to complete payment. Create a campaign with a later prediction cutoff.",
      );
      expect(fetcher).not.toHaveBeenCalled();
      expect((await state(f)).payments).toHaveLength(0);
    },
  );

  it("refuses a new checkout inside the safety margin but preserves a cached URL outside it", async () => {
    const fresh = await fixture();
    const cutoff = (await state(fresh)).campaign!.predictionClosesAt;
    vi.setSystemTime(cutoff - 119_000);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      fresh.sponsor.action(api.whop.checkout.create, {
        campaignId: fresh.campaignId,
      }),
    ).rejects.toThrow("Not enough time to complete payment");
    expect(fetcher).not.toHaveBeenCalled();
    const cached = await boundFixture();
    const cachedCutoff = (await state(cached)).campaign!.predictionClosesAt;
    vi.setSystemTime(cachedCutoff - 120_001);
    expect(
      await cached.sponsor.action(api.whop.checkout.create, {
        campaignId: cached.campaignId,
      }),
    ).toEqual({ checkoutUrl, sandbox: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("explains verified idempotency payload conflicts without changing the checkout key", async () => {
    const f = await fixture();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const keys: (string | null)[] = [];
    const fetcher = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key"));
        return Response.json(
          {
            error: {
              code: "idempotency_key_mismatch",
              type: "bad_request",
              message:
                "This Idempotency-Key was already used with a different request",
              private_body: "private-key-and-person@example.com",
            },
          },
          { status: 400 },
        );
      },
    );
    vi.stubGlobal("fetch", fetcher);
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(
        f.sponsor.action(api.whop.checkout.create, {
          campaignId: f.campaignId,
        }),
      ).rejects.toThrow(
        "Checkout configuration changed since the first attempt. Create a new campaign.",
      );
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(keys).toEqual([
      `dare:checkout:${f.campaignId}:v1`,
      `dare:checkout:${f.campaignId}:v1`,
    ]);
    expect(log).toHaveBeenCalledWith("Whop sandbox checkout failed", {
      status: 400,
      category: "idempotency_conflict",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-key");
    const result = await state(f);
    expect(result.campaign?.state).toBe("draft");
    expect(result.campaign?.providerCheckoutId).toBeUndefined();
    expect(result.payments).toHaveLength(0);
  });
  it("keeps unrelated provider400 failures retryable with generic client errors", async () => {
    const f = await fixture();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "parameter_invalid",
              type: "invalid_request_error",
              message: "The redirect_url parameter is invalid: private-input",
            },
          },
          { status: 400 },
        ),
      ),
    );
    await expect(
      f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId }),
    ).rejects.toThrow(
      "Whop sandbox checkout is unavailable. Your campaign is not activated. Please try again.",
    );
    expect(log).toHaveBeenCalledWith("Whop sandbox checkout failed", {
      status: 400,
      category: "invalid_request",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-input");
    expect((await state(f)).campaign?.state).toBe("draft");
  });
  it("requires an HTTPS return URL instead of a native deep link", () => {
    vi.stubEnv("WHOP_CHECKOUT_RETURN_URL", "dare://sponsor");
    expect(() => whopConfig()).toThrow(
      "return URL is not configured correctly",
    );
    vi.stubEnv(
      "WHOP_CHECKOUT_RETURN_URL",
      "https://fastidious-gnat-814.convex.site/whop/return",
    );
    expect(whopConfig().returnUrl).toBe(
      "https://fastidious-gnat-814.convex.site/whop/return",
    );
    vi.stubEnv(
      "WHOP_CHECKOUT_RETURN_URL",
      "https://user:password@example.com/return",
    );
    expect(() => whopConfig()).toThrow(
      "return URL is not configured correctly",
    );
  });

  it("serves a static app return link without reading or changing payment state", async () => {
    const f = await boundFixture();
    const before = await state(f);
    const response = await f.t.fetch(
      "/whop/return?status=paid&campaignId=untrusted",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'none'",
    );
    const html = await response.text();
    expect(html).toContain('href="dare://sponsor"');
    expect(html).toContain("Checkout finished.");
    expect(html).not.toContain("untrusted");
    expect(html).not.toContain("<script");
    expect(await state(f)).toEqual(before);
  });

  it("logs only a numeric provider status and an allowlisted failure category", async () => {
    const f = await fixture();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              message: "fake-key-and-private-person@example.com",
              request_body: "private-body",
              sponsor_id: f.sponsorId,
              url: "https://secret.example",
            },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(
      f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId }),
    ).rejects.toThrow("Whop sandbox checkout is unavailable");
    expect(log).toHaveBeenCalledWith("Whop sandbox checkout failed", {
      status: 422,
      category: "invalid_request",
    });
    const captured = JSON.stringify(log.mock.calls);
    for (const privateValue of [
      "fake-key",
      "private-person",
      "private-body",
      f.sponsorId,
      "https://secret.example",
      "sandbox_unit_test_not_a_real_key",
    ])
      expect(captured).not.toContain(privateValue);
    expect((await state(f)).campaign?.state).toBe("draft");
  });
  it("uses frozen sponsor terms and reuses the durable checkout without activating", async () => {
    const f = await fixture();
    const calls: {
      url: string;
      method: string;
      body: Record<string, unknown>;
      headers: Headers;
    }[] = [];
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method ?? "GET",
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
        });
        if (url.endsWith("/checkout_configurations"))
          return Response.json({
            id: "ch_test",
            account_id: "biz_test",
            mode: "payment",
            purchase_url: checkoutUrl,
            variant: { id: "plan_test" },
          });
        if (url.endsWith("/variants/plan_test"))
          return Response.json({
            id: "plan_test",
            currency: "usd",
            billing_type: "one_time",
            initial_price: 25,
            adaptive_pricing_enabled: false,
            allow_multiple_quantity: false,
          });
        throw new Error("Unexpected provider request");
      },
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await f.sponsor.action(api.whop.checkout.create, {
        campaignId: f.campaignId,
      }),
    ).toEqual({ checkoutUrl, sandbox: true });
    expect(
      await f.sponsor.action(api.whop.checkout.create, {
        campaignId: f.campaignId,
      }),
    ).toEqual({ checkoutUrl, sandbox: true });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(
      "https://sandbox-api.whop.com/api/v1/checkout_configurations",
    );
    expect(calls[0].headers.get("Idempotency-Key")).toBe(
      `dare:checkout:${f.campaignId}:v1`,
    );
    expect(calls[0].headers.get("Api-Version-Date")).toBe("2026-11-14-1");
    expect(calls[0].body.variant).toMatchObject({
      initial_price: 25,
      currency: "usd",
      billing_type: "one_time",
      stock: 1,
    });
    expect(calls[0].body.metadata).toMatchObject({
      dare_campaign_id: f.campaignId,
      dare_sponsor_id: f.sponsorId,
    });
    const result = await state(f);
    expect(result.campaign?.state).toBe("awaiting_payment");
    expect(result.payments).toHaveLength(0);
  });

  it("fails closed when sandbox credentials are missing", async () => {
    const f = await fixture();
    vi.stubEnv("WHOP_API_KEY", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId }),
    ).rejects.toThrow("Sandbox checkout is not configured");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).campaign?.state).toBe("draft");
  });

  it("does not reopen a cached checkout after the campaign payment cutoff", async () => {
    const f = await boundFixture();
    vi.setSystemTime(Date.now() + 1_200_001);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId }),
    ).rejects.toThrow("Not enough time to complete payment");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).payments).toHaveLength(0);
  });

  it("refuses unauthenticated and other sponsor checkout before contacting Whop", async () => {
    const f = await fixture();
    const { sponsor: other } = await sponsorSession(f.t);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      f.t.action(api.whop.checkout.create, { campaignId: f.campaignId }),
    ).rejects.toThrow("Sign in required");
    await expect(
      other.action(api.whop.checkout.create, { campaignId: f.campaignId }),
    ).rejects.toThrow("Sponsor review permission required");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).campaign?.state).toBe("draft");
  });
});

describe("signed webhook to atomic activation", () => {
  it("records a verified late payment once, marks refund required, and acknowledges later events", async () => {
    const f = await boundFixture();
    const beforeLedger = await f.t.run((ctx) =>
      ctx.db.query("ledger").take(10),
    );
    vi.setSystemTime((await state(f)).campaign!.predictionClosesAt);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(providerPayment(f))),
    );
    const request = await signedRequest();
    const responses = await Promise.all([
      f.t.fetch("/whop/webhook", request),
      f.t.fetch("/whop/webhook", request),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (
        await f.t.fetch(
          "/whop/webhook",
          await signedRequest("payment.succeeded", "msg_late_second"),
        )
      ).status,
    ).toBe(200);
    const result = await state(f);
    expect(result.campaign).toMatchObject({
      state: "void",
      outcome: "VOID",
      published: false,
      participantCount: 0,
      positionCount: 0,
      yesStakeUnits: 0,
      noStakeUnits: 0,
      paymentIssue: "late_payment_refund_required",
    });
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({
      disposition: "refund_required",
      amountUsdCents: 2500,
      currency: "USD",
      sandbox: true,
    });
    expect(result.events).toHaveLength(2);
    expect(await f.t.run((ctx) => ctx.db.query("ledger").take(10))).toEqual(
      beforeLedger,
    );
    expect(
      await f.sponsor.query(api.campaigns.get, { campaignId: f.campaignId }),
    ).toMatchObject({
      paymentIssue: "late_payment_refund_required",
      viewer: { canJoin: false, canPredict: false },
    });
    expect(
      await f.t.query(api.campaigns.get, { campaignId: f.campaignId }),
    ).toBeNull();
    await expect(
      f.sponsor.mutation(api.campaigns.join, { campaignId: f.campaignId }),
    ).rejects.toThrow("closed");
    await expect(
      f.sponsor.mutation(api.predictions.place, {
        campaignId: f.campaignId,
        side: "YES",
        stakeUnits: 1,
        requestId: "late_stake1",
      }),
    ).rejects.toThrow("closed");
  });

  it("preserves activated receipts after the deadline including legacy rows without disposition", async () => {
    const f = await boundFixture();
    const args = {
      campaignId: f.campaignId,
      providerCheckoutId: "ch_test",
      providerPaymentId: "pay_test",
      providerEventId: "msg_first",
      amountUsdCents: 2500,
      currency: "USD" as const,
      sandbox: true as const,
    };
    const activated = await f.t.mutation(
      internal.payments.activateCampaign,
      args,
    );
    await f.t.run((ctx) =>
      ctx.db.patch("payments", activated.paymentId, { disposition: undefined }),
    );
    vi.setSystemTime((await state(f)).campaign!.deadlineAt + 1);
    expect(
      await f.t.mutation(internal.payments.activateCampaign, {
        ...args,
        providerEventId: "msg_later",
      }),
    ).toEqual(activated);
    expect((await state(f)).campaign?.paymentIssue).toBeUndefined();
    expect((await state(f)).payments).toHaveLength(1);
  });

  it("enforces payment and event uniqueness across late and activated receipts", async () => {
    const f = await boundFixture();
    vi.setSystemTime((await state(f)).campaign!.predictionClosesAt);
    const lateArgs = {
      campaignId: f.campaignId,
      providerCheckoutId: "ch_test",
      providerPaymentId: "pay_late",
      providerEventId: "msg_late",
      amountUsdCents: 2500,
      currency: "USD" as const,
      sandbox: true as const,
    };
    const late = await f.t.mutation(
      internal.payments.activateCampaign,
      lateArgs,
    );
    expect(late).toMatchObject({
      state: "void",
      disposition: "refund_required",
    });
    expect(
      await f.t.mutation(internal.payments.activateCampaign, lateArgs),
    ).toEqual(late);
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...lateArgs,
        amountUsdCents: 2501,
      }),
    ).rejects.toThrow("terms mismatch");
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...lateArgs,
        providerCheckoutId: "ch_wrong",
      }),
    ).rejects.toThrow("terms mismatch");
    const secondId = await f.sponsor.mutation(api.campaigns.createDraft, {
      templateId: "paper-plane",
      winnerCount: 2,
      rewardUsdCents: 1250,
      predictionClosesAt: Date.now() + 600_000,
      attemptStartsAt: Date.now() + 600_000,
      deadlineAt: Date.now() + 1_200_000,
    });
    await f.sponsor.mutation(internal.payments.recordCheckout, {
      campaignId: secondId,
      providerCheckoutId: "ch_second",
      providerVariantId: "plan_second",
      checkoutUrl: "https://sandbox.whop.com/checkout/ch_second/",
    });
    const secondArgs = {
      ...lateArgs,
      campaignId: secondId,
      providerCheckoutId: "ch_second",
      providerPaymentId: "pay_second",
      providerEventId: "msg_second",
    };
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...secondArgs,
        providerPaymentId: "pay_late",
      }),
    ).rejects.toThrow("identity conflict");
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...secondArgs,
        providerEventId: "msg_late",
      }),
    ).rejects.toThrow("cannot activate");
    expect(
      await f.t.mutation(internal.payments.activateCampaign, secondArgs),
    ).toMatchObject({ state: "prediction_open" });
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...lateArgs,
        providerPaymentId: "pay_second",
        providerEventId: "msg_new",
      }),
    ).rejects.toThrow("identity conflict");
    expect(
      await f.t.run((ctx) => ctx.db.query("payments").take(10)),
    ).toHaveLength(2);
  });

  it("refuses a late payment if an unpublished campaign has unaccounted participant activity", async () => {
    const f = await boundFixture();
    const profile = await f.sponsor.query(api.profiles.me, {});
    await f.t.run((ctx) =>
      ctx.db.insert("participations", {
        campaignId: f.campaignId,
        userId: profile!.id,
        joinedAt: Date.now(),
        submissionCount: 0,
        ticketCount: 0,
      }),
    );
    vi.setSystemTime((await state(f)).campaign!.predictionClosesAt);
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        campaignId: f.campaignId,
        providerCheckoutId: "ch_test",
        providerPaymentId: "pay_late",
        providerEventId: "msg_late",
        amountUsdCents: 2500,
        currency: "USD",
        sandbox: true,
      }),
    ).rejects.toThrow("activity invariant");
    expect((await state(f)).payments).toHaveLength(0);
    expect((await state(f)).campaign?.state).toBe("awaiting_payment");
  });
  it("activates once across concurrent delivery and later duplicate events", async () => {
    const f = await boundFixture();
    const fetcher = vi.fn(async () => Response.json(providerPayment(f)));
    vi.stubGlobal("fetch", fetcher);
    const request = await signedRequest();
    const responses = await Promise.all([
      f.t.fetch("/whop/webhook", request),
      f.t.fetch("/whop/webhook", request),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      (
        await f.t.fetch(
          "/whop/webhook",
          await signedRequest("payment.succeeded", "msg_second"),
        )
      ).status,
    ).toBe(200);
    const result = await state(f);
    expect(result.campaign?.state).toBe("prediction_open");
    expect(result.payments).toHaveLength(1);
    expect(result.events).toHaveLength(2);
    expect(result.payments[0]).toMatchObject({
      amountUsdCents: 2500,
      currency: "USD",
      sandbox: true,
      providerPaymentId: "pay_test",
    });
  });

  it.each(["payment.canceled", "payment.failed", "payment.pending"])(
    "does not activate a signed %s event",
    async (type) => {
      const f = await boundFixture();
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect(
        (await f.t.fetch("/whop/webhook", await signedRequest(type))).status,
      ).toBe(200);
      expect(fetcher).not.toHaveBeenCalled();
      expect((await state(f)).payments).toHaveLength(0);
      expect((await state(f)).campaign?.state).toBe("awaiting_payment");
    },
  );

  it("rejects an invalid signature without retrieving or recording a payment", async () => {
    const f = await boundFixture();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const request = await signedRequest();
    request.body += " ";
    expect((await f.t.fetch("/whop/webhook", request)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).payments).toHaveLength(0);
  });

  it.each([
    { total: money("24.99") },
    { currency: "eur" },
    { checkout_configuration_id: "ch_other" },
    { status: "void" },
  ])("does not activate a mismatched provider payment %#", async (change) => {
    const f = await boundFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...providerPayment(f), ...change })),
    );
    expect(
      (await f.t.fetch("/whop/webhook", await signedRequest())).status,
    ).toBe(400);
    const result = await state(f);
    expect(result.payments).toHaveLength(0);
    expect(result.campaign?.state).toBe("awaiting_payment");
  });

  it("asks the provider to retry an unavailable payment without activating", async () => {
    const f = await boundFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: "Unavailable" } }, { status: 503 }),
      ),
    );
    expect(
      (await f.t.fetch("/whop/webhook", await signedRequest())).status,
    ).toBe(503);
    expect((await state(f)).payments).toHaveLength(0);
  });
});
