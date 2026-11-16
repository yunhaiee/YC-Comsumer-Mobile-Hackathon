# DARE: four-hour implementation contract

> This is the plan the team wrote at the start of the hackathon, before building. It's kept as a record of how the work was split up and what was decided. Some details, such as route paths, statuses, and "pending" notes, changed during implementation. See the [README](../README.md) for how the finished app works.

## Status

Foundation merged as PR #1 at bd46a66. YL (YCCO-3) and TK (YCCO-5) have agreed on the consumer function names and the upload-ticket boundary below; implementation is underway. TK confirmed the prediction/review policies and sponsor-configured winner counts. YL approved username/password auth and Whop delegation. SF (YCCO-4) now owns sponsor UI plus Revyl; YL's Subagent 1 owns only convex/whop/ and its tests. Do not mistake documentation for working integration.

## Confirmed product decisions

- Companies sponsor short-term challenges with a fixed performer prize. Company sponsorship is the central experience, not a friends-only game.
- Users participate or predict YES/NO. YES means at least one eligible participant completes the campaign's exact criteria by the deadline; NO means nobody does.
- Prediction activity changes prediction economics, never the fixed performer prize.
- Predictions use Sandbox USD. Users fund their balance through Whop sandbox checkout deposits (test cards only), credited solely by the verified webhook. No real money, withdrawals, or cash-out; winnings stay as in-app sandbox balance.
- Evidence is uploaded video; the company reviews it. No livestreaming or AI verification.
- Evidence is due by the dare deadline. TK confirmed a separate 24-hour company review window after that deadline. Settle only after all timely evidence is reviewed; unresolved campaigns void and refund at review timeout, never resolve NO merely because evidence is unreviewed.
- Once a user predicts on a campaign, they cannot switch into participating in that campaign.
- Expo Router + TypeScript live at the repository root. Convex is the persistent, reactive backend. Whop and Revyl must be meaningfully used.
- No maps, chat, social graph, video editing, real payouts, or unrelated premium paywall in this MVP.
- YL approves merges. No automatic merges.
- Pooled YES/NO predictions have no trading, early exits, or synthetic seed stakes. Winners divide the entire play-credit pool proportionally. Use deterministic largest-remainder integer allocation, breaking ties by stable position ID. If the winning side has no stake, refund every stake.
- Creators choose `winnerCount` and a fixed `rewardUsdCents` per winner before activation. Total prize commitment is their product. Earliest qualifying distinct participants win by server-recorded submission time, then stable ID; at most one award per participant. Unfilled prizes are not redistributed. YES requires at least one approved completion, not all prize slots filled.
- Prediction cutoff is at or before attempt start, which is before the evidence deadline. Joining closes at attempt start. Participant/predictor roles are mutually exclusive per campaign; sponsor reviewers cannot predict. Prediction side locks on first stake; same-side top-ups are allowed before cutoff.

## Recommended, not yet confirmed

1. Three authenticated demo accounts with real server-side participant/sponsor permissions. Approved implementation is Convex Auth v2 username/password with native SecureStore persistence. No client-side role selector or caller-supplied user ID as authorization. Do not mix Convex Auth v1 key-generation instructions with v2 component APIs.
2. Whop sandbox hosted checkout activates a sponsored campaign only after a verified webhook. Prize allocations are represented rewards, not escrow or completed payouts. Whop sandbox payouts are unavailable. Zero platform fee for the MVP; sponsor commitment is winnerCount × rewardUsdCents.
3. Primary physical demo phone platform, sandbox campaign pricing/platform fee, approved challenge templates, and evidence size/duration limits remain to be confirmed.

## File ownership

| Owner | Owns | Requests from others |
| --- | --- | --- |
| YL (integration) | `package.json`, lockfile, root configs, `app/_layout.tsx`, consumer `app/` routes, `providers/`, `lib/theme.ts`, shared `components/`, docs and CI | Backend/auth API changes from TK; sponsor/payment behavior from SF |
| TK (backend) | `convex/` except `convex/whop/`, generated Convex types, backend tests | Dependencies and client providers from YL; payment handler from SF |
| SF (sponsor UI/QA) | `app/sponsor/`, `components/sponsor/`, `.revyl/`, `tests/revyl/` | Schema/review APIs from TK; checkout API from Subagent 1; dependency/config/navigation edits from YL |
| YL Subagent 1 (Whop) | `convex/whop/` including payment tests | Schema and HTTP registration from TK; dependencies from YL |

