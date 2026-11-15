import { unwrapWebhook } from "@whop/sdk/helpers";

import { internal } from "../_generated/api";
import { env, httpAction } from "../_generated/server";
import { paymentNotice } from "./validation";

export const whopWebhook = httpAction(async (ctx, request) => {
  if (!env.WHOP_WEBHOOK_SECRET || !env.WHOP_ACCOUNT_ID) return new Response("Webhook unavailable", { status: 503 });
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 262_144) return new Response("Too large", { status: 413 });
  const headers = Object.fromEntries(
    ["webhook-id", "webhook-timestamp", "webhook-signature"].map((name) => [name, request.headers.get(name) ?? ""]),
  );
  let notice;
  try {
    const event = unwrapWebhook<unknown>(body, { headers, key: env.WHOP_WEBHOOK_SECRET });
    notice = paymentNotice(event, headers["webhook-id"], env.WHOP_ACCOUNT_ID);
  } catch {
    return new Response("Webhook not accepted", { status: 400 });
  }
  if (!notice) return new Response("OK", { status: 200 });
  const { status } = await ctx.runAction(internal.whop.events.handle, notice);
  return new Response(status === 200 ? "OK" : "Webhook not accepted", { status });
});
