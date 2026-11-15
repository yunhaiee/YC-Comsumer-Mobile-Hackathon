# DARE

Company-sponsored challenges, fixed performer prizes, and free-credit YES/NO predictions. Built with Expo Router, TypeScript, Convex, Whop sandbox, and Revyl.

This PR is the shared foundation, not a completed app. It contains one honest setup screen, an optional Convex client provider, and an empty schema. It does not create a hosted backend, authenticate users, accept payments, or implement markets.

## Local setup

Use Node 24 (`.nvmrc` pins the tested version) and npm. With nvm installed, run `nvm install && nvm use` first.

```sh
npm ci
cp .env.example .env.local
npm start
```

Press `w` for web, or scan the Expo QR code with an SDK-compatible Expo Go installation. A physical-phone run is still required before demo readiness. Native binaries and cloud-device checks belong to SF's Revyl workstream.

## Convex

TK provisions the team's shared development deployment with `npm run convex:dev`, then shares its public deployment URL with the team. Put that URL in `EXPO_PUBLIC_CONVEX_URL` in each checkout's ignored `.env.local`. Restart Expo after changing environment variables. Each person needs access to the same Convex project; do not provision three unrelated backends.

Only TK runs the schema/function deployment watcher during parallel development, after integrating SF's backend module. Other developers run the Expo client against the shared deployment. Never hand-write `convex/_generated` API/data-model files.

The app can display its foundation screen without a backend URL. Feature screens must gate backend hooks until configuration/authentication are available; this is not a local-data fallback.

```sh
npm run convex:ai
npm run typecheck
npm run lint
npm run export:web
```

The Convex AI installer must produce both `convex/_generated/ai/guidelines.md` and `.agents/skills`. Its exit code alone is not proof. Claude/Codex Convex plugins are machine-local setup, not something a repository clone installs.

## Foundation verification and limits

Clean `npm ci`, TypeScript, lint, and JavaScript exports for web/iOS/Android passed on the authoring Mac. Expo Doctor passed all 20 checks. These exports are not native binaries or device tests. Browser/native visual verification was unavailable because desktop access was disabled; Revyl and physical-phone checks remain outstanding.

The official Convex AI installer generated guidelines and skills successfully. Neither Claude Code nor Codex CLI was on PATH, so no machine-local Convex plugin was installed. No hosted Convex deployment or Whop credentials have been provisioned by the foundation.

`npm audit` currently reports eight moderate dependency findings through `minimatch` in Expo fingerprinting and TypeScript ESLint tooling. A non-breaking audit fix did not clear them; npm's proposed forced remediation downgrades Expo to SDK 52. The foundation keeps SDK 58 rather than applying that incompatible downgrade. Revisit upstream fixes before a production launch.

## Service credentials

- Only the Convex deployment URL is public mobile configuration.
- SF configures Whop sandbox API/webhook secrets in the Convex deployment's server environment, never `EXPO_PUBLIC_*` variables.
- Each person's local environment and account access are separate from the shared source code. Never commit `.env` files or paste keys into chat.

## Team contract

Read [docs/DARE_PLAN.md](docs/DARE_PLAN.md) for ownership, proposed APIs, sequencing, and outstanding product decisions. The foundation PR must be merged with YL's approval before module threads start coding from it.
