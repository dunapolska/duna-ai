import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

const http = httpRouter();

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? "";

http.route({
  path: "/clerk/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!CLERK_WEBHOOK_SECRET) {
      return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
    }

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    try {
      const wh = new Webhook(CLERK_WEBHOOK_SECRET);
      const evt = wh.verify(payload, headers) as WebhookEvent;

      const eventType = evt.type as string;
      const data: any = evt.data;

      if (eventType === "user.created" || eventType === "user.updated") {
        console.log(`[Webhook] Processing ${eventType} event for user:`, data.id);
        
        const email = data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address
          ?? data.email_addresses?.[0]?.email_address
          ?? "";
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || email;
        const imageUrl = data.image_url as string | undefined;
        const clerkId = data.id as string;

        console.log(`[Webhook] User data - ID: ${clerkId}, Email: ${email}, Name: ${name}`);

        if (clerkId && email) {
          try {
            const userId = await ctx.runMutation(internal.users.upsert, {
              clerkId,
              email,
              name,
              imageUrl,
            });
            console.log(`[Webhook] Successfully ${eventType === "user.created" ? "created" : "updated"} user in database with ID: ${userId}`);
          } catch (error) {
            console.error(`[Webhook] Error ${eventType === "user.created" ? "creating" : "updating"} user:`, error);
            throw error;
          }
        } else {
          console.warn(`[Webhook] Skipping ${eventType} - missing clerkId or email. ClerkId: ${clerkId}, Email: ${email}`);
        }
      }

      return new Response("ok", { status: 200 });
    } catch (err) {
      console.error("Webhook verify error", err);
      return new Response("invalid", { status: 400 });
    }
  }),
});

export default http;


