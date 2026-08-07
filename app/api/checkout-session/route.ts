import { getRegistrationRow } from "../../../lib/google-sheets";
import { readRegistrationId } from "../../../lib/registration-id";
import { getStripe, StripeConfigurationError } from "../../../lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "registrationId")) {
    return Response.json({ error: "Unexpected checkout fields were submitted." }, { status: 400 });
  }

  const registrationId = typeof record.registrationId === "string" ? record.registrationId.trim() : "";

  try {
    const rowNumber = readRegistrationId(registrationId);
    if (!rowNumber) {
      return Response.json({ error: "Invalid registration identifier." }, { status: 400 });
    }

    const registration = await getRegistrationRow(rowNumber);
    if (!registration) {
      return Response.json({ error: "Registration not found." }, { status: 404 });
    }

    if (registration.paymentStatus === "Paid") {
      return Response.json({ error: "This registration has already been paid." }, { status: 409 });
    }

    const amountInCents = registration.tribal === "Yes" ? 10000 : 19500;
    const metadata = {
      registrationId,
      email: registration.email,
      firstName: registration.firstName,
      lastName: registration.lastName,
      tribalMember: registration.tribal,
    };
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      payment_method_types: ["card"],
      customer_email: registration.email,
      client_reference_id: registrationId,
      metadata,
      payment_intent_data: { metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: { name: "Tending the Healer registration" },
          },
        },
      ],
    });

    if (!session.client_secret) {
      throw new Error("Stripe did not return an Embedded Checkout client secret.");
    }

    return Response.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Embedded Checkout initialization failed:", error);

    if (error instanceof StripeConfigurationError || (error instanceof Error && error.message.includes("STRIPE_SECRET_KEY"))) {
      return Response.json({ error: "Stripe is not configured on the server." }, { status: 503 });
    }

    return Response.json({ error: "We couldn’t load secure payment. Please try again." }, { status: 500 });
  }
}
