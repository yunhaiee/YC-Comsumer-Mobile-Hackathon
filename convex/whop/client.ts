import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { ConvexError } from "convex/values";

import { env } from "../_generated/server";

export function whopConfig() {
  const {
    WHOP_API_KEY,
    WHOP_ACCOUNT_ID,
    WHOP_WEBHOOK_SECRET,
    WHOP_CHECKOUT_RETURN_URL,
  } = env;
  if (
    !WHOP_API_KEY ||
    !WHOP_ACCOUNT_ID ||
    !WHOP_WEBHOOK_SECRET ||
    !WHOP_CHECKOUT_RETURN_URL
  ) {
    throw new ConvexError(
      "Sandbox checkout is not configured. Ask the demo operator to configure Whop.",
    );
  }
  if (!WHOP_ACCOUNT_ID.startsWith("biz_")) {
    throw new ConvexError(
      "The sandbox Whop account is not configured correctly.",
    );
  }
  const returnUrl = new URL(WHOP_CHECKOUT_RETURN_URL);
  if (
    returnUrl.protocol !== "https:" ||
    returnUrl.username ||
    returnUrl.password
  ) {
    throw new ConvexError(
      "The checkout return URL is not configured correctly.",
    );
  }
  return {
    accountId: WHOP_ACCOUNT_ID,
    returnUrl: returnUrl.toString(),
    client: new WhopClient({
      token: WHOP_API_KEY,
      environment: WhopEnvironment.Sandbox,
      apiVersionDate: "2026-11-14-1",
      timeoutInSeconds: 15,
      maxRetries: 1,
      logging: { silent: true },
    }),
  };
}
