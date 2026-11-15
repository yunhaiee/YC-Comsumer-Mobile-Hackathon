"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { whopConfig } from "./client";
import { sandboxCheckoutUrl } from "./validation";

export const create = action({
  args: { amountUsdCents: v.number(), requestId: v.string() },
  returns: v.object({ checkoutUrl: v.string() }),
  handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
    const terms = await ctx.runMutation(internal.deposits.prepare, args);
    if (terms.checkoutUrl)
      return { checkoutUrl: sandboxCheckoutUrl(terms.checkoutUrl) };
    const { client, accountId, returnUrl } = whopConfig();
    const metadata = {
      kind: "deposit",
      depositId: terms.depositId,
      userId: terms.userId,
      currency: "USD",
      sandbox: "true",
    };
    let checkout;
    let variant;
    try {
      checkout = await client.checkoutConfigurations.create(
        {
          account_id: accountId,
          mode: "payment",
          redirect_url: returnUrl,
          metadata,
          variant: {
            account_id: accountId,
            title: "DARE sandbox USD deposit",
            description:
              "Demo dollars only. No real money, withdrawals, or redemption.",
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
        },
        { idempotencyKey: `dare:deposit:${terms.depositId}:v1` },
      );
      if (!checkout.variant?.id) throw new Error("Missing deposit variant");
      variant = await client.variants.update({
        id: checkout.variant.id,
        adaptive_pricing_enabled: false,
        allow_multiple_quantity: false,
      });
    } catch {
      throw new ConvexError(
        "Whop sandbox deposit checkout is unavailable. No demo dollars were added. Retry with the same request.",
      );
    }
    const checkoutUrl = sandboxCheckoutUrl(checkout.purchase_url);
    if (
      checkout.account_id !== accountId ||
      checkout.variant?.id !== variant.id ||
      checkout.mode !== "payment" ||
      variant.currency !== "usd" ||
      variant.billing_type !== "one_time" ||
      variant.initial_price !== terms.amountUsdCents / 100 ||
      variant.adaptive_pricing_enabled ||
      variant.allow_multiple_quantity
    )
      throw new ConvexError(
        "Whop returned a checkout that does not match this deposit.",
      );
    const bound = await ctx.runMutation(internal.deposits.recordCheckout, {
      depositId: terms.depositId,
      providerCheckoutId: checkout.id,
      providerVariantId: variant.id,
      checkoutUrl,
    });
    return { checkoutUrl: sandboxCheckoutUrl(bound.checkoutUrl) };
  },
});
