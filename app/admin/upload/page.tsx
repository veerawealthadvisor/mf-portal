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
    return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
  };

  const parseDate = (val: string) => {
    if (!val) return null;
    const s = String(val).trim();
    const parts = s.split("-");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return s;
  };

  const getMonthYear = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += line[i];
      }
    }
    result.push(current.trim());
    return result;
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
        if (lines[i].includes("ITRN") && lines[i].includes("CAN") && lines[i].includes("Investor Name")) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        setError("Could not find header row. Please upload the GotxReportDST CSV file.");
        setUploading(false);
        return;
      }

      const dataLines = lines.slice(headerIndex + 1);

      // EXACT column positions from GotxReportDST file
      const ITRN_COL = 8;
      const CAN_COL = 9;
      const NAME_COL = 10;
      const FUND_COL = 11;
      const SCHEME_COL = 13;
      const FOLIO_COL = 15;
      const DATE_COL = 20;
      const TARGET_UNITS_COL = 25;
      const TARGET_AMOUNT_COL = 26;
      const TARGET_NAV_COL = 27;
      const TARGET_NAV_DATE_COL = 28;

      let inserted = 0;
      let duplicates = 0;
      let skipped = 0;
      const investorsNotFound: string[] = [];

      for (const line of dataLines) {
        if (!line.trim()) continue;
        const cols = parseCSVLine(line);

        const itrn = cols[ITRN_COL]?.trim();
        const can = cols[CAN_COL]?.trim();
        const name = cols[NAME_COL]?.trim();
        const fund = cols[FUND_COL]?.trim();
        const scheme = cols[SCHEME_COL]?.trim();
        const folio = cols[FOLIO_COL]?.replace(/\(.*?\)/g, "").trim();
        const rawDate = cols[DATE_COL]?.trim();
        const units = parseFloat(cols[TARGET_UNITS_COL]) || 0;
        const amount = parseAmount(cols[TARGET_AMOUNT_COL]);
        const nav = parseFloat(cols[TARGET_NAV_COL]) || 0;
        const rawNavDate = cols[TARGET_NAV_DATE_COL]?.trim();

        // Skip empty, footer, or invalid rows
        if (!can || !itrn || !name) continue;
        if (can === "CAN" || itrn === "ITRN") continue;
        if (!itrn.match(/^[A-Z0-9]+$/)) continue; // Skip non-ITRN rows like footer
        if (amount === 0 && units === 0) { skipped++; continue; }

        const txnDate = parseDate(rawDate);
        const navDate = parseDate(rawNavDate);
        const monthYear = getMonthYear(txnDate || "");

        // Check investor exists
        const { data: existingInv } = await supabase
          .from("investors")
          .select("can")
          .eq("can", can)
          .single();

        if (!existingInv) {
          if (!investorsNotFound.find(i => i.includes(can))) {
            investorsNotFound.push(`${name} (CAN: ${can})`);
          }
          skipped++;
          continue;
        }

        // Use ITRN for duplicate check
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("itrn", itrn)
          .maybeSingle();

        if (existing) {
          duplicates++;
          continue;
        }

        // Insert
        const { error: insertError } = await supabase
          .from("transactions")
          .insert({
            itrn,
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
          console.error("Insert error:", insertError.message);
          skipped++;
        } else {
          inserted++;
        }
      }

      setResults({ inserted, duplicates, skipped, investorsNotFound });
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
          <input type="password" placeholder="Enter admin password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
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
        :root { --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a; --white: #ffffff; --muted: #6b7280; --border: rgba(0,0,0,0.08); }
        body { font-family: 'DM Sans', sans-serif; background: #f0ebe0; }
        .nav { background: var(--navy); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
        .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; color: var(--gold2); }
        .nav-badge { font-size: 0.72rem; background: rgba(201,168,76,0.15); color: var(--gold); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(201,168,76,0.3); }
        .main { max-width: 760px; margin: 0 auto; padding: 2.5rem 2rem; }
        h1 { font-family: 'Cormorant Garamond', serif; font-size: 2rem; color: var(--navy); margin-bottom: 0.5rem; }
        .subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; font-weight: 300; }
        .card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 2rem; margin-bottom: 1.5rem; }
        .card h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: var(--navy); margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .drop-zone { border: 2px dashed rgba(201,168,76,0.4); border-radius: 8px; padding: 3rem 2rem; text-align: center; cursor: pointer; transition: all 0.2s; background: #faf9f6; margin-bottom: 1.25rem; }
        .drop-zone:hover { border-color: var(--gold); background: rgba(201,168,76,0.04); }
        .drop-zone.has-file { border-color: var(--gold); background: rgba(201,168,76,0.06); }
        .drop-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
        .drop-title { font-size: 1rem; font-weight: 500; color: var(--navy); margin-bottom: 0.4rem; }
        .drop-sub { font-size: 0.8rem; color: var(--muted); }
        .file-input { display: none; }
        .upload-btn { width: 100%; background: var(--navy); color: white; border: none; padding: 0.9rem; border-radius: 4px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .upload-btn:hover:not(:disabled) { background: #1a2744; }
        .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .format-note { background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.8rem; color: #92400e; margin-bottom: 1.25rem; line-height: 1.7; }
        .result-card { border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); }
        .result-title { font-size: 1rem; font-weight: 500; color: #15803d; margin-bottom: 1rem; }
        .result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .result-stat { text-align: center; background: white; border-radius: 6px; padding: 1rem; }
        .result-num { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 700; color: var(--navy); }
        .result-label { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .warn-investors { margin-top: 1rem; }
        .warn-investors h4 { font-size: 0.8rem; font-weight: 500; color: #92400e; margin-bottom: 0.5rem; }
        .warn-item { font-size: 0.82rem; color: #92400e; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.4rem; }
        .error-box { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 1rem; color: #dc2626; font-size: 0.85rem; margin-top: 1rem; }
        .instructions { font-size: 0.83rem; color: var(--muted); line-height: 1.9; }
        .instructions li { margin-bottom: 0.25rem; }
        .step-badge { display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: var(--navy); color: var(--gold2); font-size: 11px; font-weight: 500; text-align: center; line-height: 20px; margin-right: 6px; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Admin</div>
        <div className="nav-badge">Admin Panel</div>
      </nav>

      <div className="main">
        <h1>Upload Monthly Data</h1>
        <p className="subtitle">Upload your GotxReportDST CSV file to update all investor dashboards instantly.</p>

        <div className="card">
          <h2>📁 Select File</h2>
          <div className="format-note">
            ✅ Compatible with <strong>BSE StarMF GotxReportDST</strong> export<br />
            ✅ Uses <strong>ITRN</strong> for 100% accurate duplicate detection<br />
            ✅ Re-uploading same file is completely safe — no duplicates created<br />
            ⚠️ Save your XLS as <strong>CSV</strong> from Excel before uploading
          </div>

          <div
            className={`drop-zone ${file ? "has-file" : ""}`}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <div className="drop-icon">{file ? "✅" : "📂"}</div>
            <div className="drop-title">
              {file ? file.name : "Click to select your GotxReportDST CSV file"}
            </div>
            <div className="drop-sub">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · Ready to upload`
                : "Save XLS as CSV from Excel first, then upload here"}
            </div>
          </div>
          <input
            id="fileInput"
            type="file"
            accept=".csv,.txt"
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
            {uploading ? "⏳ Processing..." : "⬆️ Upload and Update Dashboards"}
          </button>

          {error && <div className="error-box">⚠️ {error}</div>}

          {results && (
            <div className="result-card">
              <div className="result-title">✅ Upload Complete!</div>
              <div className="result-grid">
                <div className="result-stat">
                  <div className="result-num">{results.inserted}</div>
                  <div className="result-label">New transactions added</div>
                </div>
                <div className="result-stat">
                  <div className="result-num">{results.duplicates}</div>
                  <div className="result-label">Already existed</div>
                </div>
                <div className="result-stat">
                  <div className="result-num">{results.skipped}</div>
                  <div className="result-label">Rows skipped</div>
                </div>
              </div>
              {results.investorsNotFound.length > 0 && (
                <div className="warn-investors">
                  <h4>⚠️ New investors found — create their login accounts:</h4>
                  {results.investorsNotFound.map((inv: string, i: number) => (
                    <div className="warn-item" key={i}>👤 {inv}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>📋 Monthly workflow</h2>
          <ol className="instructions" style={{ paddingLeft: "1rem" }}>
            <li><span className="step-badge">1</span>Login to <strong>BSE StarMF</strong> → Reports → Processed Transaction (GotxReportDST)</li>
            <li><span className="step-badge">2</span>Select date range → Export as <strong>XLS</strong></li>
            <li><span className="step-badge">3</span>Open in Excel → File → Save As → <strong>CSV (Comma delimited)</strong></li>
            <li><span className="step-badge">4</span>Come here → Upload that CSV file</li>
            <li><span className="step-badge">5</span>All investor dashboards update instantly ✅</li>
          </ol>
        </div>
      </div>
    </>
  );
}
