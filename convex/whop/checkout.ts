"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { whopConfig } from "./client";
import { sandboxCheckoutUrl } from "./validation";

export const create = action({
  args: { campaignId: v.id("campaigns") },
  returns: v.object({ checkoutUrl: v.string(), sandbox: v.literal(true) }),
  handler: async (ctx, { campaignId }): Promise<{ checkoutUrl: string; sandbox: true }> => {
    const terms = await ctx.runQuery(internal.payments.getCheckoutTerms, { campaignId });
    if (terms.state !== "draft" && terms.state !== "awaiting_payment") {
      throw new ConvexError("This campaign no longer needs checkout.");
    }
    if (Date.now() >= terms.predictionClosesAt) {
      throw new ConvexError("The payment deadline has passed. Create a new campaign.");
    }
    if (terms.checkoutUrl) {
      return { checkoutUrl: sandboxCheckoutUrl(terms.checkoutUrl), sandbox: true as const };
    }
    const { client, accountId, returnUrl } = whopConfig();
    const metadata = {
      dare_campaign_id: terms.campaignId,
      dare_sponsor_id: terms.sponsorId,
      dare_environment: "sandbox",
    };
    let checkout;
    let variant;
    try {
      checkout = await client.checkoutConfigurations.create({
        account_id: accountId,
        mode: "payment",
        redirect_url: returnUrl,
        metadata,
        variant: {
          account_id: accountId,
          title: "DARE campaign sponsorship",
          description: "Sandbox sponsorship. Represented rewards only; no participant payouts.",
          billing_type: "one_time",
          initial_price: terms.amountUsdCents / 100,
          currency: "usd",
          override_tax_type: "inclusive",
          stock: 1,
          unlimited_stock: false,
          visibility: "hidden",
          release_method: "buy_now",
          force_create_new_plan: true,
          metadata,
        },
      }, { idempotencyKey: `dare:checkout:${campaignId}:v1` });
      if (!checkout.variant?.id) throw new Error("Missing checkout variant");
      variant = await client.variants.update({
        id: checkout.variant.id,
        adaptive_pricing_enabled: false,
        allow_multiple_quantity: false,
      });
    } catch {
      throw new ConvexError("Whop sandbox checkout is unavailable. Your campaign is not activated. Please try again.");
    }
    const checkoutUrl = sandboxCheckoutUrl(checkout.purchase_url);
    if (
      checkout.account_id !== accountId || checkout.variant?.id !== variant.id || checkout.mode !== "payment" ||
      variant.currency !== "usd" || variant.billing_type !== "one_time" ||
      variant.initial_price !== terms.amountUsdCents / 100 || variant.adaptive_pricing_enabled || variant.allow_multiple_quantity
    ) {
      throw new ConvexError("Whop returned a checkout that does not match this campaign.");
    }
    const bound = await ctx.runMutation(internal.payments.recordCheckout, {
      campaignId,
      providerCheckoutId: checkout.id,
      providerVariantId: variant.id,
      checkoutUrl,
    });
    return { checkoutUrl: sandboxCheckoutUrl(bound.checkoutUrl), sandbox: true as const };
  },
});
