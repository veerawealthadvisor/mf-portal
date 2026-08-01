"use client";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import * as XLSX from "xlsx";

// ── Keep this in sync with lib/navHelper.ts SCHEME_CODE_OVERRIDES ──
const HARDCODED_SCHEMES = new Set([
  "axis nifty 100 index fund regular growth",
  "axis short duration fund - growth",
  "axis small cap fund growth",
  "axis treasury advantage fund - growth",
  "bandhan low duration fund-growth-(regular plan)",
  "bandhan money market fund--growth-(regular plan)",
  "bandhan small cap fund regular plan-growth",
  "edelweiss nifty midcap150 momentum 50 index fund- regular plan growth - growth",
  "hdfc large and mid cap fund- regular plan-growth",
  "icici prudential banking and financial services fund - regular plan - growth",
  "icici prudential nifty bank index fund - growth",
  "icici prudential ultra short term fund-regular-growth",
  "kotak small cap fund - growth",
  "motilal oswal digital india fund regular growth",
  "motilal oswal midcap fund - regular plan growth",
  "nippon india growth mid cap fund - growth plan growth option",
  "parag parikh flexi cap fund-regular-growth",
  // ── New funds added July 2026 ──
  "invesco india ultra short duration fund - regular plan - growth",
  "kotak midcap fund -growth",
  "motilal oswal ultra short term fund regular growth",
  "nippon india banking & financial services fund growth plan growth option",
  "nippon india ultra short duration fund - growth option",
  "parag parikh arbitrage fund - regular plan growth",
  // ── New funds added August 2026 ──
  "invesco india low duration fund growth",
"invesco india midcap fund - regular plan - growth",
"invesco india smallcap fund - regular plan - growth",
"invesco india small cap fund regular growth",
"tata digital india fund regular plan growth",
"tata ethical fund regular plan - growth",
"tata short term bond fund regular plan - growth",
"tata ultra short term fund - regular plan - growth",
]);

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [progress, setProgress] = useState("");

  const ADMIN_PASSWORD = "veerakarthik2024";

  const handleAuth = () => {
    if (password === ADMIN_PASSWORD) setAuthenticated(true);
    else setError("Incorrect admin password");
  };

  const parseDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split("T")[0];
    const s = String(val).trim();
    const mmddyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2,"0")}-${mmddyyyy[2].padStart(2,"0")}`;
    const ddmmyyyy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,"0")}-${ddmmyyyy[1].padStart(2,"0")}`;
    const ddmonyyyy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (ddmonyyyy) {
      const months: any = {Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12"};
      return `${ddmonyyyy[3]}-${months[ddmonyyyy[2]]||"01"}-${ddmonyyyy[1].padStart(2,"0")}`;
    }
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
    return null;
  };

  const getMonthYear = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  };

  // ── Detect new funds not in the hardcoded map ──
 const normalize = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/–/g, "-").replace(/[^\x20-\x7E]/g, "");

