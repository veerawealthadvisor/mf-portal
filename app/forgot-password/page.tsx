"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError("Could not send reset email. Please try again.");
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #0a1628; min-height: 100vh; }
        .bg { min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #0a1628 0%, #0f1f3d 50%, #1a2744 100%); padding: 2rem; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(201,168,76,0.25);
          border-radius: 12px; padding: 2.5rem; width: 100%; max-width: 400px; }
        .icon { font-size: 2.5rem; text-align: center; margin-bottom: 1rem; }
        h2 { font-family: 'Cormorant Garamond', serif; color: #e8c97a; font-size: 1.6rem;
          text-align: center; margin-bottom: 0.5rem; }
        p { color: rgba(255,255,255,0.4); font-size: 0.82rem; text-align: center;
          line-height: 1.6; margin-bottom: 1.5rem; }
        label { display: block; font-size: 0.72rem; color: rgba(255,255,255,0.45);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem; }
        input { width: 100%; padding: 0.85rem 1rem; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem; outline: none;
          transition: border-color 0.2s; margin-bottom: 1rem; }
        input:focus { border-color: rgba(201,168,76,0.6); }
        input::placeholder { color: rgba(255,255,255,0.2); }
        .btn { width: 100%; background: #c9a84c; color: #0a1628; border: none;
          padding: 0.9rem; border-radius: 6px; font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn:hover:not(:disabled) { background: #e8c97a; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5; padding: 0.75rem; border-radius: 6px; font-size: 0.82rem;
          text-align: center; margin-bottom: 1rem; }
        .success { background: rgba(22,163,74,0.1); border: 1px solid rgba(22,163,74,0.25);
          color: #86efac; padding: 1rem; border-radius: 6px; font-size: 0.82rem;
          text-align: center; line-height: 1.7; }
        .back { text-align: center; margin-top: 1.25rem; }
        .back a { color: rgba(255,255,255,0.3); font-size: 0.78rem; text-decoration: none; }
        .back a:hover { color: #c9a84c; }
      `}</style>
      <div className="bg">
        <div className="card">
          <div className="icon">🔐</div>
          <h2>Reset Password</h2>
          {!sent ? (
            <>
              <p>Enter your registered email and we'll send you a password reset link.</p>
              <label>Email Address</label>
              <input type="email" placeholder="Enter your email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()} />
              {error && <div className="error">{error}</div>}
              <button className="btn" onClick={handleReset} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link →"}
              </button>
            </>
          ) : (
            <div className="success">
              ✅ Reset link sent to<br />
              <strong>{email}</strong><br /><br />
              Check your inbox and click the link to reset your password. Link expires in 1 hour.
            </div>
          )}
          <div className="back"><a href="/login">← Back to Login</a></div>
        </div>
      </div>
    </>
  );
}
