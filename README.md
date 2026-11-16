# DARE

**Brands sponsor dares. You do them or bet on them.**

DARE is a mobile app for company-sponsored video challenges. A brand posts a dare with a fixed cash prize. Players either **take the dare** and upload video proof, or **predict** whether anyone will pull it off by betting YES or NO from a shared pool. The sponsor reviews the videos, the earliest approved performers win the prize, and correct predictors split the pool.

Built at the YC Consumer Mobile Hackathon with Expo Router, React Native, TypeScript, Convex, and Whop.

> **Sandbox only.** All money in DARE is Sandbox USD from Whop sandbox test-card payments. No real money moves, balances can't be withdrawn, and performer prizes are recorded but not paid out.

---

## How it works

### For sponsors
1. **Create a campaign** in the Sponsor studio. Pick a challenge template, choose how many winners there will be and the prize per winner, and set the prediction cutoff, attempt start, and evidence deadline.
2. **Pay with Whop sandbox checkout.** The campaign only goes live after Whop's signed webhook confirms the payment. A redirect or a closed checkout never activates it.
3. **Review evidence.** Watch submitted videos and approve or reject each one. You have 24 hours after the deadline to review.

### For players
- **Take the dare.** Join before attempts start, record or pick a video, and upload it before the deadline.
- **Predict.** Stake Sandbox USD on **YES** (at least one participant completes the dare) or **NO** (nobody does). Your side locks on your first stake, and you can top up on the same side until predictions close.
- **Fund your wallet** with a Whop sandbox test-card deposit ($5–$500). Your balance is credited only once the verified webhook arrives.

### Settlement
- **Prizes:** The earliest approved distinct participants win, up to the sponsor's winner count. Unfilled prizes are not redistributed.
- **Predictions:** Winners split the whole pool in proportion to their stake, using deterministic largest-remainder integer allocation. If nobody bet on the winning side, every stake is refunded.
- **Void:** If evidence is still unreviewed when the review window closes, the campaign is voided and every stake is refunded. It never resolves NO just because nobody reviewed.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| App | Expo SDK 58, Expo Router (typed routes), React Native 0.88, React 19, TypeScript |
| Backend | [Convex](https://convex.dev): schema, queries, mutations, actions, HTTP actions, scheduled functions, file storage, realtime and paginated queries |
| Auth | Convex Auth v2, username and password, with tokens stored in `expo-secure-store` on native |
| Payments | Whop sandbox checkout (`@whop/sdk`) with signed webhooks |
| Media | `expo-image-picker` for capture, `expo-video` for playback |
| Testing | Vitest + `convex-test` (113 backend tests) |

### Backend highlights
- **Verified payments.** The webhook checks the exact raw body's signature, then fetches the payment again from Whop's sandbox API and checks the account, checkout, variant, metadata, currency, and exact amount before crediting anything. Duplicate and replayed events are ignored.
- **Idempotent writes.** Stakes, deposits, reviews, and submissions each carry a request ID, so retries never double-charge or double-count.
- **Server-enforced deadlines.** Every write checks the deadline on the server, so a stale countdown on someone's phone can't get a late bet or upload through.
- **Secure evidence uploads.** Uploads use short-lived, single-use tickets tied to one user and one campaign. They're capped at 25 MiB, checked against MP4, QuickTime, and WebM magic bytes, and streamed back only to the campaign's sponsor.
- **Role separation.** Participants can't predict on a dare they've joined, predictors can't join one they've bet on, and sponsor accounts can't join or predict at all.

---

## Project structure

```
app/                      Expo Router screens
  (tabs)/                 Home feed, Wallet, Sponsor studio, Profile
    sponsor/              Campaign dashboard, create flow, evidence review
  dare/[id]/              Dare detail (join / predict) and evidence submission
  sign-in.tsx             Username and password auth
components/               Shared UI, dare cards and sheets, add-funds sheet, tab bar
convex/                   Backend: schema, campaigns, predictions, submissions,
                          settlement, deposits, payments, HTTP routes, tests
  whop/                   Whop sandbox checkout, deposits, webhook verification
hooks/                    Countdown and clock hooks
lib/                      Theme, formatting, campaign helpers, sponsor media
providers/                Convex + Convex Auth client provider
docs/DARE_PLAN.md         Original team implementation plan
```

---

## Running locally

**Requirements:** Node 24 (pinned in `.nvmrc`) and npm.

```sh
nvm install && nvm use      # optional, if you use nvm
npm ci
cp .env.example .env.local  # points the app at the team's Convex dev deployment
npm start
```

Press `w` to open the web build, or scan the QR code with an Expo Go build that supports SDK 58. Restart Expo after you change environment variables.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL (public) |
| `EXPO_PUBLIC_DARE_DEMO` | `.env.local` (optional) | Set to `1` to show the built-in sample sponsor dares on the home feed |
| `WHOP_API_KEY`, `WHOP_ACCOUNT_ID`, `WHOP_WEBHOOK_SECRET`, `WHOP_CHECKOUT_RETURN_URL` | Convex deployment environment | Whop sandbox credentials. Server-side only, never `EXPO_PUBLIC_*` |

See [convex/whop/README.md](convex/whop/README.md) for the full Whop sandbox setup and payment contract.

### Sponsor accounts

Sponsor access is granted on the server. Create an account in the app with a username that starts with `dare-demo-`, then run the internal `demo:provisionSponsor` mutation from the Convex dashboard with that account's user ID and username.

### Testing a payment

In Whop sandbox checkout, use card `4242 4242 4242 4242` with any future expiry date and any three-digit CVC. Card `4000 0000 0000 0002` simulates a decline.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run ios` / `android` / `web` | Start Expo for a specific platform |
| `npm test` | Run the Convex backend test suite |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run lint` | Lint with ESLint (`expo lint`) |
| `npm run export:web` | Produce a static web export |
| `npm run convex:dev` | Run the Convex dev deployment watcher |
| `npm run convex:ai` | Install Convex AI guidelines and agent skills |

CI ([.github/workflows/checks.yml](.github/workflows/checks.yml)) runs the typecheck, lint, and web export on every pull request and every push to `main`.
