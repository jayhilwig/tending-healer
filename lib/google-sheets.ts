import { createSign } from "node:crypto";

const SHEET_TAB = "Registrations";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type SavedRegistration = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  tribal: "Yes" | "No";
  paymentStatus: string;
  stripeSessionId: string;
  stripePaymentId: string;
};

function encodeBase64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getGoogleSheetsConfig() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Google Sheets environment variables are not configured.");
  }

  return { clientEmail, privateKey, spreadsheetId };
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

async function getAuthorizedSheet() {
  const config = getGoogleSheetsConfig();
  const accessToken = await getGoogleAccessToken(config.clientEmail, config.privateKey);
  return { accessToken, spreadsheetId: config.spreadsheetId };
}

export async function appendRegistrationRow(values: Array<string | number>) {
  const { accessToken, spreadsheetId } = await getAuthorizedSheet();
  const range = encodeURIComponent(`${SHEET_TAB}!A:O`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Google Sheets append failed with status ${response.status}.`);

  const result = (await response.json()) as { updates?: { updatedRange?: string } };
  const updatedRange = result.updates?.updatedRange ?? "";
  const rowMatch = updatedRange.match(/![A-Z]+(\d+):[A-Z]+\d+$/);
  const rowNumber = rowMatch ? Number(rowMatch[1]) : 0;

  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Google Sheets did not return the appended registration row.");
  }

  return rowNumber;
}

export async function getRegistrationRow(rowNumber: number): Promise<SavedRegistration | null> {
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) return null;

  const { accessToken, spreadsheetId } = await getAuthorizedSheet();
  const range = encodeURIComponent(`${SHEET_TAB}!A${rowNumber}:O${rowNumber}`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Google Sheets lookup failed with status ${response.status}.`);

  const result = (await response.json()) as { values?: string[][] };
  const row = result.values?.[0];
  if (!row) return null;

  const tribal = row[7];
  if (tribal !== "Yes" && tribal !== "No") {
    throw new Error("The saved registration has an invalid Tribal Member value.");
  }

  return {
    rowNumber,
    firstName: row[1] ?? "",
    lastName: row[2] ?? "",
    email: row[3] ?? "",
    tribal,
    paymentStatus: row[12] ?? "",
    stripeSessionId: row[13] ?? "",
    stripePaymentId: row[14] ?? "",
  };
}

export async function clearRegistrationRow(rowNumber: number) {
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Invalid registration row number.");
  }

  const { accessToken, spreadsheetId } = await getAuthorizedSheet();
  const range = encodeURIComponent(`${SHEET_TAB}!A${rowNumber}:O${rowNumber}`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Google Sheets clear failed with status ${response.status}.`);
}

export async function markRegistrationPaid(
  rowNumber: number,
  stripeSessionId: string,
  stripePaymentId: string,
) {
  const registration = await getRegistrationRow(rowNumber);
  if (!registration) return { found: false, alreadyProcessed: false };

  if (registration.paymentStatus === "Paid") {
    return { found: true, alreadyProcessed: true };
  }

  const { accessToken, spreadsheetId } = await getAuthorizedSheet();
  const range = encodeURIComponent(`${SHEET_TAB}!M${rowNumber}:O${rowNumber}`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [["Paid", stripeSessionId, stripePaymentId]] }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Google Sheets payment update failed with status ${response.status}.`);
  return { found: true, alreadyProcessed: false };
}
