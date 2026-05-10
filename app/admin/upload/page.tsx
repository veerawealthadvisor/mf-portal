"use client";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Simple admin password protection
  const ADMIN_PASSWORD = "veerakarthik2024";

  const handleAuth = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      setError("Incorrect admin password");
    }
  };

  const parseAmount = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
  };

  const parseDate = (val: string) => {
    if (!val) return null;
    // Handle DD-MM-YYYY format
    const parts = val.trim().split("-");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return val;
  };

  const getMonthYear = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResults(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());

      // Find header row
      let headerIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("CAN") && lines[i].includes("Investor Name")) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        setError("Could not find header row. Make sure the CSV has CAN and Investor Name columns.");
        setUploading(false);
        return;
      }

      const headers = lines[headerIndex].split("\t").map((h) => h.trim());
      const dataLines = lines.slice(headerIndex + 1);

      // Map column indices
      const col = (name: string) => headers.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));

      const canIdx = col("CAN");
      const nameIdx = col("Investor Name");
      const fundIdx = col("Fund Name");
      const schemeIdx = col("Target Scheme Name");
      const folioIdx = col("Folio No");
      const amountIdx = col("Amount (A)");
      const dateIdx = col("Date");
      const unitsIdx = col("Target Scheme Units");
      const navIdx = col("Target Scheme NAV");
      const navDateIdx = col("NAV Date");

      let inserted = 0;
      let skipped = 0;
      const investorsAdded: string[] = [];

      for (const line of dataLines) {
        if (!line.trim()) continue;
        const cols = line.split("\t").map((c) => c.trim());

        const can = cols[canIdx];
        const name = cols[nameIdx];
        const fund = cols[fundIdx];
        const scheme = cols[schemeIdx];
        const folio = cols[folioIdx]?.replace(/\(.*?\)/g, "").trim();
        const amount = parseAmount(cols[amountIdx]);
        const rawDate = cols[dateIdx];
        const units = parseFloat(cols[unitsIdx]) || 0;
        const nav = parseFloat(cols[navIdx]) || 0;
        const rawNavDate = cols[navDateIdx];

        if (!can || !name || amount === 0) {
          skipped++;
          continue;
        }

        const txnDate = parseDate(rawDate);
        const navDate = parseDate(rawNavDate);
        const monthYear = getMonthYear(txnDate || "");

        // Check if investor exists, if not note them
        const { data: existingInv } = await supabase
          .from("investors")
          .select("can")
          .eq("can", can)
          .single();

        if (!existingInv) {
          investorsAdded.push(`${name} (CAN: ${can}) — needs Auth account`);
        }

        // Check for duplicate transaction (same CAN + scheme + date + amount)
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("can", can)
          .eq("scheme_name", scheme)
          .eq("transaction_date", txnDate)
          .eq("amount", amount)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert transaction
        const { error: insertError } = await supabase
          .from("transactions")
          .insert({
            can,
            fund_name: fund,
            scheme_name: scheme,
            folio_no: folio,
            amount,
            units,
            nav,
            nav_date: navDate,
            transaction_date: txnDate,
            month_year: monthYear,
          });

        if (insertError) {
          skipped++;
        } else {
          inserted++;
        }
      }

      setResults({ inserted, skipped, investorsAdded });
    } catch (err: any) {
      setError("Something went wrong: " + err.message);
    }

    setUploading(false);
  };

  if (!authenticated) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=DM+Sans:wght@400;500&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', sans-serif; background: #0a1628; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .wrap { background: rgba(255,255,255,0.04); border: 1px solid rgba(201,168,76,0.25); border-radius: 8px; padding: 2.5rem; width: 100%; max-width: 380px; }
          h2 { font-family: 'Cormorant Garamond', serif; color: #e8c97a; font-size: 1.6rem; margin-bottom: 0.5rem; text-align: center; }
          p { color: rgba(255,255,255,0.4); font-size: 0.8rem; text-align: center; margin-bottom: 1.75rem; }
          label { display: block; font-size: 0.72rem; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem; }
          input { width: 100%; padding: 0.8rem 1rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: white; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; outline: none; margin-bottom: 1rem; }
          input:focus { border-color: rgba(201,168,76,0.6); }
          button { width: 100%; background: #c9a84c; color: #0a1628; border: none; padding: 0.85rem; border-radius: 4px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
          button:hover { background: #e8c97a; }
          .err { color: #fca5a5; font-size: 0.8rem; text-align: center; margin-bottom: 1rem; }
          .back { text-align: center; margin-top: 1rem; }
          .back a { color: rgba(255,255,255,0.3); font-size: 0.78rem; text-decoration: none; }
        `}</style>
        <div className="wrap">
          <h2>Admin Access</h2>
          <p>Enter admin password to upload data</p>
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
          />
          {error && <p className="err">{error}</p>}
          <button onClick={handleAuth}>Enter →</button>
          <div className="back"><a href="/">← Back to site</a></div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a;
          --cream: #f5f0e8; --white: #ffffff; --muted: #6b7280;
          --border: rgba(0,0,0,0.08);
        }
        body { font-family: 'DM Sans', sans-serif; background: #f0ebe0; }
        .nav { background: var(--navy); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
        .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; color: var(--gold2); }
        .nav-badge { font-size: 0.72rem; background: rgba(201,168,76,0.15); color: var(--gold); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(201,168,76,0.3); }
        .main { max-width: 760px; margin: 0 auto; padding: 2.5rem 2rem; }
        h1 { font-family: 'Cormorant Garamond', serif; font-size: 2rem; color: var(--navy); margin-bottom: 0.5rem; }
        .subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; font-weight: 300; }
        .card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 2rem; margin-bottom: 1.5rem; }
        .card h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: var(--navy); margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .drop-zone {
          border: 2px dashed rgba(201,168,76,0.4);
          border-radius: 8px; padding: 3rem 2rem;
          text-align: center; cursor: pointer;
          transition: all 0.2s; background: #faf9f6;
          margin-bottom: 1.25rem;
        }
        .drop-zone:hover { border-color: var(--gold); background: rgba(201,168,76,0.04); }
        .drop-zone.has-file { border-color: var(--gold); background: rgba(201,168,76,0.06); }
        .drop-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
        .drop-title { font-size: 1rem; font-weight: 500; color: var(--navy); margin-bottom: 0.4rem; }
        .drop-sub { font-size: 0.8rem; color: var(--muted); }
        .file-input { display: none; }
        .upload-btn {
          width: 100%; background: var(--navy); color: white;
          border: none; padding: 0.9rem; border-radius: 4px;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
        }
        .upload-btn:hover:not(:disabled) { background: #1a2744; }
        .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .result-card { border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; }
        .result-success { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); }
        .result-title { font-size: 1rem; font-weight: 500; color: #15803d; margin-bottom: 1rem; }
        .result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .result-stat { text-align: center; background: white; border-radius: 6px; padding: 1rem; }
        .result-num { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 700; color: var(--navy); }
        .result-label { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .new-investors { margin-top: 1rem; }
        .new-investors h4 { font-size: 0.8rem; font-weight: 500; color: #92400e; margin-bottom: 0.5rem; }
        .new-inv-item { font-size: 0.8rem; color: #92400e; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.4rem; }
        .error-box { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 1rem; color: #dc2626; font-size: 0.85rem; margin-top: 1rem; }
        .instructions { font-size: 0.83rem; color: var(--muted); line-height: 1.8; }
        .instructions li { margin-bottom: 0.4rem; }
        .tag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(201,168,76,0.1); color: #92400e; margin-right: 4px; font-family: monospace; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Admin</div>
        <div className="nav-badge">Admin Panel</div>
      </nav>

      <div className="main">
        <h1>Upload Monthly Data</h1>
        <p className="subtitle">Upload your transaction CSV file to update all investor dashboards instantly.</p>

        <div className="card">
          <h2>📁 Select CSV File</h2>
          <div
            className={`drop-zone ${file ? "has-file" : ""}`}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <div className="drop-icon">{file ? "✅" : "📂"}</div>
            <div className="drop-title">
              {file ? file.name : "Click to select your CSV file"}
            </div>
            <div className="drop-sub">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · Ready to upload`
                : "Supports tab-separated files exported from your MF platform"}
            </div>
          </div>
          <input
            id="fileInput"
            type="file"
            accept=".csv,.txt,.tsv"
            className="file-input"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResults(null);
              setError("");
            }}
          />
          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? "⏳ Uploading & Processing..." : "⬆️ Upload and Update Dashboards"}
          </button>

          {error && <div className="error-box">⚠️ {error}</div>}

          {results && (
            <div className="result-card result-success">
              <div className="result-title">✅ Upload Complete!</div>
              <div className="result-grid">
                <div className="result-stat">
                  <div className="result-num">{results.inserted}</div>
                  <div className="result-label">Transactions added</div>
                </div>
                <div className="result-stat">
                  <div className="result-num">{results.skipped}</div>
                  <div className="result-label">Skipped (duplicates)</div>
                </div>
              </div>
              {results.investorsAdded.length > 0 && (
                <div className="new-investors">
                  <h4>⚠️ These investors need Auth accounts created in Supabase:</h4>
                  {results.investorsAdded.map((inv: string, i: number) => (
                    <div className="new-inv-item" key={i}>👤 {inv}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>📋 How to use</h2>
          <ol className="instructions">
            <li>Export your monthly transaction report as a <strong>tab-separated (.txt or .csv)</strong> file</li>
            <li>Make sure it has these columns: <span className="tag">CAN</span><span className="tag">Investor Name</span><span className="tag">Fund Name</span><span className="tag">Target Scheme Name</span><span className="tag">Amount (A)</span><span className="tag">Date</span><span className="tag">Target Scheme Units</span><span className="tag">Target Scheme NAV</span></li>
            <li>Click the upload area, select your file, and click Upload</li>
            <li>Duplicate transactions are automatically skipped — safe to re-upload same file</li>
            <li>If new investors appear, create their Auth accounts in Supabase → Authentication → Users</li>
          </ol>
        </div>
      </div>
    </>
  );
}
