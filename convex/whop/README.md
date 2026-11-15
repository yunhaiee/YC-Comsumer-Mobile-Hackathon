# DARE sandbox sponsorship

This module uses `@whop/sdk` 2.8.1's current checkout configurations and variants API. It never selects production, invokes payouts, or activates a campaign from a redirect.

## Configure the shared development deployment

1. Create a sandbox account at <https://sandbox.whop.com>. Its account, keys and webhooks are separate from production. Do not use the Whop CLI or MCP server to provision sandbox resources; those operate on production.
2. At <https://sandbox.whop.com/dashboard/developer>, create a sandbox **Account API Key**. Whop's sandbox quickstart uses the Admin role. Store the key as `WHOP_API_KEY` in the Convex development deployment's environment, never in an `EXPO_PUBLIC_` variable or source file.
3. Read the account ID with `client.accounts.me()` on a `WhopClient` configured with `WhopEnvironment.Sandbox`. Store its `biz_` ID as `WHOP_ACCOUNT_ID`.
4. Set `WHOP_CHECKOUT_RETURN_URL` to the approved HTTPS sponsor-studio URL. The server also allows a `dare:` deep link for a native demo, but provider acceptance and the device return path must be verified separately. Redirects are navigation only.
5. Register an enabled sandbox webhook for `payment.succeeded`, pointing to `https://<development-deployment>.convex.site/whop/webhook` (the HTTP site URL, not `.convex.cloud`). Use the sandbox account as `resource_id`, set `child_resource_events: false`, and pin `api_version_date: "2026-11-14-1"`. Store its one-time `ws_` signing secret verbatim as `WHOP_WEBHOOK_SECRET` in the same Convex deployment.

No product ID is required. Each authenticated campaign checkout creates a one-time inline variant at the backend-frozen USD amount, with one unit of stock. Before returning the URL, the action disables adaptive currency pricing and multiple quantities through the current variants API, validates the response, and saves the checkout and variant IDs through TK's sponsor-authorized mutation. Retries reuse the stored URL; provider creation requests also carry a stable idempotency key.

All four variables are server-only. The account ID and return URL are configuration, while the API key and webhook secret are credentials. SDK logging is disabled; provider responses and credentials are not returned in errors.

## Contract

- `api.whop.checkout.create({ campaignId })` returns `{ checkoutUrl, sandbox: true }` only after the sponsor-owned frozen terms are bound to that checkout. It returns no payment success claim.
- `whopWebhook` is exported from `convex/whop/webhook.ts`. TK registers `POST /whop/webhook` in `convex/http.ts`.
- The HTTP action verifies the exact raw body with `unwrapWebhook` before accepting an event. Failed, pending and cancelled events do not activate campaigns.
- A signed success notice contains only references. The Node action retrieves the payment again from the sandbox API and checks its account, checkout, variant, campaign/sponsor metadata, paid status, USD currency, exact decimal amount, and refund/discount state.
- `internal.payments.activateCampaign` receives `campaignId`, `providerCheckoutId`, `providerPaymentId`, `providerEventId`, `amountUsdCents`, `currency: "USD"`, and `sandbox: true`. TK validates the stored binding and deduplicates payment/event IDs atomically. Unknown bindings and transient failures return 503 for provider retry; invalid signatures or mismatches return 400.
- UI success comes only from reactive campaign state. Closing checkout or following a return link leaves an unconfirmed campaign inactive.

The sandbox charge represents `winnerCount * rewardUsdCents`, with zero DARE platform fee. Whop may separately display provider/buyer fees; the validated payment `total` excludes those buyer fees. Participant rewards are represented allocations, not transferred money. Sandbox payouts are unavailable.

## Verification

Run `npm test -- convex/whop`, `npm run typecheck`, and `npm run lint` after integrating TK's generated backend files. Unit tests exercise signed raw payloads, forged/stale signatures, cancelled/failed events, exact USD conversion, frozen binding mismatch and refund rejection. Integration tests exercise real Convex functions, Auth2 core-session fixtures and atomic payment writes, with only the external Whop HTTP responses mocked. They verify owner authorization, frozen checkout terms, duplicate delivery and failed-payment rejection. They do not test password hashing or claim a live Whop transaction.

For live verification, create a draft through an authenticated sponsor, open its returned `sandbox.whop.com/checkout/...` URL, and use test card `4242 4242 4242 4242` with a future expiry and any three-digit CVC. Confirm the signed webhook produces exactly one payment record and a reactive campaign activation. Replay the same event to verify no second activation. On a separate draft, close checkout without paying and verify it stays inactive. `4000 0000 0000 0002` is the sandbox declined-card test. Never use a production card or claim real payouts.

Source documentation: [sandbox](https://docs.whop.com/developer/guides/sandbox.md), [current quickstart](https://docs.whop.com/developer/quickstart.md), [webhooks](https://docs.whop.com/developer/guides/webhooks.md), [current API](https://docs.whop.com/api-reference/overview.md), [idempotency](https://docs.whop.com/developer/api/idempotency.md).
