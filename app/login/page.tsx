"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #0a1628;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-bg {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a1628 0%, #0f1f3d 50%, #1a2744 100%);
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }

        .login-bg::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.07) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(201,168,76,0.04) 0%, transparent 50%);
        }

        .login-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(201,168,76,0.25);
          border-radius: 8px;
          padding: 3rem;
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          backdrop-filter: blur(10px);
        }

        .login-logo {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-logo h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: #e8c97a;
          margin-bottom: 0.25rem;
        }

        .login-logo p {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .divider {
          height: 1px;
          background: rgba(201,168,76,0.2);
          margin: 1.75rem 0;
        }

        .form-title {
          font-size: 1rem;
          color: rgba(255,255,255,0.85);
          font-weight: 500;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.45);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.5rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.85rem 1rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          border-color: rgba(201,168,76,0.6);
        }

        .form-group input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .error-msg {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 4px;
          font-size: 0.83rem;
          margin-bottom: 1.25rem;
          text-align: center;
        }

        .login-btn {
          width: 100%;
          background: #c9a84c;
          color: #0a1628;
          border: none;
          padding: 0.9rem;
          border-radius: 4px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.03em;
        }

        .login-btn:hover:not(:disabled) {
          background: #e8c97a;
          transform: translateY(-1px);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .back-link {
          text-align: center;
          margin-top: 1.5rem;
        }

        .back-link a {
          color: rgba(255,255,255,0.35);
          font-size: 0.8rem;
          text-decoration: none;
          transition: color 0.2s;
        }

        .back-link a:hover {
          color: #c9a84c;
        }

        .arn-note {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.2);
          line-height: 1.6;
        }
      `}</style>

      <div className="login-bg">
        <div className="login-card">
          <div className="login-logo">
            <h1>Veera Karthik</h1>
            <p>Investor Portal · ARN 355717</p>
          </div>

          <div className="divider" />

          <p className="form-title">Sign in to your account</p>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <div className="back-link">
            <a href="/">← Back to main site</a>
          </div>

          <p className="arn-note">
            For login credentials, contact Veera Karthik<br />
            📞 8148582571 · veerawealthadvisor@gmail.com
          </p>
        </div>
      </div>
    </>
  );
}
