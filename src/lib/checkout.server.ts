"use server";
import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      userId: string;
      email: string;
      origin: string;
      priceId: string;
      planType: "single" | "monthly" | "yearly";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { userId, email, origin, priceId, planType } = data;

    // Verify session user ID matches the requested user ID
    if (context.userId !== userId) {
      return { error: "Unauthorized: session user ID does not match request user ID" };
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return { error: "Stripe secret key not configured on the server" };
    }

    try {
      const stripe = new Stripe(stripeSecret, {
        apiVersion: "2025-01-27.acac" as any,
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        customer_email: email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: planType === "single" ? "payment" : "subscription",
        success_url: `${origin}/dashboard?checkout_success=true&plan=${planType}`,
        cancel_url: `${origin}/pricing?checkout_cancel=true`,
        metadata: {
          userId: userId,
          planType: planType,
        },
      });

      return { url: session.url };
    } catch (err: any) {
      return { error: err.message || "An error occurred during Stripe session creation" };
    }
  });
