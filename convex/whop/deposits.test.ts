/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.{ts,js}");
const secret = "ws_deposit_test_fixture_only";
const checkoutUrl = "https://sandbox.whop.com/checkout/ch_deposit/";
function setup() {
  const t = convexTest(schema, modules);
  registerCore(t);
  return t;
}
async function account(t: ReturnType<typeof setup>) {
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
  return { userId, client: t.withIdentity(sessionIdentity(tokens)) };
}
async function fixture() {
  const t = setup(),
    a = await account(t);
  const deposit = await a.client.mutation(internal.deposits.prepare, {
    amountUsdCents: 1000,
    requestId: "deposit_request1",
  });
  await a.client.mutation(internal.deposits.recordCheckout, {
    depositId: deposit.depositId,
    providerCheckoutId: "ch_deposit",
    providerVariantId: "plan_deposit",
    checkoutUrl,
  });
  return { t, ...a, deposit };
}
const money = (amount: string) => ({
  amount,
  currency: "usd",
  decimals: 2,
  display_decimals: 2,
});
function providerPayment(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    id: "pay_deposit",
    account_id: "biz_test",
    checkout_configuration_id: "ch_deposit",
    variant_id: "plan_deposit",
    status: "paid",
    substatus: "succeeded",
    currency: "usd",
    paid_at: "2026-11-15T12:00:00Z",
    total: money("10.00"),
    refunded_amount: money("0.00"),
    refunded_at: null,
    auto_refunded: false,
    promo_code_id: null,
    metadata: {
      kind: "deposit",
      depositId: f.deposit.depositId,
      userId: f.userId,
      currency: "USD",
      sandbox: "true",
    },
  };
}
async function signedRequest(
  type = "payment.succeeded",
  eventId = "msg_deposit",
  checkoutId = "ch_deposit",
) {
  const body = JSON.stringify({
    id: eventId,
    type,
    account_id: "biz_test",
    data: { id: "pay_deposit", checkout_configuration_id: checkoutId },
  });
  const timestamp = String(Math.floor(Date.now() / 1000)),
    encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
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
function completion(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    depositId: f.deposit.depositId,
    providerCheckoutId: "ch_deposit",
    providerPaymentId: "pay_deposit",
    providerEventId: "msg_deposit",
    amountUsdCents: 1000,
    currency: "USD" as const,
    sandbox: true as const,
  };
}
async function boundCampaign(f: Awaited<ReturnType<typeof fixture>>) {
  await f.t.run(async (ctx) => {
    const sponsorId = await ctx.db.insert("sponsors", {
      name: "Deposit boundary test",
      isDemo: true,
      campaignCount: 0,
    });
    await ctx.db.insert("memberships", { userId: f.userId, sponsorId });
  });
  const campaignId = await f.client.mutation(api.campaigns.createDraft, {
    templateId: "paper-plane",
    winnerCount: 1,
    rewardUsdCents: 1000,
    predictionClosesAt: Date.now() + 600_000,
    attemptStartsAt: Date.now() + 600_000,
    deadlineAt: Date.now() + 1_200_000,
  });
  await f.client.mutation(internal.payments.recordCheckout, {
    campaignId,
    providerCheckoutId: "ch_campaign",
    providerVariantId: "plan_campaign",
    checkoutUrl: "https://sandbox.whop.com/checkout/ch_campaign/",
  });
  return {
    campaignId,
    providerCheckoutId: "ch_campaign",
    providerPaymentId: "pay_campaign",
    providerEventId: "msg_campaign",
    amountUsdCents: 1000,
    currency: "USD" as const,
    sandbox: true as const,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("CONVEX_CLOUD_URL", "https://deposit-test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://deposit-test.convex.site");
  vi.stubEnv("WHOP_API_KEY", "sandbox_test_fixture_only");
  vi.stubEnv("WHOP_ACCOUNT_ID", "biz_test");
  vi.stubEnv("WHOP_WEBHOOK_SECRET", secret);
  vi.stubEnv(
    "WHOP_CHECKOUT_RETURN_URL",
    "https://deposit-test.convex.site/whop/return",
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authenticated sandbox deposit checkout", () => {
  it("persists one frozen intent before provider IO and reuses owner-bound request IDs", async () => {
    const t = setup(),
      a = await account(t);
    const keys: (string | null)[] = [];
    let metadata: Record<string, string> | undefined;
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toMatch(
          /^https:\/\/sandbox-api\.whop\.com\/api\/v1\//,
        );
        const intents = await t.run((ctx) => ctx.db.query("deposits").take(10));
        expect(intents).toHaveLength(1);
        expect(intents[0]).toMatchObject({
          userId: a.userId,
          amountUsdCents: 1000,
          status: "pending",
        });
        const body = JSON.parse(String(init?.body));
        if (String(input).endsWith("/checkout_configurations")) {
          keys.push(new Headers(init?.headers).get("Idempotency-Key"));
          metadata = body.metadata;
          expect(body).toMatchObject({
            redirect_url: "https://deposit-test.convex.site/whop/return",
            metadata: {
              kind: "deposit",
              userId: a.userId,
              depositId: intents[0]._id,
              currency: "USD",
              sandbox: "true",
            },
            variant: { initial_price: 10, currency: "usd", stock: 1 },
          });
          return Response.json({
            id: "ch_deposit",
            account_id: "biz_test",
            mode: "payment",
            purchase_url: checkoutUrl,
            variant: { id: "plan_deposit" },
          });
        }
        return Response.json({
          id: "plan_deposit",
          currency: "usd",
          billing_type: "one_time",
          initial_price: 10,
          adaptive_pricing_enabled: false,
          allow_multiple_quantity: false,
        });
      },
    );
    vi.stubGlobal("fetch", fetcher);
    const args = { amountUsdCents: 1000, requestId: "deposit_request1" };
    const results = await Promise.all([
      a.client.action(api.whop.deposits.create, args),
      a.client.action(api.whop.deposits.create, args),
    ]);
    expect(results).toEqual([{ checkoutUrl }, { checkoutUrl }]);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(`dare:deposit:${metadata!.depositId}:v1`);
    const calls = fetcher.mock.calls.length;
    expect(await a.client.action(api.whop.deposits.create, args)).toEqual({
      checkoutUrl,
    });
    expect(fetcher).toHaveBeenCalledTimes(calls);
    await expect(
      a.client.action(api.whop.deposits.create, {
        ...args,
        amountUsdCents: 1001,
      }),
    ).rejects.toThrow("payload conflict");
    expect(await a.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
      deposits: [{ amountUsdCents: 1000, status: "pending" }],
    });
    expect(await t.run((ctx) => ctx.db.query("ledger").take(10))).toEqual([]);
  });

  it.each([499, 50001, 500.5, -100])(
    "rejects invalid deposit amount %s before creating an intent",
    async (amountUsdCents) => {
      const t = setup(),
        a = await account(t),
        fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(
        a.client.action(api.whop.deposits.create, {
          amountUsdCents,
          requestId: "deposit_request1",
        }),
      ).rejects.toThrow("Invalid deposit");
      expect(fetcher).not.toHaveBeenCalled();
      expect(await t.run((ctx) => ctx.db.query("deposits").take(10))).toEqual(
        [],
      );
    },
  );
  it("accepts exact $5/$500 boundaries without crediting before payment", async () => {
    const t = setup(),
      a = await account(t);
    for (const amountUsdCents of [500, 50000])
      expect(
        await a.client.mutation(internal.deposits.prepare, {
          amountUsdCents,
          requestId: `deposit_${amountUsdCents}`,
        }),
      ).toMatchObject({ amountUsdCents, userId: a.userId });
    expect(await a.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
    });
  });
  it("rejects anonymous access, spoofed user IDs, and another owner's binding", async () => {
    const f = await fixture(),
      other = await account(f.t),
      fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      f.t.action(api.whop.deposits.create, {
        amountUsdCents: 1000,
        requestId: "deposit_request1",
      }),
    ).rejects.toThrow("Sign in required");
    await expect(
      other.client.action(api.whop.deposits.create, {
        amountUsdCents: 1000,
        requestId: "deposit_request1",
        userId: f.userId,
      } as never),
    ).rejects.toThrow();
    await expect(
      other.client.mutation(internal.deposits.recordCheckout, {
        depositId: f.deposit.depositId,
        providerCheckoutId: "ch_deposit",
        providerVariantId: "plan_deposit",
        checkoutUrl,
      }),
    ).rejects.toThrow("owner");
    await expect(
      f.client.mutation(internal.deposits.recordCheckout, {
        depositId: f.deposit.depositId,
        providerCheckoutId: "ch_other",
        providerVariantId: "plan_other",
        checkoutUrl,
      }),
    ).rejects.toThrow("immutable");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await other.client.query(api.profiles.me, {}))?.deposits).toEqual(
      [],
    );
  });
  it("keeps failed provider checkout as pending with no fake cancellation or credit", async () => {
    const t = setup(),
      a = await account(t);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "parameter_invalid",
              message: "private provider message",
              type: "bad_request",
            },
          },
          { status: 400 },
        ),
      ),
    );
    await expect(
      a.client.action(api.whop.deposits.create, {
        amountUsdCents: 1000,
        requestId: "deposit_request1",
      }),
    ).rejects.toThrow("No demo dollars were added");
    expect(await a.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
      deposits: [{ status: "pending", amountUsdCents: 1000 }],
    });
  });
});

