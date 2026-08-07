import { createSign } from "node:crypto";

export const runtime = "nodejs";

const SHEET_TAB = "Registrations";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const professionalRoles = [
  "Doctor",
  "NP",
  "PA",
  "RN",
  "CNA",
  "Social Worker",
  "PT/OT",
  "Professional Caregiver",
  "Other",
] as const;

const referralSources = [
  "Colleague",
  "Friend or family",
  "Other",
  "Social media",
  "Web search",
] as const;

const allowedFields = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "emergencyName",
  "emergencyPhone",
  "tribal",
  "professionalRole",
  "otherRole",
  "referralSource",
  "referralDetails",
]);

type Registration = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  tribal: "Yes" | "No";
  professionalRole: (typeof professionalRoles)[number];
  otherRole: string;
  referralSource: (typeof referralSources)[number];
  referralDetails: string;
};

type ValidationResult =
  | { success: true; data: Registration }
  | { success: false; fieldErrors: Record<string, string> };

function validateRegistration(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, fieldErrors: { form: "Invalid registration data." } };
  }

  const record = input as Record<string, unknown>;
  const unknownFields = Object.keys(record).filter((key) => !allowedFields.has(key));
  if (unknownFields.length > 0) {
    return { success: false, fieldErrors: { form: "Unexpected registration fields were submitted." } };
  }

  const fieldErrors: Record<string, string> = {};
  const readString = (name: string, maxLength: number) => {
    const value = record[name];
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      fieldErrors[name] = "Must be text.";
      return "";
    }

    const trimmed = value.trim();
    if (trimmed.length > maxLength) fieldErrors[name] = `Must be ${maxLength} characters or fewer.`;
    return trimmed;
  };

  const firstName = readString("firstName", 80);
  const lastName = readString("lastName", 80);
  const email = readString("email", 254);
  const phone = readString("phone", 32);
  const emergencyName = readString("emergencyName", 120);
  const emergencyPhone = readString("emergencyPhone", 32);
  const tribal = readString("tribal", 3);
  const professionalRole = readString("professionalRole", 40);
  const otherRole = readString("otherRole", 120);
  const referralSource = readString("referralSource", 40);
  const referralDetails = readString("referralDetails", 200);

  const requiredFields = { firstName, lastName, email, phone, emergencyName, emergencyPhone, tribal, professionalRole, referralSource };
  for (const [name, value] of Object.entries(requiredFields)) {
    if (!value && !fieldErrors[name]) fieldErrors[name] = "This field is required.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

  if (email && !emailPattern.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (phone && !phonePattern.test(phone)) fieldErrors.phone = "Enter a valid 10-digit phone number.";
  if (emergencyPhone && !phonePattern.test(emergencyPhone)) fieldErrors.emergencyPhone = "Enter a valid 10-digit phone number.";
  if (tribal && tribal !== "Yes" && tribal !== "No") fieldErrors.tribal = "Select Yes or No.";
  if (professionalRole && !professionalRoles.includes(professionalRole as (typeof professionalRoles)[number])) {
    fieldErrors.professionalRole = "Select a valid professional role.";
  }
  if (referralSource && !referralSources.includes(referralSource as (typeof referralSources)[number])) {
    fieldErrors.referralSource = "Select a valid referral source.";
  }
  if (professionalRole !== "Other" && otherRole) fieldErrors.otherRole = "Other role details are only allowed when Other is selected.";
  if (referralSource !== "Other" && referralDetails) fieldErrors.referralDetails = "Referral details are only allowed when Other is selected.";

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };

  return {
    success: true,
    data: {
      firstName,
      lastName,
      email,
      phone,
      emergencyName,
      emergencyPhone,
      tribal: tribal as Registration["tribal"],
      professionalRole: professionalRole as Registration["professionalRole"],
      otherRole,
      referralSource: referralSource as Registration["referralSource"],
      referralDetails,
    },
  };
}

function encodeBase64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url({ alg: "RS256", typ: "JWT" });
  const payload = encodeBase64Url({
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey).toString("base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Google authentication failed with status ${response.status}.`);
  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token) throw new Error("Google authentication returned no access token.");
  return result.access_token;
}

async function appendRegistration(registration: Registration) {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Google Sheets environment variables are not configured.");
  }

  const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
  const amount = registration.tribal === "Yes" ? 100 : 195;
  const role = registration.professionalRole === "Other" && registration.otherRole
    ? `Other: ${registration.otherRole}`
    : registration.professionalRole;
  const range = encodeURIComponent(`${SHEET_TAB}!A:O`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [[
          new Date().toISOString(),
          registration.firstName,
          registration.lastName,
          registration.email,
          registration.phone,
          registration.emergencyName,
          registration.emergencyPhone,
          registration.tribal,
          role,
          registration.referralSource,
          registration.referralDetails,
          amount,
          "Pending",
          "",
          "",
        ]],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Google Sheets append failed with status ${response.status}.`);
}

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const validation = validateRegistration(input);
  if (!validation.success) {
    return Response.json(
      { error: "Please correct the highlighted fields.", fieldErrors: validation.fieldErrors },
      { status: 400 },
    );
  }

  try {
    await appendRegistration(validation.data);
    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Registration submission failed:", error);
    return Response.json(
      { error: "We could not save your registration. Please try again." },
      { status: 500 },
    );
  }
}