There is one writer per path: SF does not edit `convex/whop/`, and Subagent 1 does not edit sponsor UI.

The foundation creates the initial empty schema before TK takes ownership. Nobody edits another owner's files without coordination. Only TK runs the shared Convex deployment watcher; SF hands over its module via PR. Do not deploy an older schema from a parallel branch. Share schema/API changes before implementing their consumers. Small module PRs integrate through YL, not simultaneous pushes to a shared branch.

## Routes

Only `/` and the root Stack exist in the foundation. Planned routes:

| Route | Owner | Purpose |
| --- | --- | --- |
| `/` | YL | Discover sponsored challenges |
| `/dare/[id]` | YL | Criteria, countdown, fixed reward, participation, prediction form |
| `/dare/[id]/submit` | YL | Pick/capture evidence, upload, see submission status |
| `/profile` | YL | Play-credit wallet, positions, resolved results |
| `/sign-in` | YL with TK auth | Authenticated demo access |
| `/sponsor` | SF | Campaign status, actual participation counts |
| `/sponsor/create` | SF | Approved-template campaign draft and checkout |
| `/sponsor/[id]` | SF | Review submitted videos and record decisions |

YL registers shared navigation; SF adds only sponsor routes. Root `app/` is deliberate; do not create a competing `src/app/` tree.

## Shared types and conventions

Use generated Convex `Id<"campaigns">`, `Id<"submissions">`, and `Id<"_storage">`; do not hand-write generated code. Prices/reward allocations use integer USD cents. Prediction balances, stakes, and payouts use integer minor units equal to Sandbox USD cents (100 units = $1.00); field names keep the `Units` suffix. Timestamps are UTC epoch milliseconds and enforced by server time. Derive actor identity from authenticated context, not arguments. Validate every input.

Campaign queries should return: `id`, `title`, `description`, `sponsorName`, `mediaUrl` (nullable), `criteria`, `winnerCount`, `rewardUsdCents` (per winner), `predictionClosesAt`, `attemptStartsAt`, `deadlineAt`, `reviewDeadlineAt`, `state`, `participantCount`, and `outcome` (null/YES/NO/VOID). Viewer-specific eligibility is separate from public campaign fields. Public queries must not expose raw payment payloads or private evidence.

Market state should expose `yesStakeUnits`, `noStakeUnits`, viewer stake/locked side, and server-computed eligibility. A quote returns `stakeUnits`, estimated gross payout, estimated net profit, maximum loss, and a clear variable-return label. There is no seeded liquidity. Empty pools show no sentiment estimate rather than invented odds. Pool split is sentiment, not a calibrated probability or fixed contract price.

### Agreed consumer function names (implementation pending)

| Convex function | Kind | Arguments | Result |
| --- | --- | --- | --- |
| `campaigns.list` | query | paginated feed options | paginated campaign summaries |
| `campaigns.get` | query | `{ campaignId }` | campaign plus viewer eligibility, or null |
| `campaigns.join` | mutation | `{ campaignId }` | participation ID; idempotent per user/campaign |
| `predictions.getMarket` | query | `{ campaignId }` | pool/market state plus viewer position |
| `predictions.quote` | query | `{ campaignId, side, stakeUnits }` | live estimate, no balance mutation |
| `predictions.place` | mutation | `{ campaignId, side, stakeUnits, requestId }` | recorded prediction and resulting balance |
| `submissions.generateUploadUrl` | mutation | `{ campaignId }` | `{ uploadUrl, uploadToken }` for a short-lived, single-use user/campaign-bound upload |
| `submissions.submit` | mutation | `{ campaignId, uploadToken, requestId }` | consumes the owned uploaded ticket; returns submission ID/status |
| `submissions.mine` | query | `{ campaignId }` | viewer's evidence and review status |
| `profiles.me` | query | `{}` | identity, credit balance, positions/results |

The upload is complete only when `submissions.submit` validates and records it before deadline; obtaining a URL before deadline does not bypass the cutoff. Authenticated, token-bound HTTP ingestion records the storage ID against its server-issued upload ticket. A client-supplied bare storage ID cannot prove ownership. Enforce token ownership/single use, allowed video types/size, role, and campaign eligibility. Client success must wait for server confirmation.