const detectNewFunds = (rows1: any[], rows2: any[]): string[] => {
  const allSchemes = new Set<string>();
  [...rows1, ...rows2].forEach((row) => {
    const scheme = String(row["RTA Scheme Name"] || "").trim();
    if (scheme) allSchemes.add(scheme);
  });
  const newFunds: string[] = [];
  allSchemes.forEach((scheme) => {
    if (!HARDCODED_SCHEMES.has(normalize(scheme))) {
      newFunds.push(scheme);
    }
  });
  return newFunds.sort();
};

  const processSheet1 = async (rows: any[]) => {
    let inserted = 0, duplicates = 0, skipped = 0, rejected = 0;
    const investorsNotFound: string[] = [];
    for (const row of rows) {
      const utrn = String(row["UTRN"]||"").trim();
      const can = String(row["CAN"]||"").trim();
      const name = String(row["Primary Holder Name"]||"").trim();
      const fund = String(row["Fund Name"]||"").trim();
      const scheme = String(row["RTA Scheme Name"]||"").trim();
      const folio = String(row["Folio Number"]||"").trim();
      const txnType = String(row["Transaction Type"]||"").trim().toLowerCase();
      const status = String(row["Transaction Status"]||"").trim().toLowerCase();
      const responseAmount = parseFloat(row["Response Amount"])||0;
      const responseUnits = parseFloat(row["Response Units"])||0;
      const nav = parseFloat(row["Price"])||0;
      const valueDate = parseDate(row["Value Date"]);
      if (!can||!utrn||!name) continue;
      if (!status.includes("rta processed")) { rejected++; continue; }
      if (responseUnits===0) { skipped++; continue; }
      const isSIP = txnType.includes("sip") && !txnType.includes("cancel");
      const isRedemption = txnType.includes("redeem");
      const finalUnits = isRedemption ? -Math.abs(responseUnits) : responseUnits;
      const finalAmount = isRedemption ? -Math.abs(responseAmount) : responseAmount;
      const monthYear = getMonthYear(valueDate);
      const { data: existingInv } = await supabase.from("investors").select("can").eq("can",can).single();
      if (!existingInv) {
        if (!investorsNotFound.find(i=>i.includes(can))) investorsNotFound.push(`${name} (CAN: ${can})`);
        skipped++; continue;
      }
      const { data: existing } = await supabase.from("transactions").select("id").eq("itrn",utrn).maybeSingle();
      if (existing) { duplicates++; continue; }
      const { error: insertError } = await supabase.from("transactions").insert({
        itrn:utrn, can, fund_name:fund, scheme_name:scheme,
        folio_no:folio, amount:finalAmount, units:finalUnits,
        nav, nav_date:valueDate, transaction_date:valueDate,
        month_year:monthYear,
        txn_type: isSIP?"sip":isRedemption?"redemption":"purchase",
        instalment_no: isSIP?1:null,
      });
      if (insertError) { console.error("S1 insert error:",insertError.message); skipped++; }
      else inserted++;
    }
    return { inserted, duplicates, skipped, rejected, investorsNotFound };
  };

  const processSheet2 = async (rows: any[]) => {
    let inserted = 0, duplicates = 0, skipped = 0, rejected = 0;
    const investorsNotFound: string[] = [];
    for (const row of rows) {
      const utrn = String(row["UTRN"]||"").trim();
      const can = String(row["CAN"]||"").trim();
      const name = String(row["Primary Holder Name"]||"").trim();
      const fund = String(row["Fund Name"]||"").trim();
      const scheme = String(row["RTA Scheme Name"]||"").trim();
      const folio = String(row["Folio Number"]||"").trim();
      const status = String(row["Transaction Status"]||"").trim().toLowerCase();
      const responseAmount = parseFloat(row["Response Amount"])||0;
      const responseUnits = parseFloat(row["Response Units"])||0;
      const nav = parseFloat(row["Price"])||0;
      const valueDate = parseDate(row["Value Date"]);
      const instalmentNo = parseInt(row["Instalment \nNo"]||row["Instalment No"]||"0")||null;
      const amount = parseFloat(row["Amount"])||0;
      if (!can||!utrn||!name) continue;
      if (!status.includes("rta processed")) { rejected++; continue; }
      if (responseUnits===0) { skipped++; continue; }
      const monthYear = getMonthYear(valueDate);
      const { data: existingInv } = await supabase.from("investors").select("can").eq("can",can).single();
      if (!existingInv) {
        if (!investorsNotFound.find(i=>i.includes(can))) investorsNotFound.push(`${name} (CAN: ${can})`);
        skipped++; continue;
      }
      const { data: existing } = await supabase.from("transactions").select("id").eq("itrn",utrn).maybeSingle();
      if (existing) { duplicates++; continue; }
      const { error: insertError } = await supabase.from("transactions").insert({
        itrn:utrn, can, fund_name:fund, scheme_name:scheme,
        folio_no:folio, amount:responseAmount||amount,
        units:responseUnits, nav, nav_date:valueDate,
        transaction_date:valueDate, month_year:monthYear,
        txn_type:"sip", instalment_no:instalmentNo,
      });
      if (insertError) { console.error("S2 insert error:",insertError.message); skipped++; }
      else inserted++;
    }
    return { inserted, duplicates, skipped, rejected, investorsNotFound };
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResults(null);
    setProgress("");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type:"array", cellDates:true });
      const sheetNames = workbook.SheetNames;
      let s1Result = { inserted:0, duplicates:0, skipped:0, rejected:0, investorsNotFound:[] as string[] };
      let s2Result = { inserted:0, duplicates:0, skipped:0, rejected:0, investorsNotFound:[] as string[] };
      let rows1: any[] = [], rows2: any[] = [];

      const txnSheet = workbook.Sheets[sheetNames[0]];
      if (txnSheet) {
        setProgress("Processing Sheet 1 — Transactions...");
        rows1 = XLSX.utils.sheet_to_json(txnSheet, { range:2, defval:"" });
        s1Result = await processSheet1(rows1);
      }
      if (sheetNames.length > 1) {
        const sipSheet = workbook.Sheets[sheetNames[1]];
        if (sipSheet) {
          setProgress("Processing Sheet 2 — SIP Instalments...");
          rows2 = XLSX.utils.sheet_to_json(sipSheet, { range:2, defval:"" });
          s2Result = await processSheet2(rows2);
        }
      }

      // ── Detect new funds not in hardcoded map ──
      const newFunds = detectNewFunds(rows1, rows2);
      const allInvestorsNotFound = [...new Set([...s1Result.investorsNotFound, ...s2Result.investorsNotFound])];

      setResults({
        sheet1: s1Result,
        sheet2: s2Result,
        total: {
          inserted: s1Result.inserted + s2Result.inserted,
          duplicates: s1Result.duplicates + s2Result.duplicates,
          rejected: s1Result.rejected + s2Result.rejected,
          skipped: s1Result.skipped + s2Result.skipped,
        },
        investorsNotFound: allInvestorsNotFound,
        sheetsFound: sheetNames.length,
        newFunds, // ← new funds needing hardcoding
      });
    } catch (err: any) {
      setError("Something went wrong: " + err.message);
      console.error(err);
    }
    setProgress("");
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
            onKeyDown={(e) => e.key==="Enter" && handleAuth()} />
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
        .nav-right { display: flex; gap: 1rem; align-items: center; }
        .nav-badge { font-size: 0.72rem; background: rgba(201,168,76,0.15); color: var(--gold); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(201,168,76,0.3); }
        .nav-btn { background: transparent; border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 0.4rem 1rem; border-radius: 2px; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .nav-btn:hover { background: var(--gold); color: var(--navy); }
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
        .progress { background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.2); border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.82rem; color: #92400e; margin-top: 1rem; text-align: center; }
        .result-card { border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); }
        .result-title { font-size: 1rem; font-weight: 500; color: #15803d; margin-bottom: 1rem; }
        .result-total { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
        .result-stat { text-align: center; background: white; border-radius: 6px; padding: 0.85rem; }
        .result-num { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; font-weight: 700; color: var(--navy); }
        .result-label { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }
        .sheet-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .sheet-card { background: white; border-radius: 6px; padding: 0.85rem 1rem; border: 1px solid var(--border); }
        .sheet-title { font-size: 0.75rem; font-weight: 500; color: var(--navy); margin-bottom: 0.5rem; }
        .sheet-stat { font-size: 0.72rem; color: var(--muted); display: flex; justify-content: space-between; padding: 2px 0; }
        .sheet-stat span:last-child { font-weight: 500; color: var(--navy); }
        .warn-investors { margin-top: 1rem; }
        .warn-investors h4 { font-size: 0.8rem; font-weight: 500; color: #92400e; margin-bottom: 0.5rem; }
        .warn-item { font-size: 0.82rem; color: #92400e; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.4rem; }
        .new-fund-box { margin-top: 1rem; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 1rem 1.25rem; }
        .new-fund-title { font-size: 0.85rem; font-weight: 600; color: #dc2626; margin-bottom: 0.75rem; }
        .new-fund-desc { font-size: 0.78rem; color: #6b7280; margin-bottom: 0.75rem; line-height: 1.6; }
        .new-fund-item { font-size: 0.8rem; color: #dc2626; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.4rem; font-family: monospace; }
        .new-fund-steps { font-size: 0.78rem; color: #374151; background: white; border-radius: 6px; padding: 0.75rem 1rem; margin-top: 0.75rem; line-height: 1.9; border: 1px solid var(--border); }
        .error-box { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 1rem; color: #dc2626; font-size: 0.85rem; margin-top: 1rem; }
        .instructions { font-size: 0.83rem; color: var(--muted); line-height: 1.9; }
        .instructions li { margin-bottom: 0.25rem; }
        .step-badge { display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: var(--navy); color: var(--gold2); font-size: 11px; font-weight: 500; text-align: center; line-height: 20px; margin-right: 6px; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Admin</div>
        <div className="nav-right">
          <a href="/admin/dashboard" className="nav-btn">← Dashboard</a>
          <span className="nav-badge">Admin Panel</span>
        </div>
      </nav>

      <div className="main">
        <h1>Upload Monthly Data</h1>
        <p className="subtitle">Upload your XLSX report directly — both sheets processed automatically.</p>

        <div className="card">
          <h2>📁 Select XLSX File</h2>
          <div className="format-note">
            ✅ Upload the <strong>XLSX file directly</strong> — no need to convert to CSV!<br />
            ✅ <strong>Sheet 1</strong> (Transaction Report) — purchases and redemptions<br />
            ✅ <strong>Sheet 2</strong> (Systematic Instalment Report) — all SIP instalments<br />
            ✅ Only <strong>RTA Processed</strong> transactions imported — failed/rejected automatically skipped<br />
            ✅ UTRN-based duplicate protection — safe to re-upload same file
          </div>

          <div className={`drop-zone ${file ? "has-file" : ""}`}
            onClick={() => document.getElementById("fileInput")?.click()}>
            <div className="drop-icon">{file ? "✅" : "📊"}</div>
            <div className="drop-title">{file ? file.name : "Click to select your XLSX report"}</div>
            <div className="drop-sub">
              {file ? `${(file.size/1024).toFixed(1)} KB · Ready to upload`
                : "TransactEezz monthly report (.xlsx) — both sheets will be processed"}
            </div>
          </div>
          <input id="fileInput" type="file" accept=".xlsx,.xls" className="file-input"
            onChange={(e) => { setFile(e.target.files?.[0]||null); setResults(null); setError(""); }} />

          <button className="upload-btn" onClick={handleUpload} disabled={!file||uploading}>
            {uploading ? "⏳ Processing both sheets..." : "⬆️ Upload and Update Dashboards"}
          </button>

          {progress && <div className="progress">⏳ {progress}</div>}
          {error && <div className="error-box">⚠️ {error}</div>}

          {results && (
            <div className="result-card">
              <div className="result-title">
                ✅ Upload Complete — {results.sheetsFound} sheet{results.sheetsFound > 1 ? "s" : ""} processed
              </div>

              <div className="result-total">
                <div className="result-stat">
                  <div className="result-num">{results.total.inserted}</div>
                  <div className="result-label">Total added</div>
                </div>
                <div className="result-stat">
                  <div className="result-num">{results.total.duplicates}</div>
                  <div className="result-label">Already existed</div>
                </div>
                <div className="result-stat">
                  <div className="result-num">{results.total.rejected}</div>
                  <div className="result-label">Failed/rejected</div>
                </div>
                <div className="result-stat">
                  <div className="result-num">{results.total.skipped}</div>
                  <div className="result-label">Skipped</div>
                </div>
              </div>

              <div className="sheet-breakdown">
                <div className="sheet-card">
                  <div className="sheet-title">📋 Sheet 1 — Transactions</div>
                  <div className="sheet-stat"><span>Added</span><span>{results.sheet1.inserted}</span></div>
                  <div className="sheet-stat"><span>Duplicates</span><span>{results.sheet1.duplicates}</span></div>
                  <div className="sheet-stat"><span>Rejected/failed</span><span>{results.sheet1.rejected}</span></div>
                </div>
                <div className="sheet-card">
                  <div className="sheet-title">🔄 Sheet 2 — SIP Instalments</div>
                  <div className="sheet-stat"><span>Added</span><span>{results.sheet2.inserted}</span></div>
                  <div className="sheet-stat"><span>Duplicates</span><span>{results.sheet2.duplicates}</span></div>
                  <div className="sheet-stat"><span>Rejected/failed</span><span>{results.sheet2.rejected}</span></div>
                </div>
              </div>

              {/* ── New investors warning ── */}
              {results.investorsNotFound.length > 0 && (
                <div className="warn-investors">
                  <h4>⚠️ New investors found — create their login accounts in Supabase → Authentication → Users:</h4>
                  {results.investorsNotFound.map((inv: string, i: number) => (
                    <div className="warn-item" key={i}>👤 {inv}</div>
                  ))}
                </div>
              )}

              {/* ── New funds warning ── */}
              {results.newFunds && results.newFunds.length > 0 && (
                <div className="new-fund-box">
                  <div className="new-fund-title">
                    🔴 {results.newFunds.length} New Fund{results.newFunds.length > 1 ? "s" : ""} Detected — NAV Hardcoding Required
                  </div>
                  <div className="new-fund-desc">
                    These funds are not in your hardcoded scheme map. NAV will use fuzzy search (less accurate).
                    To ensure correct NAV, add their scheme codes to <code>lib/navHelper.ts</code>.
                  </div>
                  {results.newFunds.map((f: string, i: number) => (
                    <div className="new-fund-item" key={i}>⚠️ {f}</div>
                  ))}
                  <div className="new-fund-steps">
                    <strong>How to fix:</strong><br />
                    1. Open <code>https://api.mfapi.in/mf/search?q=&lt;fund name first 4 words&gt;</code> in browser<br />
                    2. Find the matching Regular Plan Growth entry → note the <code>schemeCode</code><br />
                    3. Add to <code>SCHEME_CODE_OVERRIDES</code> in <code>lib/navHelper.ts</code><br />
                    4. Also add the same entry to <code>HARDCODED_SCHEMES</code> in <code>app/admin/upload/page.tsx</code><br />
                    5. Deploy → NAV will be accurate from next load
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>📋 Monthly workflow</h2>
          <ol className="instructions" style={{ paddingLeft:"1rem" }}>
            <li><span className="step-badge">1</span>Login to <strong>TransactEezz / BSE StarMF</strong> → Reports → Transaction Report</li>
            <li><span className="step-badge">2</span>Select date range → Export as <strong>XLSX</strong></li>
            <li><span className="step-badge">3</span>Upload the <strong>XLSX file directly here</strong> — no conversion needed!</li>
            <li><span className="step-badge">4</span>Both sheets processed automatically — all dashboards update instantly ✅</li>
            <li><span className="step-badge">5</span>If new investors appear, create their login in Supabase → Authentication → Users</li>
            <li><span className="step-badge">6</span>If new funds appear (red warning), add their scheme codes to navHelper.ts</li>
          </ol>
        </div>
      </div>
    </>
  );
}
