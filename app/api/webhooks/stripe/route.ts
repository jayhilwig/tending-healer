import Stripe from "stripe";

import { markRegistrationPaid } from "../../../../lib/google-sheets";
import { readRegistrationId } from "../../../../lib/registration-id";
import { getStripe, StripeConfigurationError } from "../../../../lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return Response.json({ error: "Stripe is not configured on the server." }, { status: 503 });
    }

    console.error("Stripe webhook signature verification failed:", error);
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true, ignored: true });
  }

  const session = event.data.object;
  const registrationId = session.metadata?.registrationId;
  if (!registrationId) {
    console.warn(`Stripe Checkout Session ${session.id} has no registration identifier.`);
    return Response.json({ received: true, ignored: true });
  }

  try {
    const rowNumber = readRegistrationId(registrationId);
    if (!rowNumber) {
      console.warn(`Stripe Checkout Session ${session.id} has an invalid registration identifier.`);
      return Response.json({ received: true, ignored: true });
    }

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? "";
    const result = await markRegistrationPaid(rowNumber, session.id, paymentIntentId);

    if (!result.found) {
      console.warn(`No Google Sheets registration was found for Stripe Checkout Session ${session.id}.`);
      return Response.json({ received: true, ignored: true });
    }

    return Response.json({ received: true, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    console.error("Stripe payment could not be written to Google Sheets:", error);
    return Response.json({ error: "Payment update failed." }, { status: 500 });
  }
}
