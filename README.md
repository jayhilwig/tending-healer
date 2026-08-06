# Tending the Healer — visual registration prototype

A visual-only Next.js pass for the registration page planned for `thresholdtherapist.com`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current scope

- Updated flyer-inspired visual system
- Cormorant headings and Assistant body/UI text
- Responsive custom registration form
- Exact circular Medicine Wheel and facilitator portraits
- Stripe payment placeholder
- Google Sheets integration intentionally not connected yet

## Next implementation pass

1. Add client-side validation.
2. Create a server endpoint for registration intake.
3. Add Stripe Embedded Checkout.
4. Confirm payment through a Stripe webhook.
5. Append only paid registrations to Google Sheets.
6. Add confirmation email and success state.

The form and payment controls in this package are intentionally non-functional for the visual review.
