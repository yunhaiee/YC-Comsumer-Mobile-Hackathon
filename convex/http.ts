import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { LIMITS } from "./model";
import { ALLOWED_TYPES } from "./submissions";

const http = httpRouter();
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
http.route({
  path: "/evidence/upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers })),
});
http.route({
  path: "/evidence/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const respond = (status: number, body: object) =>
      Response.json(body, { status, headers });
    if (!request.headers.get("Authorization")?.startsWith("Bearer "))
      return respond(401, { error: "Sign in required" });
    const uploadToken = new URL(request.url).searchParams.get("uploadToken");
    const type = request.headers.get("Content-Type")?.split(";")[0].trim();
    if (!uploadToken || !type || !ALLOWED_TYPES.includes(type))
      return respond(400, {
        error: "A ticket and supported video content type are required",
      });
    const length = Number(request.headers.get("Content-Length"));
    if (length > LIMITS.uploadBytes)
      return respond(413, { error: "Video exceeds 25 MiB" });
    let storageId: Id<"_storage"> | null = null;
    try {
      const ticketId: Id<"uploadTickets"> = await ctx.runMutation(
        internal.submissions.claimUpload,
        { uploadToken },
      );
      const reader = request.body?.getReader();
      if (!reader) return respond(400, { error: "Video body required" });
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > LIMITS.uploadBytes) {
          await reader.cancel();
          return respond(413, { error: "Video exceeds 25 MiB" });
        }
        chunks.push(new Uint8Array(next.value));
      }
      if (!size) return respond(400, { error: "Video body required" });
      const blob = new Blob(chunks, { type });
      const magic = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
      const validType =
        type === "video/webm"
          ? magic[0] === 0x1a &&
            magic[1] === 0x45 &&
            magic[2] === 0xdf &&
            magic[3] === 0xa3
          : String.fromCharCode(...magic.slice(4, 8)) === "ftyp";
      if (!validType)
        return respond(415, { error: "Unsupported video container" });
      storageId = await ctx.storage.store(blob);
      const accepted: boolean = await ctx.runMutation(
        internal.submissions.finishUpload,
        { ticketId, storageId },
      );
      if (!accepted) {
        storageId = null;
        return respond(409, { error: "Ticket expired or upload already used" });
      }
      storageId = null;
      return respond(200, { uploadToken, uploaded: true });
    } catch {
      if (storageId) await ctx.storage.delete(storageId);
      return respond(400, {
        error: "Upload rejected; check session, ticket, and deadline",
      });
    }
  }),
});
export default http;
