import { appendRegistrationRow } from "../../../lib/google-sheets";
import { assertRegistrationIdConfiguration, createRegistrationId } from "../../../lib/registration-id";

export const runtime = "nodejs";

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

async function appendRegistration(registration: Registration) {
  const amount = registration.tribal === "Yes" ? 100 : 195;
  const role = registration.professionalRole === "Other" && registration.otherRole
    ? `Other: ${registration.otherRole}`
    : registration.professionalRole;

  return appendRegistrationRow([
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
  ]);
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
    assertRegistrationIdConfiguration();
    const rowNumber = await appendRegistration(validation.data);
    return Response.json({ success: true, registrationId: createRegistrationId(rowNumber) }, { status: 201 });
  } catch (error) {
    console.error("Registration submission failed:", error);
    return Response.json(
      { error: "We could not save your registration. Please try again." },
      { status: 500 },
    );
  }
}