### Proposed sponsor and payment boundary

| Function | Owner/kind | Arguments/result |
| --- | --- | --- |
| `campaigns.createDraft` | TK mutation | Validated template, winnerCount, fixed per-winner reward/fee amounts and timestamps; returns campaign ID |
| `campaigns.listOwned` | TK query | Authenticated sponsor's campaigns and actual metrics |
| `submissions.listForReview` | TK query | Sponsor-authorized campaign evidence with playable URLs |
| `submissions.review` | TK mutation | `{ submissionId, decision, reason, requestId }`; records authorized approval/rejection |
| `whop/checkout.create` | SF action | `{ campaignId }`; returns sandbox checkout URL for server-authoritative price |
| `payments.activateCampaign` | TK internal mutation | `{ campaignId, providerCheckoutId, providerPaymentId, providerEventId, amountUsdCents, currency: "USD", sandbox: true }`; validates frozen checkout binding/terms and payment uniqueness, activates once |
| `/whop/webhook` | TK route, SF handler | Raw-body signature verification, event deduplication, then internal activation |
| `settlement.resolve` | TK internal mutation | Validated outcome, audited settlement/refund once; never exposed directly to clients |

SF implements the webhook handler in `convex/whop/`; TK registers it in `convex/http.ts`. Cross-owner imports/paths are confirmed together. Client redirects and checkout creation do not mark a campaign paid. Failed, cancelled, mismatched, duplicate, or forged payments must not activate it. Do not store or log secret credentials.

## Lifecycle

`draft -> awaiting_payment -> prediction_open -> attempts_open -> review_pending -> resolved`

`void` is an explicit terminal state with credit refunds. Transitions are server-side and deadline-checked on every write, not dependent solely on a scheduler firing on time. Price, criteria, and deadlines freeze before predictions open. Both late uploads and late predictions are rejected even if the UI countdown is stale. Review can record per-submission decisions; final campaign resolution waits until the confirmed winner/outcome policy is satisfied. Resolve NO only when no eligible completion exists under the agreed review policy.

## Ledger boundaries

- Sponsor sandbox payment: provider ID, amount/currency, platform-fee allocation, represented fixed reward allocation.
- Performer reward: separate award record tied to the qualifying submission; no actual transfer claim.
- No system market seed: the prediction pool is funded only by recorded play-credit stakes.
- User credit accounts: grants, stakes, settlements and refunds, all recorded once with idempotency keys.
- No field doubles as dollars and credits. Never finance real awards from user stakes. For a pooled model, never distribute more units than the funded pool; define and test rounding/remainder rules before settlement.

## Foundation and integration sequence

1. YL publishes this scaffold, lockfile, checks, and draft contract in a foundation PR.
2. TK confirms or revises API signatures in coordination with YL; YL approves the foundation merge. SF confirms checkout/HTTP boundaries with TK.
3. TK and SF start separate worktrees/branches from the merged baseline. YL owns dependency additions so lockfiles do not conflict.
4. TK deploys shared dev backend/auth. SF proves a Whop sandbox payment reaches it. YL wires consumer screens using generated APIs. SF starts a Revyl cloud build early and reports device/build blockers.
5. Integrate small PRs; rehearse two independent authenticated sessions and the physical phone. Freeze features for the last hour.

## Acceptance checks

- `npm ci`, typecheck, lint, and web export work on the foundation without service credentials.
- Feature readiness requires actual authenticated Convex persistence and reactive updates across two clients.
- Confirmed Whop sandbox payment activates exactly once. Cancelled checkout does not activate. Webhook signature and amount/currency/ownership are validated.
- Predictor cannot join; unauthorized user cannot review; no overdraft, duplicate stake, deadline bypass, duplicate settlement, or negative balance.
- Uploaded video persists and plays for its authorized reviewer. Acceptance/rejection and the final outcome are visible to the appropriate users.
- Fixed represented reward and prediction returns remain separate. Refresh/restart preserves balances.
- Revyl exercises the integrated flow and records evidence. Physical demo phone also works. A web screenshot or simulator build alone does not meet the phone-demo requirement.
- No fake success paths, undisclosed mock campaigns, or claims of real payouts.
