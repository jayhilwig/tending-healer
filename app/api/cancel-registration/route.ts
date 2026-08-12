import { clearRegistrationRow, getRegistrationRow } from "../../../lib/google-sheets";
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
    return Response.json({ error: "Invalid cancellation request." }, { status: 400 });
  }

  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["registrationId", "checkoutSessionId"].includes(key))) {
    return Response.json({ error: "Unexpected cancellation fields were submitted." }, { status: 400 });
  }

  const registrationId = typeof record.registrationId === "string" ? record.registrationId.trim() : "";
  const checkoutSessionId = typeof record.checkoutSessionId === "string" ? record.checkoutSessionId.trim() : "";
  const rowNumber = readRegistrationId(registrationId);

  if (!rowNumber || !checkoutSessionId.startsWith("cs_")) {
    return Response.json({ error: "Invalid cancellation request." }, { status: 400 });
  }

  try {
    const registration = await getRegistrationRow(rowNumber);
    if (!registration) {
      return Response.json({ success: true });
    }
    if (registration.paymentStatus === "Paid") {
      return Response.json({ error: "Paid registrations cannot be cancelled here." }, { status: 409 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (session.metadata?.registrationId !== registrationId || session.client_reference_id !== registrationId) {
      return Response.json({ error: "The payment session does not match this registration." }, { status: 403 });
    }
    if (session.payment_status === "paid" || session.status === "complete") {
      return Response.json({ error: "Paid registrations cannot be cancelled here." }, { status: 409 });
    }
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(checkoutSessionId);
    }

    const latestRegistration = await getRegistrationRow(rowNumber);
    if (latestRegistration?.paymentStatus === "Paid") {
      return Response.json({ error: "Paid registrations cannot be cancelled here." }, { status: 409 });
    }

    await clearRegistrationRow(rowNumber);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Registration cancellation failed:", error);
    if (error instanceof StripeConfigurationError) {
      return Response.json({ error: "Stripe is not configured on the server." }, { status: 503 });
    }
    return Response.json({ error: "We could not cancel your registration. Please try again." }, { status: 500 });
  }
}