describe("verified sandbox deposit settlement", () => {
  it("preserves legacy balances and grant history when adding verified sandbox funding", async () => {
    const f = await fixture();
    const grantId = await f.t.run(async (ctx) => {
      await ctx.db.patch("users", f.userId, { balanceUnits: 100000 });
      return await ctx.db.insert("ledger", {
        userId: f.userId,
        kind: "grant",
        deltaUnits: 100000,
        balanceUnits: 100000,
        key: `grant:${f.userId}`,
        createdAt: Date.now(),
      });
    });
    const legacyGrant = await f.t.run((ctx) => ctx.db.get("ledger", grantId));
    await f.t.mutation(internal.deposits.complete, completion(f));
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 101000,
    });
    expect(await f.t.run((ctx) => ctx.db.get("ledger", grantId))).toEqual(
      legacyGrant,
    );
    expect(
      await f.t.run((ctx) => ctx.db.query("ledger").take(10)),
    ).toHaveLength(2);
  });

  it("returns only the viewer's latest50 minimal deposit records", async () => {
    const t = setup(),
      a = await account(t),
      other = await account(t);
    for (let i = 0; i < 51; i++)
      await a.client.mutation(internal.deposits.prepare, {
        amountUsdCents: 500 + i,
        requestId: `history_request_${i}`,
      });
    const history = (await a.client.query(api.profiles.me, {}))!.deposits;
    expect(history).toHaveLength(50);
    expect(history[0].amountUsdCents).toBe(550);
    expect(history[49].amountUsdCents).toBe(501);
    expect(Object.keys(history[0]).sort()).toEqual([
      "amountUsdCents",
      "createdAt",
      "status",
    ]);
    expect((await other.client.query(api.profiles.me, {}))!.deposits).toEqual(
      [],
    );
  });
  it("enforces global payment/event uniqueness in both directions across campaigns and deposits", async () => {
    const f = await fixture(),
      campaign = await boundCampaign(f);
    await f.t.mutation(internal.deposits.complete, completion(f));
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...campaign,
        providerPaymentId: "pay_deposit",
      }),
    ).rejects.toThrow("identity conflict");
    await expect(
      f.t.mutation(internal.payments.activateCampaign, {
        ...campaign,
        providerEventId: "msg_deposit",
      }),
    ).rejects.toThrow("identity conflict");
    await f.t.mutation(internal.payments.activateCampaign, campaign);
    const second = await f.client.mutation(internal.deposits.prepare, {
      amountUsdCents: 1000,
      requestId: "deposit_request2",
    });
    await f.client.mutation(internal.deposits.recordCheckout, {
      depositId: second.depositId,
      providerCheckoutId: "ch_second",
      providerVariantId: "plan_second",
      checkoutUrl: "https://sandbox.whop.com/checkout/ch_second/",
    });
    const secondArgs = {
      ...completion(f),
      depositId: second.depositId,
      providerCheckoutId: "ch_second",
      providerPaymentId: "pay_second",
      providerEventId: "msg_second",
    };
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...secondArgs,
        providerPaymentId: "pay_campaign",
      }),
    ).rejects.toThrow("identity conflict");
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...secondArgs,
        providerEventId: "msg_campaign",
      }),
    ).rejects.toThrow("identity conflict");
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...secondArgs,
        providerPaymentId: "pay_deposit",
      }),
    ).rejects.toThrow("identity conflict");
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...secondArgs,
        providerEventId: "msg_deposit",
      }),
    ).rejects.toThrow("event reused");
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 1000,
    });
  });

  it("serializes cross-target concurrent delivery so a provider payment credits or activates only once", async () => {
    const f = await fixture(),
      campaign = await boundCampaign(f);
    const result = await Promise.allSettled([
      f.t.mutation(internal.deposits.complete, {
        ...completion(f),
        providerPaymentId: "pay_shared",
        providerEventId: "msg_shared",
      }),
      f.t.mutation(internal.payments.activateCampaign, {
        ...campaign,
        providerPaymentId: "pay_shared",
        providerEventId: "msg_shared",
      }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const receipts = await f.t.run(
      async (ctx) =>
        (await ctx.db.query("payments").take(10)).length +
        (await ctx.db.query("depositPayments").take(10)).length,
    );
    expect(receipts).toBe(1);
  });

  it("prevents checkout binding reuse across deposit and campaign targets", async () => {
    const f = await fixture(),
      campaign = await boundCampaign(f);
    const second = await f.client.mutation(internal.deposits.prepare, {
      amountUsdCents: 1000,
      requestId: "deposit_request2",
    });
    await expect(
      f.client.mutation(internal.deposits.recordCheckout, {
        depositId: second.depositId,
        providerCheckoutId: "ch_campaign",
        providerVariantId: "plan_campaign",
        checkoutUrl: "https://sandbox.whop.com/checkout/ch_campaign/",
      }),
    ).rejects.toThrow("already bound");
    const secondCampaign = await f.client.mutation(api.campaigns.createDraft, {
      templateId: "paper-plane",
      winnerCount: 1,
      rewardUsdCents: 1000,
      predictionClosesAt: Date.now() + 600_000,
      attemptStartsAt: Date.now() + 600_000,
      deadlineAt: Date.now() + 1_200_000,
    });
    await expect(
      f.client.mutation(internal.payments.recordCheckout, {
        campaignId: secondCampaign,
        providerCheckoutId: "ch_deposit",
        providerVariantId: "plan_deposit",
        checkoutUrl,
      }),
    ).rejects.toThrow("already bound");
    const payment = {
      ...providerPayment(f),
      checkout_configuration_id: "ch_campaign",
      variant_id: "plan_campaign",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(payment)),
    );
    expect(
      (
        await f.t.fetch(
          "/whop/webhook",
          await signedRequest(
            "payment.succeeded",
            "msg_wrong_target",
            "ch_campaign",
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      await f.client.query(api.campaigns.get, {
        campaignId: campaign.campaignId,
      }),
    ).toMatchObject({ state: "awaiting_payment" });
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
    });
  });

  it("binds immutable receipt arguments and never accepts a caller-supplied user", async () => {
    const f = await fixture();
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...completion(f),
        amountUsdCents: 1001,
      }),
    ).rejects.toThrow("terms mismatch");
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...completion(f),
        providerCheckoutId: "ch_wrong",
      }),
    ).rejects.toThrow("terms mismatch");
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...completion(f),
        currency: "EUR",
      } as never),
    ).rejects.toThrow();
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...completion(f),
        sandbox: false,
      } as never),
    ).rejects.toThrow();
    await expect(
      f.t.mutation(internal.deposits.complete, {
        ...completion(f),
        userId: f.userId,
      } as never),
    ).rejects.toThrow();
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
    });
  });
  it("credits once across concurrent signed deliveries, new events, and replay after spending", async () => {
    const f = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(providerPayment(f))),
    );
    const request = await signedRequest();
    expect(
      (
        await Promise.all([
          f.t.fetch("/whop/webhook", request),
          f.t.fetch("/whop/webhook", request),
        ])
      ).map((r) => r.status),
    ).toEqual([200, 200]);
    expect(
      (
        await f.t.fetch(
          "/whop/webhook",
          await signedRequest("payment.succeeded", "msg_second"),
        )
      ).status,
    ).toBe(200);
    const receipt = await f.t.mutation(
      internal.deposits.complete,
      completion(f),
    );
    await f.t.run((ctx) =>
      ctx.db.patch("users", f.userId, { balanceUnits: 123 }),
    );
    expect(
      await f.t.mutation(internal.deposits.complete, completion(f)),
    ).toEqual(receipt);
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      currency: "USD",
      moneyMode: "sandbox",
      balanceUnits: 123,
      deposits: [{ amountUsdCents: 1000, status: "completed" }],
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("depositPayments").take(10)),
    ).toHaveLength(1);
    expect(
      await f.t.run((ctx) => ctx.db.query("depositEvents").take(10)),
    ).toHaveLength(2);
    expect(
      await f.t.run((ctx) => ctx.db.query("ledger").take(10)),
    ).toMatchObject([
      {
        kind: "deposit",
        deltaUnits: 1000,
        balanceUnits: 1000,
        key: "deposit:pay_deposit",
      },
    ]);
  });
  it("does not credit from a forged raw webhook or the return page", async () => {
    const f = await fixture(),
      fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const request = await signedRequest();
    request.body += " ";
    expect((await f.t.fetch("/whop/webhook", request)).status).toBe(400);
    expect(
      (await f.t.fetch("/whop/return?kind=deposit&status=paid")).status,
    ).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
    });
  });
  it.each(["payment.pending", "payment.failed", "payment.canceled"])(
    "does not credit signed %s events",
    async (type) => {
      const f = await fixture(),
        fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect(
        (await f.t.fetch("/whop/webhook", await signedRequest(type))).status,
      ).toBe(200);
      expect(fetcher).not.toHaveBeenCalled();
      expect(await f.client.query(api.profiles.me, {})).toMatchObject({
        balanceUnits: 0,
      });
    },
  );
  it.each([
    { total: money("9.99") },
    { currency: "eur" },
    { account_id: "biz_wrong" },
    { variant_id: "plan_wrong" },
    { checkout_configuration_id: "ch_wrong" },
    { status: "pending" },
    { refunded_at: "2026-11-15T12:01:00Z" },
    { refunded_amount: money("1.00") },
    { auto_refunded: true },
    { promo_code_id: "promo_test" },
  ])("rejects mismatched or refunded provider payment %j", async (patch) => {
    const f = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...providerPayment(f), ...patch })),
    );
    expect(
      (await f.t.fetch("/whop/webhook", await signedRequest())).status,
    ).toBe(400);
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("depositPayments").take(10)),
    ).toEqual([]);
  });
  it.each([
    { kind: "campaign" },
    { depositId: "wrong" },
    { userId: "wrong" },
    { currency: "EUR" },
    { sandbox: "false" },
  ])(
    "rejects metadata mismatch %j without using metadata as routing authority",
    async (patch) => {
      const f = await fixture(),
        payment = providerPayment(f);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            ...payment,
            metadata: { ...payment.metadata, ...patch },
          }),
        ),
      );
      expect(
        (await f.t.fetch("/whop/webhook", await signedRequest())).status,
      ).toBe(400);
      expect(await f.client.query(api.profiles.me, {})).toMatchObject({
        balanceUnits: 0,
      });
      expect(await f.t.run((ctx) => ctx.db.query("payments").take(10))).toEqual(
        [],
      );
    },
  );
  it("does not trust an unbound checkout even with valid deposit metadata", async () => {
    const f = await fixture(),
      fetcher = vi.fn(async () => Response.json(providerPayment(f)));
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await f.t.fetch(
          "/whop/webhook",
          await signedRequest("payment.succeeded", "msg_unknown", "ch_unknown"),
        )
      ).status,
    ).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await f.client.query(api.profiles.me, {})).toMatchObject({
      balanceUnits: 0,
    });
  });
});
