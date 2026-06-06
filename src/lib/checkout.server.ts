import { createServerFn } from '@tanstack/react-start';
import Stripe from 'stripe';

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; email: string; origin: string }) => data)
  .handler(async ({ data }) => {
    const { userId, email, origin } = data;

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
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bideros Premium Pro',
              description: 'Unlock unlimited cricket auctions, premium stadium-grade views, and unlimited teams.',
            },
            unit_amount: 900, // $9.00 USD
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/dashboard?checkout_success=true`,
      cancel_url: `${origin}/dashboard?checkout_cancel=true`,
      metadata: {
        userId: userId,
      },
    });

    return { url: session.url };
  });
