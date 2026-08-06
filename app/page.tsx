const eventDetails = [
  ["Saturday, October 10, 2026", "calendar"],
  ["9:30am – 4:00pm", "clock"],
  ["House of Welcome Longhouse, The Evergreen State College, Olympia, WA", "pin"],
  ["$195 per person · $100 for enrolled Tribal members", "dollar"],
] as const;

function MedicineWheel() {
  return (
    <div className="wheel-frame" aria-label="Medicine Wheel illustration">
      <svg viewBox="0 0 240 240" role="img" aria-hidden="true">
        <circle cx="120" cy="120" r="110" fill="#fffaf0" stroke="#c99b45" strokeWidth="3" />
        <path d="M120 120 L42 42 A110 110 0 0 1 198 42 Z" fill="#f8f3e8" />
        <path d="M120 120 L198 42 A110 110 0 0 1 198 198 Z" fill="#e5b72f" />
        <path d="M120 120 L198 198 A110 110 0 0 1 42 198 Z" fill="#a94d2f" />
        <path d="M120 120 L42 198 A110 110 0 0 1 42 42 Z" fill="#242521" />
        <circle cx="120" cy="120" r="110" fill="none" stroke="#c99b45" strokeWidth="3" />
        <path d="M42 42L198 198M198 42L42 198" stroke="#fff9ed" strokeWidth="2" />
      </svg>
      <span className="sprig sprig-left" />
      <span className="sprig sprig-right" />
    </div>
  );
}

function Icon({ type }: { type: string }) {
  const content = type === "calendar" ? "▦" : type === "clock" ? "◷" : type === "pin" ? "⌖" : "$";
  return <span className="detail-icon" aria-hidden="true">{content}</span>;
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a href="https://thresholdtherapist.com/" className="brand">Threshold Therapy &amp; Consulting</a>
        <a href="mailto:thresholdtherapeutic@gmail.com" className="header-link">Contact Kari</a>
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
                <span>{text}</span>
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
            <img src="/akasha.jpg" alt="Akasha Balkman" />
            <div>
              <h3>Akasha Balkman, LICSW</h3>
              <p>
                Licensed Clinical Social Worker, Pediatric Palliative Care Specialist at Seattle Children&apos;s Hospital, founder of Sweetgrass &amp; Sage Counseling, and co-founder of Hello Angel. An enrolled member of the Yankton Sioux Tribe, she integrates Indigenous teachings and the Medicine Wheel into her work.
              </p>
            </div>
          </article>
          <article className="facilitator-card">
            <img src="/kari.jpg" alt="Kari Hilwig" />
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

            <form className="visual-form">
              <div className="form-grid">
                <label>First name <span>*</span><input placeholder="First name" /></label>
                <label>Last name <span>*</span><input placeholder="Last name" /></label>
                <label>Phone number <span>*</span><input placeholder="(555) 555-5555" /></label>
                <label>Email address <span>*</span><input type="email" placeholder="you@example.com" /></label>
                <label>Emergency contact name <span>*</span><input placeholder="Contact name" /></label>
                <label>Emergency contact phone <span>*</span><input placeholder="(555) 555-5555" /></label>
              </div>

              <fieldset>
                <legend>Are you an enrolled Tribal member? <span>*</span></legend>
                <label className="choice"><input type="radio" name="tribal" /> Yes</label>
                <label className="choice"><input type="radio" name="tribal" /> No</label>
              </fieldset>

              <fieldset>
                <legend>What is your professional role? <span>*</span></legend>
                <div className="choice-grid">
                  {["Doctor", "NP", "PA", "RN", "CNA", "Social Worker", "PT/OT", "Professional Caregiver", "Other"].map((role) => (
                    <label className="choice" key={role}><input type="checkbox" /> {role}</label>
                  ))}
                </div>
              </fieldset>

              <label>How did you hear about this event? <span>*</span>
                <select defaultValue=""><option value="" disabled>Select one</option><option>Web search</option><option>Colleague</option><option>Friend or family</option><option>Social media</option><option>Other</option></select>
              </label>

              <button type="button">Continue to secure payment</button>
              <p className="prototype-note">Visual prototype only — Stripe and Google Sheets are not connected yet.</p>
            </form>
          </div>

          <aside className="payment-card">
            <div className="botanical-mark">✦</div>
            <p className="price-main">$195 <small>per person</small></p>
            <p className="price-alt">$100 for enrolled Tribal members</p>
            <div className="payment-divider" />
            <p>Stripe Embedded Checkout will appear here after the registration details are completed.</p>
            <div className="stripe-placeholder">Secure payment area</div>
            <p className="deadline">Register by <strong>September 25th, 2026</strong></p>
          </aside>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <span>Threshold Therapy &amp; Consulting</span>
          <span>Kari Hilwig, LICSW · (206) 356-8547</span>
        </div>
      </footer>
    </main>
  );
}
