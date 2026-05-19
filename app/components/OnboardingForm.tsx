"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE = "service_cxnrt5x";
const EMAILJS_TEMPLATE = "template_y4a72ml";
const EMAILJS_PUBLIC_KEY = "_MLSlX130BvDo6KeC";

interface FormData {
  // Personal
  name: string;
  pan: string;
  dob: string;
  mobile: string;
  email: string;
  // Bank
  bank_account: string;
  ifsc: string;
  account_type: string;
  // Nominee
  nominee: boolean;
  nominee_name: string;
  nominee_relation: string;
  nominee_dob: string;
  nominee_aadhar: string;
  nominee_mobile: string;
  nominee_email: string;
}

const INITIAL: FormData = {
  name: "", pan: "", dob: "", mobile: "", email: "",
  bank_account: "", ifsc: "", account_type: "savings",
  nominee: false, nominee_name: "", nominee_relation: "",
  nominee_dob: "", nominee_aadhar: "", nominee_mobile: "", nominee_email: "",
};

export default function OnboardingForm({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof FormData, val: any) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors((prev: any) => ({ ...prev, [key]: "" }));
  };

  const validateStep = () => {
    const e: any = {};
    if (step === 1) {
      if (!form.name.trim()) e.name = "Name is required";
      if (!form.pan.trim() || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.toUpperCase())) e.pan = "Enter valid PAN (e.g. ABCDE1234F)";
      if (!form.dob) e.dob = "Date of birth is required";
      if (!form.mobile.trim() || !/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = "Enter valid 10-digit mobile number";
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter valid email address";
    }
    if (step === 2) {
      if (!form.bank_account.trim()) e.bank_account = "Account number is required";
      if (!form.ifsc.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.toUpperCase())) e.ifsc = "Enter valid IFSC code (e.g. SBIN0001234)";
    }
    if (step === 3 && form.nominee) {
      if (!form.nominee_name.trim()) e.nominee_name = "Nominee name is required";
      if (!form.nominee_relation.trim()) e.nominee_relation = "Relation is required";
      if (!form.nominee_dob) e.nominee_dob = "Date of birth is required";
      if (!form.nominee_aadhar.trim() || !/^\d{4}$/.test(form.nominee_aadhar)) e.nominee_aadhar = "Enter last 4 digits of Aadhaar";
      if (!form.nominee_mobile.trim() || !/^[6-9]\d{9}$/.test(form.nominee_mobile)) e.nominee_mobile = "Enter valid mobile number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);

    try {
      // Save to Supabase
      await supabase.from("leads").insert({
        name: form.name,
        pan: form.pan.toUpperCase(),
        dob: form.dob,
        mobile: form.mobile,
        email: form.email,
        bank_account: form.bank_account,
        ifsc: form.ifsc.toUpperCase(),
        account_type: form.account_type,
        nominee: form.nominee,
        nominee_name: form.nominee ? form.nominee_name : null,
        nominee_relation: form.nominee ? form.nominee_relation : null,
        nominee_dob: form.nominee ? form.nominee_dob : null,
        nominee_aadhar: form.nominee ? form.nominee_aadhar : null,
        nominee_mobile: form.nominee ? form.nominee_mobile : null,
        nominee_email: form.nominee ? form.nominee_email : null,
      });

      // Send email notification
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        {
          investor_name: form.name,
          pan: form.pan.toUpperCase(),
          dob: form.dob,
          mobile: form.mobile,
          email: form.email,
          bank_account: form.bank_account,
          ifsc: form.ifsc.toUpperCase(),
          account_type: form.account_type,
          nominee: form.nominee ? "Yes" : "No",
          nominee_name: form.nominee_name || "N/A",
          nominee_relation: form.nominee_relation || "N/A",
          nominee_dob: form.nominee_dob || "N/A",
          nominee_aadhar: form.nominee_aadhar || "N/A",
          nominee_mobile: form.nominee_mobile || "N/A",
          nominee_email: form.nominee_email || "N/A",
          submitted_at: new Date().toLocaleString("en-IN"),
        },
        EMAILJS_PUBLIC_KEY
      );

      setDone(true);
    } catch (err) {
      console.error(err);
    }

    setSubmitting(false);
  };

  const steps = ["Personal", "Bank", "Nominee", "Done"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .ob-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          backdrop-filter: blur(4px);
        }

        .ob-modal {
          background: #fff;
          border-radius: 12px;
          width: 100%; max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 24px 80px rgba(0,0,0,0.3);
        }

        .ob-header {
          background: #0a1628;
          padding: 1.5rem 2rem 1.25rem;
          border-radius: 12px 12px 0 0;
          position: sticky; top: 0; z-index: 10;
        }

        .ob-close {
          position: absolute; top: 1rem; right: 1rem;
          background: rgba(255,255,255,0.1);
          border: none; color: white; width: 28px; height: 28px;
          border-radius: 50%; cursor: pointer; font-size: 1rem;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .ob-close:hover { background: rgba(255,255,255,0.2); }

        .ob-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.4rem; font-weight: 700;
          color: #e8c97a; margin-bottom: 0.25rem;
        }
        .ob-subtitle { font-size: 0.78rem; color: rgba(255,255,255,0.45); }

        .ob-steps {
          display: flex; gap: 0; margin-top: 1.25rem;
        }
        .ob-step {
          flex: 1; height: 3px; border-radius: 2px;
          background: rgba(255,255,255,0.15);
          margin-right: 4px; transition: background 0.3s;
        }
        .ob-step.active { background: #c9a84c; }
        .ob-step.done { background: #16a34a; }

        .ob-step-label {
          display: flex; justify-content: space-between;
          margin-top: 0.5rem;
        }
        .ob-step-label span {
          font-size: 0.65rem; color: rgba(255,255,255,0.35);
          text-transform: uppercase; letter-spacing: 0.05em;
          flex: 1; text-align: center;
        }
        .ob-step-label span.active { color: #c9a84c; }

        .ob-body { padding: 1.75rem 2rem; }

        .ob-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem; font-weight: 700;
          color: #0a1628; margin-bottom: 1.25rem;
          display: flex; align-items: center; gap: 8px;
        }

        .ob-field { margin-bottom: 1.1rem; }
        .ob-label {
          display: block; font-size: 0.72rem;
          color: #6b7280; text-transform: uppercase;
          letter-spacing: 0.06em; margin-bottom: 0.4rem;
          font-weight: 500;
        }
        .ob-label span { color: #dc2626; margin-left: 2px; }
        .ob-input {
          width: 100%; padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb; border-radius: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
          color: #0a1628; outline: none;
          transition: border-color 0.2s;
          background: #faf9f6;
        }
        .ob-input:focus { border-color: #c9a84c; background: #fff; }
        .ob-input.error { border-color: #dc2626; }
        .ob-error { font-size: 0.72rem; color: #dc2626; margin-top: 3px; }

        .ob-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

        .ob-select {
          width: 100%; padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb; border-radius: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
          color: #0a1628; outline: none; background: #faf9f6;
          cursor: pointer;
        }
        .ob-select:focus { border-color: #c9a84c; }

        .ob-toggle {
          display: flex; gap: 0; border: 1px solid #e5e7eb;
          border-radius: 6px; overflow: hidden;
        }
        .ob-toggle-btn {
          flex: 1; padding: 0.75rem;
          border: none; background: #faf9f6;
          font-family: 'DM Sans', sans-serif; font-size: 0.88rem;
          cursor: pointer; transition: all 0.2s; color: #6b7280;
        }
        .ob-toggle-btn.active { background: #0a1628; color: #e8c97a; font-weight: 500; }

        .ob-nominee-box {
          background: #faf9f6; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 1.25rem;
          margin-top: 1rem;
        }
        .ob-nominee-title {
          font-size: 0.82rem; font-weight: 500;
          color: #0a1628; margin-bottom: 1rem;
        }

        .ob-security {
          display: flex; align-items: center; gap: 8px;
          background: rgba(22,163,74,0.06);
          border: 1px solid rgba(22,163,74,0.15);
          border-radius: 6px; padding: 0.6rem 0.85rem;
          font-size: 0.75rem; color: #15803d;
          margin-bottom: 1.5rem;
        }

        .ob-footer {
          display: flex; gap: 0.75rem;
          padding: 1rem 2rem 1.5rem;
          border-top: 1px solid #f3f4f6;
        }
        .ob-btn-back {
          flex: 1; padding: 0.85rem;
          border: 1px solid #e5e7eb; border-radius: 6px;
          background: white; color: #6b7280;
          font-family: 'DM Sans', sans-serif; font-size: 0.88rem;
          cursor: pointer; transition: all 0.2s;
        }
        .ob-btn-back:hover { border-color: #0a1628; color: #0a1628; }
        .ob-btn-next {
          flex: 2; padding: 0.85rem;
          background: #0a1628; color: white;
          border: none; border-radius: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 0.88rem;
          font-weight: 500; cursor: pointer; transition: all 0.2s;
        }
        .ob-btn-next:hover:not(:disabled) { background: #1a3a5c; }
        .ob-btn-next:disabled { opacity: 0.6; cursor: not-allowed; }
        .ob-btn-next.gold { background: #c9a84c; color: #0a1628; }
        .ob-btn-next.gold:hover { background: #e8c97a; }

        /* Success */
        .ob-success {
          text-align: center; padding: 3rem 2rem;
        }
        .ob-success-icon { font-size: 4rem; margin-bottom: 1rem; }
        .ob-success h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.8rem; color: #0a1628; margin-bottom: 0.5rem;
        }
        .ob-success p { font-size: 0.9rem; color: #6b7280; line-height: 1.7; margin-bottom: 1.5rem; }
        .ob-whatsapp-btn {
          background: #25D366; color: white;
          border: none; padding: 0.85rem 2rem;
          border-radius: 6px; font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem; font-weight: 500; cursor: pointer;
          transition: background 0.2s; display: inline-flex;
          align-items: center; gap: 8px;
        }
        .ob-whatsapp-btn:hover { background: #20ba59; }
        .ob-close-btn {
          display: block; margin: 0.75rem auto 0;
          background: none; border: none;
          color: #9ca3af; font-size: 0.82rem;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }

        @media (max-width: 480px) {
          .ob-row { grid-template-columns: 1fr; }
          .ob-body { padding: 1.25rem 1.25rem; }
          .ob-footer { padding: 1rem 1.25rem 1.25rem; }
        }
      `}</style>

      <div className="ob-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ob-modal">

          {/* Header */}
          {!done && (
            <div className="ob-header">
              <button className="ob-close" onClick={onClose}>✕</button>
              <div className="ob-title">Start Your Investment Journey</div>
              <div className="ob-subtitle">Complete your KYC in under 3 minutes</div>
              <div className="ob-steps">
                {steps.slice(0, 3).map((_, i) => (
                  <div key={i} className={`ob-step ${step > i + 1 ? "done" : step === i + 1 ? "active" : ""}`} />
                ))}
              </div>
              <div className="ob-step-label">
                {steps.slice(0, 3).map((s, i) => (
                  <span key={i} className={step === i + 1 ? "active" : ""}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Success Screen */}
          {done && (
            <div className="ob-success">
              <div className="ob-success-icon">🎉</div>
              <h2>You're All Set!</h2>
              <p>
                Thank you {form.name.split(" ")[0]}! Your details have been submitted successfully.<br />
                Veera Karthik will contact you within 24 hours to get your investments started.
              </p>
              <button
                className="ob-whatsapp-btn"
                onClick={() => window.open(`https://wa.me/918148582571?text=Hi%20Veera%20Karthik%2C%20I%20just%20submitted%20my%20investment%20form.%20My%20name%20is%20${encodeURIComponent(form.name)}.`, "_blank")}
              >
                💬 Chat on WhatsApp
              </button>
              <button className="ob-close-btn" onClick={onClose}>Close this window</button>
            </div>
          )}

          {/* Step 1 — Personal Details */}
          {!done && step === 1 && (
            <>
              <div className="ob-body">
                <div className="ob-section-title">👤 Personal Details</div>
                <div className="ob-security">
                  🔒 Your information is encrypted and stored securely. We never share your data.
                </div>
                <div className="ob-field">
                  <label className="ob-label">Full Name <span>*</span></label>
                  <input className={`ob-input ${errors.name ? "error" : ""}`} placeholder="As per PAN card"
                    value={form.name} onChange={e => set("name", e.target.value)} />
                  {errors.name && <div className="ob-error">{errors.name}</div>}
                </div>
                <div className="ob-row">
                  <div className="ob-field">
                    <label className="ob-label">PAN Number <span>*</span></label>
                    <input className={`ob-input ${errors.pan ? "error" : ""}`} placeholder="ABCDE1234F"
                      value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())}
                      maxLength={10} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }} />
                    {errors.pan && <div className="ob-error">{errors.pan}</div>}
                  </div>
                  <div className="ob-field">
                    <label className="ob-label">Date of Birth <span>*</span></label>
                    <input type="date" className={`ob-input ${errors.dob ? "error" : ""}`}
                      value={form.dob} onChange={e => set("dob", e.target.value)} />
                    {errors.dob && <div className="ob-error">{errors.dob}</div>}
                  </div>
                </div>
                <div className="ob-row">
                  <div className="ob-field">
                    <label className="ob-label">Mobile / WhatsApp <span>*</span></label>
                    <input className={`ob-input ${errors.mobile ? "error" : ""}`} placeholder="10-digit number"
                      value={form.mobile} onChange={e => set("mobile", e.target.value.replace(/\D/g, ""))}
                      maxLength={10} />
                    {errors.mobile && <div className="ob-error">{errors.mobile}</div>}
                  </div>
                  <div className="ob-field">
                    <label className="ob-label">Email Address <span>*</span></label>
                    <input type="email" className={`ob-input ${errors.email ? "error" : ""}`} placeholder="you@email.com"
                      value={form.email} onChange={e => set("email", e.target.value)} />
                    {errors.email && <div className="ob-error">{errors.email}</div>}
                  </div>
                </div>
              </div>
              <div className="ob-footer">
                <button className="ob-btn-next" onClick={next}>Continue to Bank Details →</button>
              </div>
            </>
          )}

          {/* Step 2 — Bank Details */}
          {!done && step === 2 && (
            <>
              <div className="ob-body">
                <div className="ob-section-title">🏦 Bank Details</div>
                <div className="ob-security">
                  🔒 Bank details are needed for mutual fund transactions and redemptions.
                </div>
                <div className="ob-field">
                  <label className="ob-label">Account Number <span>*</span></label>
                  <input className={`ob-input ${errors.bank_account ? "error" : ""}`} placeholder="Enter your bank account number"
                    value={form.bank_account} onChange={e => set("bank_account", e.target.value.replace(/\D/g, ""))} />
                  {errors.bank_account && <div className="ob-error">{errors.bank_account}</div>}
                </div>
                <div className="ob-row">
                  <div className="ob-field">
                    <label className="ob-label">IFSC Code <span>*</span></label>
                    <input className={`ob-input ${errors.ifsc ? "error" : ""}`} placeholder="SBIN0001234"
                      value={form.ifsc} onChange={e => set("ifsc", e.target.value.toUpperCase())}
                      maxLength={11} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }} />
                    {errors.ifsc && <div className="ob-error">{errors.ifsc}</div>}
                  </div>
                  <div className="ob-field">
                    <label className="ob-label">Account Type <span>*</span></label>
                    <select className="ob-select" value={form.account_type}
                      onChange={e => set("account_type", e.target.value)}>
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ob-footer">
                <button className="ob-btn-back" onClick={back}>← Back</button>
                <button className="ob-btn-next" onClick={next}>Continue to Nominee →</button>
              </div>
            </>
          )}

          {/* Step 3 — Nominee */}
          {!done && step === 3 && (
            <>
              <div className="ob-body">
                <div className="ob-section-title">👨‍👩‍👧 Nominee Details</div>
                <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                  A nominee ensures your investments are transferred smoothly to your loved ones. Highly recommended!
                </p>
                <div className="ob-field">
                  <label className="ob-label">Would you like to add a nominee?</label>
                  <div className="ob-toggle">
                    <button className={`ob-toggle-btn ${form.nominee ? "active" : ""}`} onClick={() => set("nominee", true)}>
                      ✅ Yes, add nominee
                    </button>
                    <button className={`ob-toggle-btn ${!form.nominee ? "active" : ""}`} onClick={() => set("nominee", false)}>
                      Skip for now
                    </button>
                  </div>
                </div>

                {form.nominee && (
                  <div className="ob-nominee-box">
                    <div className="ob-nominee-title">Nominee Information</div>
                    <div className="ob-field">
                      <label className="ob-label">Nominee Full Name <span>*</span></label>
                      <input className={`ob-input ${errors.nominee_name ? "error" : ""}`} placeholder="Full name"
                        value={form.nominee_name} onChange={e => set("nominee_name", e.target.value)} />
                      {errors.nominee_name && <div className="ob-error">{errors.nominee_name}</div>}
                    </div>
                    <div className="ob-row">
                      <div className="ob-field">
                        <label className="ob-label">Relation <span>*</span></label>
                        <select className={`ob-select ${errors.nominee_relation ? "error" : ""}`}
                          value={form.nominee_relation} onChange={e => set("nominee_relation", e.target.value)}>
                          <option value="">Select relation</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Son">Son</option>
                          <option value="Daughter">Daughter</option>
                          <option value="Brother">Brother</option>
                          <option value="Sister">Sister</option>
                          <option value="Other">Other</option>
                        </select>
                        {errors.nominee_relation && <div className="ob-error">{errors.nominee_relation}</div>}
                      </div>
                      <div className="ob-field">
    <label className="ob-label">Date of Birth <span>*</span></label>
    <input type="date" className={`ob-input ${errors.nominee_dob ? "error" : ""}`}
      value={form.nominee_dob} onChange={e => set("nominee_dob", e.target.value)} />
    {errors.nominee_dob && <div className="ob-error">{errors.nominee_dob}</div>}
  </div>
                      <div className="ob-field">
                        <label className="ob-label">Aadhaar Last 4 Digits <span>*</span></label>
                        <input className={`ob-input ${errors.nominee_aadhar ? "error" : ""}`} placeholder="XXXX"
                          value={form.nominee_aadhar} onChange={e => set("nominee_aadhar", e.target.value.replace(/\D/g, ""))}
                          maxLength={4} />
                        {errors.nominee_aadhar && <div className="ob-error">{errors.nominee_aadhar}</div>}
                      </div>
                    </div>
                    <div className="ob-row">
                      <div className="ob-field">
                        <label className="ob-label">Nominee Mobile</label>
                        <input className={`ob-input ${errors.nominee_mobile ? "error" : ""}`} placeholder="10-digit number"
                          value={form.nominee_mobile} onChange={e => set("nominee_mobile", e.target.value.replace(/\D/g, ""))}
                          maxLength={10} />
                        {errors.nominee_mobile && <div className="ob-error">{errors.nominee_mobile}</div>}
                      </div>
                      <div className="ob-field">
                        <label className="ob-label">Nominee Email</label>
                        <input type="email" className="ob-input" placeholder="nominee@email.com"
                          value={form.nominee_email} onChange={e => set("nominee_email", e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="ob-footer">
                <button className="ob-btn-back" onClick={back}>← Back</button>
                <button className={`ob-btn-next gold`} onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "🎉 Submit Application"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
