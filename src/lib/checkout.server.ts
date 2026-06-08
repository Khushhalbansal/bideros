"use server";
import { createServerFn } from '@tanstack/react-start';
import Stripe from 'stripe';

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; email: string; origin: string; priceId: string; planType: 'single' | 'monthly' | 'yearly' }) => data)
  .handler(async ({ data }) => {
    const { userId, email, origin, priceId, planType } = data;

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      throw new Error('Stripe secret key not configured on the server');
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2025-01-27.acac' as any,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: planType === 'single' ? 'payment' : 'subscription',
      success_url: `${origin}/dashboard?checkout_success=true&plan=${planType}`,
      cancel_url: `${origin}/pricing?checkout_cancel=true`,
      metadata: {
        userId: userId,
        planType: planType,
      },
    });

    return { url: session.url };
  });
