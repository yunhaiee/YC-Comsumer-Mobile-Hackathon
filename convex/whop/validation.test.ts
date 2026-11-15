import { unwrapWebhook } from "@whop/sdk/helpers";
import { describe, expect, it } from "vitest";

import { paymentNotice, sandboxCheckoutUrl, usdCents, validatePayment, type PaymentBinding } from "./validation";

const binding: PaymentBinding = {
  campaignId: "campaign_test",
  sponsorId: "sponsor_test",
  providerCheckoutId: "ch_test",
  providerVariantId: "plan_test",
  amountUsdCents: 2500,
  currency: "USD",
  sandbox: true,
};

const money = (amount: string, currency = "usd") => ({ amount, currency, decimals: 2, display_decimals: 2 });

function payment() {
  return {
    id: "pay_test",
    account_id: "biz_test",
    product_id: "prod_test",
    checkout_configuration_id: "ch_test",
    variant_id: "plan_test",
    status: "paid",
    substatus: "succeeded",
    currency: "usd",
    paid_at: "2026-11-15T12:00:00.000Z",
    refunded_at: null,
    auto_refunded: false,
    promo_code_id: null,
    refunded_amount: money("0.00"),
    total: money("25.00"),
    subtotal: money("25.00"),
    metadata: { dare_campaign_id: "campaign_test", dare_sponsor_id: "sponsor_test", dare_environment: "sandbox" },
  };
}

const validate = (value: unknown, terms = binding) => validatePayment(value, terms, "pay_test", "biz_test");

describe("sandbox payment validation", () => {
  it("accepts a paid provider payment bound to the frozen sponsor checkout", () => {
    expect(validate(payment())).toBe(2500);
  });

  it.each(["open", "pending", "void", "uncollectible", "canceled"])("refuses %s payments", (status) => {
    expect(() => validate({ ...payment(), status })).toThrow();
  });

  it.each([
    { total: money("24.99") },
    { total: money("25.01") },
    { subtotal: money("30.00") },
    { currency: "eur" },
    { total: money("25.00", "eur") },
    { id: "pay_other" },
    { account_id: "biz_other" },
    { checkout_configuration_id: "ch_other" },
    { variant_id: "plan_other" },
    { paid_at: null },
    { paid_at: "invalid" },
    { substatus: "refunded" },
    { refunded_amount: money("0.01") },
    { refunded_at: "2026-11-15T12:01:00.000Z" },
    { auto_refunded: true },
    { promo_code_id: "promo_test" },
    { metadata: null },
    { metadata: { ...payment().metadata, dare_campaign_id: "campaign_other" } },
    { metadata: { ...payment().metadata, dare_sponsor_id: "sponsor_other" } },
    { metadata: { ...payment().metadata, dare_environment: "production" } },
  ])("refuses mismatched or refunded payment %#", (change) => {
    expect(() => validate({ ...payment(), ...change })).toThrow();
  });

  it("refuses non-sandbox or invalid frozen terms", () => {
    expect(() => validate(payment(), { ...binding, sandbox: false } as unknown as PaymentBinding)).toThrow();
    expect(() => validate(payment(), { ...binding, amountUsdCents: 2500.5 })).toThrow();
  });

  it("converts decimal strings exactly, not by floating point rounding", () => {
    expect(usdCents(money("19.99"))).toBe(1999);
    expect(usdCents(money("0.29"))).toBe(29);
    expect(usdCents(money("25"))).toBe(2500);
    expect(usdCents(money("25.5"))).toBe(2550);
    for (const amount of ["25.001", "-1.00", "NaN", "Infinity", "1e3", "", "9007199254740992"]) {
      expect(() => usdCents(money(amount))).toThrow();
    }
  });
});

describe("signed webhook envelope", () => {
  const key = "ws_unit_test_only_not_a_real_credential";
  const event = { id: "msg_test", type: "payment.succeeded", account_id: "biz_test", data: payment() };

  async function sign(body: string, timestamp = Math.floor(Date.now() / 1000)) {
    const encoder = new TextEncoder();
    const signingKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", signingKey, encoder.encode(`msg_test.${timestamp}.${body}`));
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return {
      "webhook-id": "msg_test",
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,${encodedSignature}`,
    };
  }

  it("verifies the original raw body with the current SDK ws_ convention", async () => {
    const body = JSON.stringify(event, null, 2);
    const verified = unwrapWebhook<unknown>(body, { headers: await sign(body), key });
    expect(paymentNotice(verified, "msg_test", "biz_test")).toEqual({ paymentId: "pay_test", checkoutId: "ch_test", eventId: "msg_test" });
  });

  it("rejects changed bytes, forged signatures, stale events, and missing headers", async () => {
    const body = JSON.stringify(event, null, 2);
    const headers = await sign(body);
    const staleHeaders = await sign(body, Math.floor(Date.now() / 1000) - 600);
    expect(() => unwrapWebhook(JSON.stringify(event), { headers, key })).toThrow();
    expect(() => unwrapWebhook(body, { headers, key: "ws_wrong_key" })).toThrow();
    expect(() => unwrapWebhook(body, { headers: staleHeaders, key })).toThrow();
    expect(() => unwrapWebhook(body, { headers: {}, key })).toThrow();
  });

  it.each(["payment.failed", "payment.canceled", "payment.pending", "checkout.created"])("ignores signed %s events", (type) => {
    expect(paymentNotice({ ...event, type }, "msg_test", "biz_test")).toBeNull();
  });

  it("rejects mismatched signed event and account IDs", () => {
    expect(() => paymentNotice(event, "msg_other", "biz_test")).toThrow();
    expect(() => paymentNotice(event, "msg_test", "biz_other")).toThrow();
  });
});

describe("hosted checkout URL", () => {
  it("accepts only the Whop sandbox hosted checkout", () => {
    expect(sandboxCheckoutUrl("https://sandbox.whop.com/checkout/ch_test/")).toBe("https://sandbox.whop.com/checkout/ch_test/");
    for (const value of [null, "https://whop.com/checkout/ch_test/", "http://sandbox.whop.com/checkout/ch_test/", "https://sandbox.whop.com.evil.example/checkout/ch_test/", "https://user@sandbox.whop.com/checkout/ch_test/", "https://sandbox.whop.com:8443/checkout/ch_test/", "https://sandbox.whop.com/dashboard/"]) {
      expect(() => sandboxCheckoutUrl(value)).toThrow();
    }
  });
});
