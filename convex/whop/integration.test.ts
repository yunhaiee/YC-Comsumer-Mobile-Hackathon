/// <reference types="vite/client" />

import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.{ts,js}");
const testSecret = "ws_test_fixture_only_not_a_real_credential";
const checkoutUrl = "https://sandbox.whop.com/checkout/ch_test/";
const money = (amount: string) => ({ amount, currency: "usd", decimals: 2, display_decimals: 2 });

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
});

async function sponsorSession(t: TestConvex<typeof schema>) {
  const userId = await t.mutation(internal.users.createUser, { method: { name: "usernamePassword", profile: {} } });
  const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    userId,
    claims: { method: "usernamePassword", profile: {} },
    componentPath: "authPassword",
    accessTokenTtlSeconds: 60,
    refreshInactivityTimeoutSeconds: 86400,
    sessionMaxLifetimeSeconds: 86400,
  });
  const sponsorId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("sponsors", { name: "Payment test sponsor", isDemo: true, campaignCount: 0 });
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
    metadata: { dare_campaign_id: f.campaignId, dare_sponsor_id: f.sponsorId, dare_environment: "sandbox" },
  };
}

async function signedRequest(type = "payment.succeeded", eventId = "msg_test") {
  const body = JSON.stringify({ id: eventId, type, account_id: "biz_test", data: { id: "pay_test", checkout_configuration_id: "ch_test" } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(testSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${eventId}.${timestamp}.${body}`));
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
    payments: await ctx.db.query("payments").withIndex("by_campaignId", (q) => q.eq("campaignId", f.campaignId)).take(10),
    events: await ctx.db.query("paymentEvents").take(10),
  }));
}

describe("sandbox checkout through real Convex functions", () => {
  it("uses frozen sponsor terms and reuses the durable checkout without activating", async () => {
    const f = await fixture();
    const calls: { url: string; method: string; body: Record<string, unknown>; headers: Headers }[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
      if (url.endsWith("/checkout_configurations")) return Response.json({ id: "ch_test", account_id: "biz_test", mode: "payment", purchase_url: checkoutUrl, variant: { id: "plan_test" } });
      if (url.endsWith("/variants/plan_test")) return Response.json({ id: "plan_test", currency: "usd", billing_type: "one_time", initial_price: 25, adaptive_pricing_enabled: false, allow_multiple_quantity: false });
      throw new Error("Unexpected provider request");
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId })).toEqual({ checkoutUrl, sandbox: true });
    expect(await f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId })).toEqual({ checkoutUrl, sandbox: true });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://sandbox-api.whop.com/api/v1/checkout_configurations");
    expect(calls[0].headers.get("Idempotency-Key")).toBe(`dare:checkout:${f.campaignId}:v1`);
    expect(calls[0].headers.get("Api-Version-Date")).toBe("2026-11-14-1");
    expect(calls[0].body.variant).toMatchObject({ initial_price: 25, currency: "usd", billing_type: "one_time", stock: 1 });
    expect(calls[0].body.metadata).toMatchObject({ dare_campaign_id: f.campaignId, dare_sponsor_id: f.sponsorId });
    const result = await state(f);
    expect(result.campaign?.state).toBe("awaiting_payment");
    expect(result.payments).toHaveLength(0);
  });

  it("fails closed when sandbox credentials are missing", async () => {
    const f = await fixture();
    vi.stubEnv("WHOP_API_KEY", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId })).rejects.toThrow("Sandbox checkout is not configured");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).campaign?.state).toBe("draft");
  });

  it("does not reopen a cached checkout after the campaign payment cutoff", async () => {
    const f = await boundFixture();
    vi.setSystemTime(Date.now() + 600_001);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(f.sponsor.action(api.whop.checkout.create, { campaignId: f.campaignId })).rejects.toThrow("The payment deadline has passed");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).payments).toHaveLength(0);
  });

  it("refuses unauthenticated and other sponsor checkout before contacting Whop", async () => {
    const f = await fixture();
    const { sponsor: other } = await sponsorSession(f.t);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(f.t.action(api.whop.checkout.create, { campaignId: f.campaignId })).rejects.toThrow("Sign in required");
    await expect(other.action(api.whop.checkout.create, { campaignId: f.campaignId })).rejects.toThrow("Sponsor review permission required");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).campaign?.state).toBe("draft");
  });
});

describe("signed webhook to atomic activation", () => {
  it("activates once across concurrent delivery and later duplicate events", async () => {
    const f = await boundFixture();
    const fetcher = vi.fn(async () => Response.json(providerPayment(f)));
    vi.stubGlobal("fetch", fetcher);
    const request = await signedRequest();
    const responses = await Promise.all([f.t.fetch("/whop/webhook", request), f.t.fetch("/whop/webhook", request)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await f.t.fetch("/whop/webhook", await signedRequest("payment.succeeded", "msg_second"))).status).toBe(200);
    const result = await state(f);
    expect(result.campaign?.state).toBe("prediction_open");
    expect(result.payments).toHaveLength(1);
    expect(result.events).toHaveLength(2);
    expect(result.payments[0]).toMatchObject({ amountUsdCents: 2500, currency: "USD", sandbox: true, providerPaymentId: "pay_test" });
  });

  it.each(["payment.canceled", "payment.failed", "payment.pending"])("does not activate a signed %s event", async (type) => {
    const f = await boundFixture();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await f.t.fetch("/whop/webhook", await signedRequest(type))).status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await state(f)).payments).toHaveLength(0);
    expect((await state(f)).campaign?.state).toBe("awaiting_payment");
  });

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
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...providerPayment(f), ...change })));
    expect((await f.t.fetch("/whop/webhook", await signedRequest())).status).toBe(400);
    const result = await state(f);
    expect(result.payments).toHaveLength(0);
    expect(result.campaign?.state).toBe("awaiting_payment");
  });

  it("asks the provider to retry an unavailable payment without activating", async () => {
    const f = await boundFixture();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Unavailable" } }, { status: 503 })));
    expect((await f.t.fetch("/whop/webhook", await signedRequest())).status).toBe(503);
    expect((await state(f)).payments).toHaveLength(0);
  });
});
