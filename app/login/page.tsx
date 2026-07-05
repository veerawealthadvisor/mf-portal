"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
const timedOut = searchParams.get("reason") === "timeout";
  const [tab, setTab] = useState<"password" | "otp">("otp");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handlePasswordLogin = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  };

  const handleSendOTP = async () => {
    if (!otpEmail.trim() || !/\S+@\S+\.\S+/.test(otpEmail)) {
      setOtpError("Please enter a valid email address");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: undefined,
      },
    });
    if (error) {
      setOtpError("Could not send OTP. Please check your email and try again.");
      setOtpLoading(false);
      return;
    }
    setOtpSent(true);
    setOtpLoading(false);
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length < 6) {
      setOtpError("Please enter the 6-digit OTP");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otp,
      type: "email",  // ✅ FIXED: was "magiclink", now "email"
    });
    if (error) {
      setOtpError("Invalid or expired OTP. Please try again.");
      setOtpLoading(false);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #0a1628; min-height: 100vh; }

        .login-bg {
          min-height: 100vh; width: 100%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #0a1628 0%, #0f1f3d 50%, #1a2744 100%);
          padding: 2rem; position: relative; overflow: hidden;
        }
        .login-bg::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.07) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(201,168,76,0.04) 0%, transparent 50%);
        }

        .login-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(201,168,76,0.25);
          border-radius: 12px; padding: 2.5rem;
          width: 100%; max-width: 420px;
          position: relative; z-index: 1;
          backdrop-filter: blur(10px);
        }

        .login-logo { text-align: center; margin-bottom: 1.75rem; }
        .login-logo h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.8rem; font-weight: 700;
          color: #e8c97a; margin-bottom: 0.25rem;
        }
        .login-logo p { font-size: 0.78rem; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; }

        .tabs {
          display: flex; background: rgba(255,255,255,0.06);
          border-radius: 8px; padding: 3px; margin-bottom: 1.75rem;
        }
        .tab-btn {
          flex: 1; padding: 0.6rem; border-radius: 6px;
          border: none; background: none;
          font-family: 'DM Sans', sans-serif; font-size: 0.82rem;
          color: rgba(255,255,255,0.45); cursor: pointer; transition: all 0.2s;
        }
        .tab-btn.active { background: #c9a84c; color: #0a1628; font-weight: 500; }

        .form-group { margin-bottom: 1.1rem; }
        label { display: block; font-size: 0.72rem; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; }
        input {
          width: 100%; padding: 0.85rem 1rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px; color: white;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
          outline: none; transition: border-color 0.2s;
        }
        input:focus { border-color: rgba(201,168,76,0.6); }
        input::placeholder { color: rgba(255,255,255,0.2); }

        .otp-boxes {
          display: flex; gap: 8px; justify-content: center;
          margin: 1rem 0;
        }
        .otp-box {
          width: 44px; height: 52px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px; color: white;
          font-size: 1.4rem; font-weight: 600;
          text-align: center; outline: none;
          transition: all 0.2s; padding: 0;
        }
        .otp-box:focus { border-color: #c9a84c; background: rgba(201,168,76,0.1); }

        .error-msg {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5; padding: 0.75rem 1rem;
          border-radius: 6px; font-size: 0.83rem;
          margin-bottom: 1.1rem; text-align: center;
        }

        .success-msg {
          background: rgba(22,163,74,0.1);
          border: 1px solid rgba(22,163,74,0.25);
          color: #86efac; padding: 0.75rem 1rem;
          border-radius: 6px; font-size: 0.83rem;
          margin-bottom: 1.1rem; text-align: center;
          line-height: 1.6;
        }

        .login-btn {
          width: 100%; background: #c9a84c; color: #0a1628;
          border: none; padding: 0.9rem; border-radius: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
          font-weight: 500; cursor: pointer; transition: all 0.2s;
        }
        .login-btn:hover:not(:disabled) { background: #e8c97a; transform: translateY(-1px); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.25rem 0; }

        .forgot-link { text-align: right; margin-bottom: 1rem; }
        .forgot-link a { color: rgba(255,255,255,0.35); font-size: 0.78rem; text-decoration: none; transition: color 0.2s; }
        .forgot-link a:hover { color: #c9a84c; }

        .resend-row { text-align: center; margin-top: 1rem; }
        .resend-btn {
          background: none; border: none;
          color: rgba(255,255,255,0.4); font-size: 0.78rem;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: color 0.2s;
        }
        .resend-btn:hover:not(:disabled) { color: #c9a84c; }
        .resend-btn:disabled { cursor: not-allowed; }

        .back-link { text-align: center; margin-top: 1.5rem; }
        .back-link a { color: rgba(255,255,255,0.25); font-size: 0.78rem; text-decoration: none; transition: color 0.2s; }
        .back-link a:hover { color: rgba(255,255,255,0.5); }

        .arn-note { text-align: center; margin-top: 1.5rem; font-size: 0.7rem; color: rgba(255,255,255,0.18); line-height: 1.6; }

        .otp-sent-header { text-align: center; margin-bottom: 1.25rem; }
        .otp-sent-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .otp-sent-title { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: #e8c97a; margin-bottom: 0.25rem; }
        .otp-sent-sub { font-size: 0.78rem; color: rgba(255,255,255,0.4); line-height: 1.6; }
        .otp-email-highlight { color: #c9a84c; font-weight: 500; }
      `}</style>

      <div className="login-bg">
        <div className="login-card">
          <div className="login-logo">
            <h1>Veera Karthik</h1>
            <p>Investor Portal · ARN 355717</p>
          </div>
{timedOut && (
  <div style={{
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.3)",
    color: "#d97706",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    fontSize: "0.82rem",
    marginBottom: "1.25rem",
    textAlign: "center",
  }}>
    ⏰ You were logged out after 30 minutes of inactivity. Please log in again.
  </div>
)}
          <div className="tabs">
            <button className={`tab-btn ${tab === "otp" ? "active" : ""}`} onClick={() => { setTab("otp"); setError(""); setOtpError(""); }}>
              📱 Login with OTP
            </button>
            <button className={`tab-btn ${tab === "password" ? "active" : ""}`} onClick={() => { setTab("password"); setError(""); setOtpError(""); }}>
              🔑 Login with Password
            </button>
          </div>

          {tab === "password" && (
            <>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter your email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePasswordLogin()} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" placeholder="Enter your password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePasswordLogin()} />
              </div>
              <div className="forgot-link">
                <a href="/forgot-password">Forgot Password?</a>
              </div>
              {error && <div className="error-msg">{error}</div>}
              <button className="login-btn" onClick={handlePasswordLogin} disabled={loading}>
                {loading ? "Signing in..." : "Sign In →"}
              </button>
            </>
          )}

          {tab === "otp" && !otpSent && (
            <>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter your registered email"
                  value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendOTP()} />
              </div>
              {otpError && <div className="error-msg">{otpError}</div>}
              <button className="login-btn" onClick={handleSendOTP} disabled={otpLoading}>
                {otpLoading ? "Sending OTP..." : "Send OTP to Email →"}
              </button>
            </>
          )}

          {tab === "otp" && otpSent && (
            <>
              <div className="otp-sent-header">
                <div className="otp-sent-icon">📧</div>
                <div className="otp-sent-title">Check Your Email</div>
                <div className="otp-sent-sub">
                  We sent a 6-digit OTP to<br />
                  <span className="otp-email-highlight">{otpEmail}</span>
                </div>
              </div>

              <div className="otp-boxes">
                {Array.from({ length: 6 }, (_, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    className="otp-box"
                    maxLength={1}
                    value={otp[i] || ""}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "");
                      const newOtp = otp.split("");
                      newOtp[i] = val;
                      setOtp(newOtp.join(""));
                      setOtpError("");
                      if (val && i < 5) {
                        document.getElementById(`otp-${i + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) {
                        document.getElementById(`otp-${i - 1}`)?.focus();
                      }
                      if (e.key === "Enter" && otp.length === 6) handleVerifyOTP();
                    }}
                    onPaste={e => {
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      setOtp(pasted);
                      document.getElementById(`otp-${Math.min(pasted.length, 5)}`)?.focus();
                      e.preventDefault();
                    }}
                  />
                ))}
              </div>

              {otpError && <div className="error-msg">{otpError}</div>}

              <button className="login-btn" onClick={handleVerifyOTP} disabled={otpLoading || otp.length < 6}>
                {otpLoading ? "Verifying..." : "Verify OTP →"}
              </button>

              <div className="resend-row">
                <button className="resend-btn" onClick={() => { setOtpSent(false); setOtp(""); setOtpError(""); }} disabled={resendTimer > 0}>
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "← Use different email"}
                </button>
                {resendTimer === 0 && (
                  <button className="resend-btn" style={{ marginLeft: 12 }} onClick={handleSendOTP} disabled={otpLoading}>
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}

          <div className="back-link">
            <a href="/">← Back to main site</a>
          </div>

          <p className="arn-note">
            For login help, contact Veera Karthik<br />
            📞 8148582571 · veerawealthadvisor@gmail.com
          </p>
        </div>
      </div>
    </>
  );
}
