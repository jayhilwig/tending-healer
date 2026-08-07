import Stripe from "stripe";

export class StripeConfigurationError extends Error {}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new StripeConfigurationError("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(secretKey, { typescript: true });
}
