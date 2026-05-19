"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Check if user came from a valid reset link
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidSession(true);
    });
  }, []);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Could not reset password. Please try again.");
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
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
        .hint { font-size: 0.72rem; color: rgba(255,255,255,0.25); margin-top: -0.75rem; margin-bottom: 1rem; }
      `}</style>
      <div className="bg">
        <div className="card">
          <div className="icon">{done ? "✅" : "🔑"}</div>
          <h2>{done ? "Password Updated!" : "Set New Password"}</h2>
          {done ? (
            <div className="success">
              Your password has been updated successfully!<br />
              Redirecting to dashboard...
            </div>
          ) : (
            <>
              <p>Choose a strong password for your investor account.</p>
              <label>New Password</label>
              <input type="password" placeholder="Minimum 6 characters" value={password}
                onChange={e => setPassword(e.target.value)} />
              <p className="hint">Use at least 6 characters</p>
              <label>Confirm Password</label>
              <input type="password" placeholder="Re-enter your password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()} />
              {error && <div className="error">{error}</div>}
              <button className="btn" onClick={handleReset} disabled={loading}>
                {loading ? "Updating..." : "Update Password →"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
