/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as campaigns from "../campaigns.js";
import type * as demo from "../demo.js";
import type * as http from "../http.js";
import type * as model from "../model.js";
import type * as payments from "../payments.js";
import type * as predictions from "../predictions.js";
import type * as profiles from "../profiles.js";
import type * as settlement from "../settlement.js";
import type * as submissions from "../submissions.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as whop_checkout from "../whop/checkout.js";
import type * as whop_client from "../whop/client.js";
import type * as whop_events from "../whop/events.js";
import type * as whop_validation from "../whop/validation.js";
import type * as whop_webhook from "../whop/webhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  campaigns: typeof campaigns;
  demo: typeof demo;
  http: typeof http;
  model: typeof model;
  payments: typeof payments;
  predictions: typeof predictions;
  profiles: typeof profiles;
  settlement: typeof settlement;
  submissions: typeof submissions;
  users: typeof users;
  validators: typeof validators;
  "whop/checkout": typeof whop_checkout;
  "whop/client": typeof whop_client;
  "whop/events": typeof whop_events;
  "whop/validation": typeof whop_validation;
  "whop/webhook": typeof whop_webhook;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
