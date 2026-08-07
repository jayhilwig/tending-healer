# Tending the Healer registration

A Next.js registration page for the Tending the Healer retreat.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Google Sheets registration setup

The form submits to `POST /api/registrations`, which validates the request on the server and appends one row to the `Registrations` tab. Google credentials are used only by the server route.

1. In Google Cloud, enable the Google Sheets API for the project used by the service account.
2. Create or select a service account and generate a JSON key.
3. Share the destination Google Sheet with the service account's `client_email` as an Editor.
4. Copy `.env.example` to `.env.local` and set:
   - `GOOGLE_SHEETS_CLIENT_EMAIL` to the service account's `client_email`.
   - `GOOGLE_SHEETS_PRIVATE_KEY` to its `private_key`. Keep the escaped `\n` characters when storing it on one line.
   - `GOOGLE_SHEETS_SPREADSHEET_ID` to the spreadsheet ID from its URL.
5. Confirm the Sheet contains a tab named `Registrations` with these headers in columns A–O:

   `Submitted At`, `First Name`, `Last Name`, `Email`, `Phone`, `Emergency Contact Name`, `Emergency Contact Phone`, `Tribal Member`, `Professional Role`, `Referral Source`, `Referral Details`, `Amount`, `Payment Status`, `Stripe Session ID`, `Stripe Payment ID`.

6. Run `npm run dev`, open `http://localhost:3000`, submit a valid registration, and confirm a new row appears in the Sheet.

Amounts are derived on the server: enrolled Tribal members are `$100`; all other registrations are `$195`. Until Stripe is added, new rows use `Pending` payment status and blank Stripe identifiers.
