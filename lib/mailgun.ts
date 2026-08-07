const MAILGUN_API_BASE = "https://api.mailgun.net/v3";
const FROM_ADDRESS = "Tending the Healer <kari@thresholdtherapist.com>";
const REPLY_TO_ADDRESS = "kari@thresholdtherapist.com";
const SUBJECT = "Registration confirmed — Tending the Healer";

type RegistrationConfirmation = {
  to: string;
  firstName: string;
  amountPaid: number;
  currency: string;
};

function getMailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();

  if (!apiKey || !domain) {
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN must be configured.");
  }

  return { apiKey, domain };
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function sendRegistrationConfirmation({
  to,
  firstName,
  amountPaid,
  currency,
}: RegistrationConfirmation) {
  const { apiKey, domain } = getMailgunConfig();
  const formattedAmount = formatAmount(amountPaid, currency);
  const safeFirstName = escapeHtml(firstName);

  const text = `Hi ${firstName},

We received your registration and payment of ${formattedAmount}. Your registration for Tending the Healer is confirmed.

Event details
Saturday, October 10, 2026
9:30am–4:00pm

House of Welcome Longhouse
The Evergreen State College
Olympia, WA

Additional retreat information will be sent closer to the event.

Cancellation policy
Cancellations received by October 3, 2026 are eligible for a refund. After October 3, registration fees are non-refundable. If you need to cancel or make a change to your registration, reply to this email or contact kari@thresholdtherapist.com.

Tending the Healer`;

  const html = `<p>Hi ${safeFirstName},</p>
<p>We received your registration and payment of <strong>${formattedAmount}</strong>. Your registration for <strong>Tending the Healer</strong> is confirmed.</p>
<p><strong>Event details</strong><br>
Saturday, October 10, 2026<br>
9:30am–4:00pm</p>
<p>House of Welcome Longhouse<br>
The Evergreen State College<br>
Olympia, WA</p>
<p>Additional retreat information will be sent closer to the event.</p>
<p><strong>Cancellation policy</strong><br>
Cancellations received by October 3, 2026 are eligible for a refund. After October 3, registration fees are non-refundable. If you need to cancel or make a change to your registration, reply to this email or contact <a href="mailto:kari@thresholdtherapist.com">kari@thresholdtherapist.com</a>.</p>
<p>Tending the Healer</p>`;

  const body = new URLSearchParams({
    from: FROM_ADDRESS,
    to,
    subject: SUBJECT,
    text,
    html,
    "h:Reply-To": REPLY_TO_ADDRESS,
  });

  const response = await fetch(
    `${MAILGUN_API_BASE}/${encodeURIComponent(domain)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Mailgun send failed with status ${response.status}: ${details}`);
  }
}
