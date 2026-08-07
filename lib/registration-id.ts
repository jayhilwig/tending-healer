import { createHmac, timingSafeEqual } from "node:crypto";

const IDENTIFIER_PREFIX = "registration";

function getSigningSecret() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return secret;
}

function signRowNumber(rowNumber: number) {
  return createHmac("sha256", getSigningSecret()).update(String(rowNumber)).digest("base64url");
}

export function assertRegistrationIdConfiguration() {
  getSigningSecret();
}

export function createRegistrationId(rowNumber: number) {
  return `${IDENTIFIER_PREFIX}_${rowNumber}.${signRowNumber(rowNumber)}`;
}

export function readRegistrationId(registrationId: string) {
  const match = registrationId.match(/^registration_(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!match) return null;

  const rowNumber = Number(match[1]);
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) return null;

  const providedSignature = Buffer.from(match[2], "utf8");
  const expectedSignature = Buffer.from(signRowNumber(rowNumber), "utf8");
  if (providedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  return rowNumber;
}
