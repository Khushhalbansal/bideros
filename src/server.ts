import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { supabaseAdmin } from "./integrations/supabase/client.server";
import Stripe from "stripe";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

async function handleStripeWebhook(request: Request): Promise<Response> {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecret || !webhookSecret) {
      console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET env variables.");
      return new Response("Stripe keys not configured", { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acac" as any,
    });

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const rawBody = await request.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed:`, err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Received Stripe Webhook Event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const endDate = new Date(subscription.current_period_end * 1000).toISOString();

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_tier: "premium",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_end_date: endDate,
            })
            .eq("id", userId);

          if (error) {
            console.error(`Failed to update profile for user ${userId}:`, error);
            return new Response(`Database update error`, { status: 500 });
          }
          console.log(`Successfully upgraded user ${userId} to premium`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const endDate = new Date(subscription.current_period_end * 1000).toISOString();
        const isCancelled = subscription.status === "canceled" || subscription.cancel_at_period_end;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: isCancelled && subscription.status === "canceled" ? "free" : "premium",
            subscription_end_date: endDate,
          })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error(`Failed to update subscription for customer ${customerId}:`, error);
          return new Response(`Database update error`, { status: 500 });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: "free",
            stripe_subscription_id: null,
            subscription_end_date: null,
          })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error(`Failed to delete subscription for customer ${customerId}:`, error);
          return new Response(`Database update error`, { status: 500 });
        }
        console.log(`Successfully downgraded customer ${customerId} to free tier`);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook handler failed:", err);
    return new Response(`Handler Error: ${err.message}`, { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/webhook" && request.method === "POST") {
        return await handleStripeWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
