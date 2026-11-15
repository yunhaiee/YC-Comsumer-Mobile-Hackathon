# Hackathon log

- **Project:** DARE
- **What it does:** Mobile app where companies sponsor short video dares with fixed prizes and users predict YES/NO outcomes with Sandbox USD funded only by Whop sandbox test-card deposits.
- **Live app:** not deployed
- **Repo:** https://github.com/yunhaiee/YC-Comsumer-Mobile-Hackathon
- **Frontend:** not deployed
- **Convex deployment:** https://fastidious-gnat-814.convex.cloud
- **Components:** @convex-dev/auth (with its password and username components)
- **Convex features:** schema, indexes, queries, mutations, actions, HTTP actions, scheduled functions, file storage, realtime queries, paginated queries
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-11-15T20:49:19Z
- **Last updated:** 2026-11-15T22:40:34Z

## Log

### 2026-11-15 - bd46a66
Set up the Expo Router app shell, an optional Convex client provider, and an
empty Convex schema, plus the team's implementation contract in
`docs/DARE_PLAN.md` and CI for typecheck, lint, and web export. Convex features:
schema (`convex/schema.ts`, `providers/AppProviders.tsx`).

### 2026-11-15 - 9036ec7
Shipped the MVP. Users sign in with username and password through Convex Auth
v2. Sponsors create dares with a prize per winner and a winner count, and pay
for them through Whop sandbox checkout. A signed Whop webhook activates the dare
and also credits wallet deposits, and replayed payments are ignored. Users join
or predict YES/NO from a pooled market, and participants upload a video through
a single-use upload ticket. Sponsors review the videos, and settlement pays the
winning side by largest-remainder allocation or voids and refunds the dare.
Convex features: schema, indexes, queries, mutations, actions, HTTP actions,
scheduled functions, file storage, realtime and paginated queries
(`convex/schema.ts`, `convex/campaigns.ts`, `convex/predictions.ts`,
`convex/submissions.ts`, `convex/settlement.ts`, `convex/deposits.ts`,
`convex/http.ts`, `convex/whop/`, `convex/convex.config.ts`). Covered by
`convex-test` suites in `convex/backend.test.ts` and `convex/whop/*.test.ts`.
