import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config";
import password from "@convex-dev/auth/components/password/convex.config";
import username from "@convex-dev/auth/components/username/convex.config";

const app = defineApp({
  env: {
    WHOP_API_KEY: v.optional(v.string()),
    WHOP_WEBHOOK_SECRET: v.optional(v.string()),
    WHOP_ACCOUNT_ID: v.optional(v.string()),
    WHOP_CHECKOUT_RETURN_URL: v.optional(v.string()),
  },
});
app.use(auth);
app.use(password, { name: "authPassword" });
app.use(username, { name: "authUsername" });
export default app;
