"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type FormEventHandler } from "react";

const requiredMessage = "This field is required.";
const phonePattern = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegistrationFlowState =
  | "editing"
  | "submitting"
  | "detailsSaved"
  | "paymentLoading"
  | "paymentReady"
  | "paymentComplete"
  | "error";

type ErrorContext = "registration" | "payment" | null;

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const handlePhoneInput: FormEventHandler<HTMLInputElement> = (event) => {
  event.currentTarget.value = formatPhoneNumber(event.currentTarget.value);
};

function validateFormData(formData: FormData) {
  const errors: Record<string, string> = {};
  const requiredFields = [
    "firstName",
    "lastName",
    "phone",
    "email",
    "emergencyName",
    "emergencyPhone",
    "tribal",
    "professionalRole",
    "referralSource",
  ];

  requiredFields.forEach((name) => {
    if (!String(formData.get(name) ?? "").trim()) {
      errors[name] = requiredMessage;
    }
  });

  const phone = String(formData.get("phone") ?? "").trim();
  const emergencyPhone = String(formData.get("emergencyPhone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (phone && !phonePattern.test(phone)) {
    errors.phone = "Enter a valid 10-digit phone number.";
  }

  if (emergencyPhone && !phonePattern.test(emergencyPhone)) {
    errors.emergencyPhone = "Enter a valid 10-digit phone number.";
  }

  if (email && !emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

const eventDetails = [
  ["Saturday, October 10, 2026", "calendar"],
  ["9:30am – 4:00pm", "clock"],
  ["House of Welcome Longhouse, The Evergreen State College, Olympia, WA", "pin"],
  ["$195 per person · $100 for enrolled Tribal members", "dollar"],
  ["Beverages and light refreshments will be provided. Please bring your own lunch or purchase lunch at The Evergreen State College cafeteria.", "cookie"],
] as const;

function MedicineWheel() {
  return (
    <div className="wheel-frame" aria-label="Medicine Wheel illustration">
      <img src="/medicine-wheel.png" alt="Watercolor medicine wheel" />
    </div>
  );
}

function Icon({ type }: { type: string }) {
  const iconSources: Record<string, string> = {
    calendar: "/icons/calendar-days.svg",
    clock: "/icons/clock.svg",
    pin: "/icons/map-pin.svg",
    dollar: "/icons/dollar-sign.svg",
    cookie: "/icons/cookie.svg",
  };

  return (
    <span className="detail-icon" aria-hidden="true">
      <img src={iconSources[type]} alt="" />
    </span>
  );
}

function StripePayment({ clientSecret, onComplete }: { clientSecret: string; onComplete: () => void }) {
  const options = useMemo(() => ({ clientSecret, onComplete }), [clientSecret, onComplete]);

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}

export default function Home() {
  const [professionalRole, setProfessionalRole] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flowState, setFlowState] = useState<RegistrationFlowState>("editing");
  const [errorContext, setErrorContext] = useState<ErrorContext>(null);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [editNotice, setEditNotice] = useState("");
  const [isEditingSavedDetails, setIsEditingSavedDetails] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [registrationId, setRegistrationId] = useState("");
  const [checkoutClientSecret, setCheckoutClientSecret] = useState("");
  const [paymentAttempt, setPaymentAttempt] = useState(0);
  const submittingRef = useRef(false);
  const registrationSavedRef = useRef(false);

  const paymentHasStarted =
    flowState === "detailsSaved" ||
    flowState === "paymentLoading" ||
    flowState === "paymentReady" ||
    flowState === "paymentComplete" ||
    (flowState === "error" && errorContext === "payment");
  const formLocked = registrationSavedRef.current && !isEditingSavedDetails;

  useEffect(() => {
    if (!registrationId) return;

    if (!stripePromise) {
      setErrorContext("payment");
      setFlowState("error");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function initializePayment() {
      setCheckoutClientSecret("");
      setErrorContext(null);
      setFlowState("paymentLoading");

      try {
        const response = await fetch("/api/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId }),
          signal: controller.signal,
        });
        const result = (await response.json()) as { clientSecret?: string; error?: string };

        if (!response.ok || !result.clientSecret) {
          throw new Error(result.error ?? "Stripe did not return a client secret.");
        }

        if (!cancelled) {
          setCheckoutClientSecret(result.clientSecret);
          setFlowState("paymentReady");
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setErrorContext("payment");
        setFlowState("error");
      }
    }

    initializePayment();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [registrationId, paymentAttempt]);

  const handleFormValidityChange: FormEventHandler<HTMLFormElement> = (event) => {
    if (registrationSavedRef.current) return;
    setIsFormValid(Object.keys(validateFormData(new FormData(event.currentTarget))).length === 0);
  };

  function retryPayment() {
    setErrorContext(null);
    setFlowState("paymentLoading");
    setPaymentAttempt((attempt) => attempt + 1);
  }

  const handlePaymentComplete = useCallback(() => {
    setFlowState("paymentComplete");
  }, []);

  function handleEditRegistrationDetails() {
    // Future payment integration: replace local review with a row-update flow, never a second registration POST.
    setIsEditingSavedDetails(true);
    setEditNotice("You can review your details here. Changes are not saved to the existing registration yet.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || registrationSavedRef.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextErrors = validateFormData(formData);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setErrorContext("registration");
      setFlowState("error");
      setSubmissionMessage("Please correct the highlighted fields and try again.");
      return;
    }

    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      emergencyName: String(formData.get("emergencyName") ?? ""),
      emergencyPhone: String(formData.get("emergencyPhone") ?? ""),
      tribal: String(formData.get("tribal") ?? ""),
      professionalRole: String(formData.get("professionalRole") ?? ""),
      otherRole: String(formData.get("otherRole") ?? ""),
      referralSource: String(formData.get("referralSource") ?? ""),
      referralDetails: String(formData.get("referralDetails") ?? ""),
    };

    submittingRef.current = true;
    setErrorContext(null);
    setFlowState("submitting");
    setSubmissionMessage("");

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
        registrationId?: string;
      };

      if (!response.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setErrorContext("registration");
        setFlowState("error");
        setSubmissionMessage(result.error ?? "We could not save your registration. Please try again.");
        return;
      }

      registrationSavedRef.current = true;
      setErrors({});
      setErrorContext(null);
      setSubmissionMessage("Your details have been saved. Complete payment to finish your registration.");

      if (!result.registrationId) {
        setErrorContext("payment");
        setFlowState("error");
        return;
      }

      setRegistrationId(result.registrationId);
      setFlowState("detailsSaved");
    } catch {
      setErrorContext("registration");
      setFlowState("error");
      setSubmissionMessage("We could not reach the registration service. Please check your connection and try again.");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <main>
      <header className="site-header">
        <div className="header-brand-group">
          <a href="https://thresholdtherapist.com/" className="brand">Threshold Therapy &amp; Consulting</a>
          <span>Sweetgrass &amp; Sage Counseling</span>
        </div>
        <a href="mailto:thresholdtherapeutic@gmail.com" className="header-link">Contact us</a>
      </header>

      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">A retreat for healthcare professionals</p>
          <h1>Tending<br />the Healer</h1>
          <div className="ornament" />
          <p className="hero-intro">
            A restorative day for healthcare professionals to slow down, reconnect, and gently tend to the grief and invisible burdens carried through caregiving work.
          </p>
        </div>
        <MedicineWheel />
      </section>

      <section className="overview shell">
        <div className="overview-copy">
          <h2>A place to care for what you carry</h2>
          <p>
            Healthcare professionals witness loss, suffering, and profound moments of humanity every day. This retreat offers dedicated space for reflection, connection, and renewal.
          </p>
          <p>
            Through guided discussion, meaningful ritual, community, and Indigenous teachings rooted in the Medicine Wheel, participants will honor their experiences and reconnect with inner resilience.
          </p>
          <p>
            Held at the House of Welcome Longhouse, the retreat welcomes healthcare professionals from all disciplines and backgrounds. No prior experience with Indigenous teachings or mindfulness is needed.
          </p>
        </div>

        <aside className="details-card">
          <p className="section-kicker">Retreat details</p>
          <div className="detail-list">
            {eventDetails.map(([text, icon]) => (
              <div className="detail-row" key={text}>
                <Icon type={icon} />
                {icon === "pin" ? (
                  <a href="https://www.google.com/maps/search/?api=1&query=House%20of%20Welcome%20Longhouse%20The%20Evergreen%20State%20College%20Olympia%20WA" target="_blank" rel="noreferrer">{text}</a>
                ) : icon === "cookie" ? (
                  <span>
                    <strong>Lunch &amp; refreshments</strong><br />
                    Beverages and light refreshments will be provided. Please bring your own lunch or purchase lunch at{" "}
                    <a href="https://www.evergreen.edu/student-life/dining" target="_blank" rel="noreferrer">
                      The Evergreen State College cafeteria
                    </a>.
                  </span>
                ) : (
                  <span>{text}</span>
                )}
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="facilitators shell">
        <div className="section-heading">
          <span />
          <h2>Facilitators</h2>
          <span />
        </div>
        <div className="facilitator-grid">
          <article className="facilitator-card">
            <img src="/akasha.webp" alt="Akasha Balkman" />
            <div>
              <h3>Akasha Balkman, LICSW</h3>
              <p>
                Licensed Clinical Social Worker, Pediatric Palliative Care Specialist at Seattle Children&apos;s Hospital, founder of Sweetgrass &amp; Sage Counseling, and co-founder of Hello Angel. An enrolled member of the Yankton Sioux Tribe, she integrates Indigenous teachings and the Medicine Wheel into her work.
              </p>
            </div>
          </article>
          <article className="facilitator-card">
            <img src="/kari.webp" alt="Kari Hilwig" />
            <div>
              <h3>Kari Hilwig, LICSW</h3>
              <p>
                Licensed Clinical Social Worker and psychotherapist specializing in serious and chronic illness, grief and loss, and caregiver support. Her background in palliative care and oncology informs a relational, existential, and strengths-based approach.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="registration-wrap" id="register">
        <div className="shell registration-layout">
          <div className="registration-card">
            <p className="section-kicker">Registration</p>
            <h2>Reserve your place</h2>
            <p className="form-intro">Complete the form below. Payment will be collected securely after you continue.</p>

            <form className="visual-form" noValidate onSubmit={handleSubmit} onInput={handleFormValidityChange} onChange={handleFormValidityChange}>
              <div className="form-grid">
                <label>First name <span>*</span><input name="firstName" disabled={formLocked} aria-invalid={Boolean(errors.firstName)} />{errors.firstName && <small className="field-error">{errors.firstName}</small>}</label>
                <label>Last name <span>*</span><input name="lastName" disabled={formLocked} aria-invalid={Boolean(errors.lastName)} />{errors.lastName && <small className="field-error">{errors.lastName}</small>}</label>
                <label>Phone number <span>*</span><input name="phone" type="tel" inputMode="tel" disabled={formLocked} onInput={handlePhoneInput} aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="field-error">{errors.phone}</small>}</label>
                <label>Email address <span>*</span><input name="email" type="email" disabled={formLocked} aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email}</small>}</label>
                <label>Emergency contact name <span>*</span><input name="emergencyName" disabled={formLocked} aria-invalid={Boolean(errors.emergencyName)} />{errors.emergencyName && <small className="field-error">{errors.emergencyName}</small>}</label>
                <label>Emergency contact phone <span>*</span><input name="emergencyPhone" type="tel" inputMode="tel" disabled={formLocked} onInput={handlePhoneInput} aria-invalid={Boolean(errors.emergencyPhone)} />{errors.emergencyPhone && <small className="field-error">{errors.emergencyPhone}</small>}</label>
              </div>

              <fieldset>
                <legend>Are you an enrolled Tribal member? <span>*</span></legend>
                <div className="choice-row">
                  <label className="choice"><input type="radio" name="tribal" value="Yes" disabled={formLocked} /> Yes</label>
                  <label className="choice"><input type="radio" name="tribal" value="No" disabled={formLocked} /> No</label>
                </div>
                {errors.tribal && <small className="field-error">{errors.tribal}</small>}
              </fieldset>

              <fieldset>
                <legend>What is your professional role? <span>*</span></legend>
                <div className="choice-grid">
                  {["Doctor", "NP", "PA", "RN", "CNA", "Social Worker", "PT/OT", "Professional Caregiver", "Other"].map((role) => (
                    <label className="choice" key={role}>
                      <input type="radio" name="professionalRole" value={role} disabled={formLocked} checked={professionalRole === role} onChange={(event) => setProfessionalRole(event.target.value)} /> {role}
                    </label>
                  ))}
                </div>
                {errors.professionalRole && <small className="field-error">{errors.professionalRole}</small>}
                {professionalRole === "Other" && (
                  <label className="other-role-field">Other role<input name="otherRole" disabled={formLocked} aria-invalid={Boolean(errors.otherRole)} />{errors.otherRole && <small className="field-error">{errors.otherRole}</small>}</label>
                )}
              </fieldset>

              <label>How did you hear about this event? <span>*</span>
                <select name="referralSource" disabled={formLocked} defaultValue="" onChange={(event) => setReferralSource(event.target.value)} aria-invalid={Boolean(errors.referralSource)}><option value="" disabled>Select one</option><option value="Colleague">Colleague</option><option value="Friend or family">Friend or family</option><option value="Other">Other</option><option value="Social media">Social media</option><option value="Web search">Web search</option></select>
                {errors.referralSource && <small className="field-error">{errors.referralSource}</small>}
              </label>
              {referralSource === "Other" && (
                <label>Referral details <input name="referralDetails" disabled={formLocked} aria-invalid={Boolean(errors.referralDetails)} />{errors.referralDetails && <small className="field-error">{errors.referralDetails}</small>}</label>
              )}

              {!paymentHasStarted && (
                <button type="submit" disabled={!isFormValid || flowState === "submitting"} aria-busy={flowState === "submitting"}>
                  {flowState === "submitting" ? <><span className="loading-spinner" aria-hidden="true" />Saving your details…</> : "Continue to secure payment"}
                </button>
              )}
              <div className="submission-status" aria-live="polite" aria-atomic="true">
                {paymentHasStarted ? (
                  <>
                    <p className="submission-message success">
                      {flowState === "paymentComplete"
                        ? "Payment complete. Your registration is confirmed."
                        : "Your details have been saved. Complete payment to finish your registration."}
                    </p>
                    {flowState === "paymentReady" && (
                      <button type="button" className="edit-details-action" onClick={handleEditRegistrationDetails}>Edit registration details</button>
                    )}
                    {editNotice && <p className="edit-notice">{editNotice}</p>}
                  </>
                ) : submissionMessage ? (
                  <p className={`submission-message ${flowState}`} role={flowState === "error" ? "alert" : "status"}>{submissionMessage}</p>
                ) : (
                  <p className="prototype-note">Complete all required fields to continue.</p>
                )}
              </div>
            </form>
          </div>

          <aside className="payment-card">
            <div className="botanical-mark" aria-hidden="true">
              <img src="/hummingbird.webp" alt="" />
            </div>
            <p className="price-main">$195 <small>per person</small></p>
            <p className="price-alt">$100 for enrolled Tribal members</p>
            <div className="payment-divider" />
            <div className="payment-status" aria-live="polite" aria-atomic="true" aria-busy={flowState === "paymentLoading"}>
              {!paymentHasStarted && (
                <>
                  <p>Secure payment will appear here after your registration details are saved.</p>
                  <div className="payment-placeholder">Secure payment area</div>
                </>
              )}
              {(flowState === "detailsSaved" || flowState === "paymentLoading") && (
                <div className="payment-loading-state"><span className="loading-spinner" aria-hidden="true" /><p>Preparing secure payment…</p></div>
              )}
              {flowState === "paymentReady" && (
                <>
                  <p>Secure payment is ready.</p>
                  {checkoutClientSecret && (
                    <div className="stripe-checkout-container">
                      <StripePayment clientSecret={checkoutClientSecret} onComplete={handlePaymentComplete} />
                    </div>
                  )}
                </>
              )}
              {flowState === "paymentComplete" && <p className="payment-complete-message">Payment complete. Your registration is confirmed.</p>}
              {flowState === "error" && errorContext === "payment" && (
                <div className="payment-error-state" role="alert">
                  <p>We couldn’t load secure payment. Please try again.</p>
                  <button type="button" onClick={retryPayment}>Try payment again</button>
                </div>
              )}
            </div>
            <p className="deadline">Register by <strong>September 25th, 2026</strong></p>
          </aside>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <div className="footer-brands">
            <span>Threshold Therapy &amp; Consulting</span>
            <span>Sweetgrass &amp; Sage Counseling</span>
          </div>
          <div className="footer-contacts">
            <span>Kari Hilwig, LICSW · (206) 356-8547</span>
            <span>Akasha Balkman, LICSW · (425) 364-6451</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
