"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { getLiveNAV } from "../../lib/navHelper";
import { useRouter } from "next/navigation";
import { useSessionGuard } from "../../lib/sessionGuard";

// ── HARDWIRED FUND CLASSIFICATION ──────────────────────────────────────────
// Keyed by lowercase scheme name — must match scheme_name in transactions table
const FUND_CLASSIFICATION: Record<string, { type: "equity" | "debt"; subtype: string }> = {
  "axis nifty 100 index fund regular growth":                                        { type: "equity", subtype: "Large Cap" },
  "axis short duration fund - growth":                                               { type: "debt",   subtype: "Debt" },
  "axis small cap fund growth":                                                      { type: "equity", subtype: "Small Cap" },
  "axis treasury advantage fund - growth":                                           { type: "debt",   subtype: "Debt" },
  "bandhan low duration fund-growth-(regular plan)":                                 { type: "debt",   subtype: "Debt" },
  "bandhan money market fund--growth-(regular plan)":                                { type: "debt",   subtype: "Debt" },
  "bandhan small cap fund regular plan-growth":                                      { type: "equity", subtype: "Small Cap" },
  "edelweiss nifty midcap150 momentum 50 index fund- regular plan growth - growth": { type: "equity", subtype: "Mid Cap" },
  "hdfc large and mid cap fund- regular plan-growth":                                { type: "equity", subtype: "Large & Mid Cap" },
  "icici prudential banking and financial services fund - regular plan - growth":    { type: "equity", subtype: "Sectoral" },
  "icici prudential nifty bank index fund - growth":                                 { type: "equity", subtype: "Sectoral" },
  "icici prudential ultra short term fund-regular-growth":                           { type: "debt",   subtype: "Debt" },
  "kotak small cap fund - growth":                                                   { type: "equity", subtype: "Small Cap" },
  "motilal oswal digital india fund regular growth":                                 { type: "equity", subtype: "Sectoral" },
  "motilal oswal midcap fund - regular plan growth":                                 { type: "equity", subtype: "Mid Cap" },
  "nippon india growth mid cap fund - growth plan growth option":                    { type: "equity", subtype: "Mid Cap" },
  "parag parikh flexi cap fund-regular-growth":                                      { type: "equity", subtype: "Flexi Cap" },
};

function classifyFund(schemeName: string): { type: "equity" | "debt"; subtype: string } {
  const key = schemeName.toLowerCase().trim();
  if (FUND_CLASSIFICATION[key]) return FUND_CLASSIFICATION[key];

  // Fallback for any new fund not yet hardcoded — log so you know to add it
  console.warn(`[classifyFund] Unknown scheme — defaulting to equity: "${schemeName}"`);
  return { type: "equity", subtype: "Equity" };
}

const EQUITY_COLORS: Record<string, string> = {
  "Large Cap":       "#1e40af",
  "Large & Mid Cap": "#3b82f6",
  "Mid Cap":         "#7c3aed",
  "Small Cap":       "#dc2626",
  "Flexi Cap":       "#c9a84c",
  "ELSS":            "#16a34a",
  "Sectoral":        "#ea580c",
  "Hybrid Equity":   "#0891b2",
  "Equity":          "#6366f1",
};

function DonutChart({ data, centerLabel, centerValue, size = 160 }: any) {
  const total = data.reduce((s: number, d: any) => s + d.value, 0);
  if (total === 0) return <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center", padding: "2rem 0" }}>No data</p>;

  let cumAngle = -90;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38, inner = size * 0.24;
  const gap = 1.5;

  const slices = data.map((d: any) => {
    const angle = (d.value / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    const end = cumAngle;
    const startRad = (start * Math.PI) / 180;
    const endRad = ((end - gap) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const xi1 = cx + inner * Math.cos(startRad);
    const yi1 = cy + inner * Math.sin(startRad);
    const xi2 = cx + inner * Math.cos(endRad);
    const yi2 = cy + inner * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${largeArc} 0 ${xi1} ${yi1} Z`;
    return { ...d, path, pct: ((d.value / total) * 100).toFixed(1) };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {slices.map((s: any, i: number) => (
          <path key={i} d={s.path} fill={s.color} opacity={0.9}>
            <title>{s.label}: ₹{s.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({s.pct}%)</title>
          </path>
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={size * 0.08} fontWeight="600" fill="#0a1628" fontFamily="Cormorant Garamond, serif">{centerLabel}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={size * 0.072} fill="#6b7280" fontFamily="DM Sans, sans-serif">{centerValue}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 120 }}>
        {slices.map((s: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", borderBottom: "0.5px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: "#374151" }}>{s.label}</span>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#0a1628" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  useSessionGuard(router);
  const [investor, setInvestor] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [navLoading, setNavLoading] = useState(false);
  const [firstTxnDate, setFirstTxnDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: inv } = await supabase
        .from("investors")
        .select("*")
        .eq("email", user.email)
        .single();

      if (inv) {
          if (inv.is_admin) {
    router.push("/admin/dashboard");
    return;
  }
        setInvestor(inv);
        const { data: txns } = await supabase
          .from("transactions")
          .select("*")
          .eq("can", inv.can)
          .order("transaction_date", { ascending: true });

        const txnList = txns || [];
        setTransactions([...txnList].reverse());
        if (txnList.length > 0) setFirstTxnDate(txnList[0].transaction_date);

        const fundMap: any = {};
        txnList.forEach((t: any) => {
          const key = t.scheme_name;
          if (!fundMap[key]) {
            fundMap[key] = { scheme: t.scheme_name, fund: t.fund_name, amount: 0, units: 0, firstDate: t.transaction_date, currentNAV: null, currentValue: null, navDate: null, gain: null, gainPct: null };
          }
          fundMap[key].amount += parseFloat(t.amount) || 0;
          fundMap[key].units += parseFloat(t.units) || 0;
        });

        const fundList = Object.values(fundMap);
        setFunds(fundList);
        setLoading(false);

        setNavLoading(true);
        const updated = await Promise.all(
          fundList.map(async (f: any) => {
            const navData = await getLiveNAV(f.scheme);
            if (navData) {
              const currentValue = f.units * navData.nav;
              const gain = currentValue - f.amount;
              const gainPct = (gain / f.amount) * 100;
              return { ...f, currentNAV: navData.nav, currentValue, navDate: navData.date, gain, gainPct };
            }
            return f;
          })
        );
        setFunds(updated);
        setNavLoading(false);
      } else {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const totalInvested = funds.reduce((s, f) => s + f.amount, 0);
  const totalCurrent = funds.reduce((s, f) => s + (f.currentValue || f.amount), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const calcCAGR = () => {
    if (!firstTxnDate || totalInvested === 0 || navLoading) return null;
    const start = new Date(firstTxnDate);
    const today = new Date();
    const years = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years < 0.08) return null;
    return (Math.pow(totalCurrent / totalInvested, 1 / years) - 1) * 100;
  };
  const cagr = calcCAGR();

  // Equity vs Debt split
  let equityValue = 0, debtValue = 0;
  const equitySubMap: any = {};
  funds.forEach((f: any) => {
    const val = f.currentValue || f.amount;
    const { type, subtype } = classifyFund(f.scheme);
    if (type === "debt") {
      debtValue += val;
    } else {
      equityValue += val;
      if (!equitySubMap[subtype]) equitySubMap[subtype] = 0;
      equitySubMap[subtype] += val;
    }
  });

  const equityDebtData = [
    { label: "Equity", value: equityValue, color: "#c9a84c" },
    { label: "Debt", value: debtValue, color: "#0a1628" },
  ].filter(d => d.value > 0);

  const equitySubData = Object.entries(equitySubMap).map(([label, value]: any) => ({
    label,
    value,
    color: EQUITY_COLORS[label] || "#6366f1",
  }));

  // Portfolio insight
  const equityPct = totalCurrent > 0 ? (equityValue / totalCurrent) * 100 : 0;
  const getInsight = () => {
    if (equityPct >= 80) return { label: "🚀 Growth Oriented", desc: "High equity exposure — suited for long-term wealth creation", color: "#16a34a" };
    if (equityPct >= 50) return { label: "⚖️ Balanced Portfolio", desc: "Mix of equity and debt — moderate risk and stable returns", color: "#c9a84c" };
    return { label: "🛡️ Capital Preservation", desc: "High debt exposure — focused on stability and low risk", color: "#1e40af" };
  };
  const insight = getInsight();

  const monthMap: any = {};
  transactions.forEach((t: any) => {
    const m = t.month_year || (t.transaction_date ? t.transaction_date.slice(0, 7) : "Unknown");
    if (!monthMap[m]) monthMap[m] = 0;
    monthMap[m] += parseFloat(t.amount) || 0;
  });
  const months = Object.entries(monthMap).sort();
  const maxMonthVal = Math.max(...months.map(([, v]: any) => v), 1);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628", color: "#e8c97a", fontFamily: "DM Sans, sans-serif" }}>
      Loading your portfolio...
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a; --white: #ffffff; --muted: #6b7280; --border: rgba(0,0,0,0.08); --green: #16a34a; --red: #dc2626; }
        body { font-family: 'DM Sans', sans-serif; background: #f0ebe0; }
        .dash-nav { background: var(--navy); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(201,168,76,0.2); position: sticky; top: 0; z-index: 50; }
        .dash-nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 700; color: var(--gold2); }
        .dash-nav-right { display: flex; align-items: center; gap: 1.5rem; }
        .investor-name { font-size: 0.85rem; color: rgba(255,255,255,0.6); }
        .logout-btn { background: transparent; border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 0.4rem 1rem; border-radius: 2px; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .logout-btn:hover { background: var(--gold); color: var(--navy); }
        .dash-main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
        .welcome { margin-bottom: 2rem; }
        .welcome h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; font-weight: 700; color: var(--navy); margin-bottom: 0.25rem; }
        .welcome p { font-size: 0.85rem; color: var(--muted); }
        .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem 1.5rem; }
        .stat-card.navy { background: var(--navy); }
        .stat-card.cagr { background: linear-gradient(135deg, #0a1628, #1a3a5c); border: 1px solid rgba(201,168,76,0.3); }
        .stat-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .stat-card.navy .stat-label, .stat-card.cagr .stat-label { color: rgba(255,255,255,0.45); }
        .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 700; color: var(--navy); line-height: 1; }
        .stat-card.navy .stat-value { color: var(--gold2); }
        .stat-card.cagr .stat-value { color: var(--gold2); font-size: 1.8rem; }
        .stat-sub { font-size: 0.7rem; color: var(--muted); margin-top: 0.4rem; }
        .stat-card.navy .stat-sub, .stat-card.cagr .stat-sub { color: rgba(255,255,255,0.35); }
        .gain-positive { color: var(--green) !important; }
        .gain-negative { color: var(--red) !important; }
        .nav-loading { font-size: 0.72rem; color: var(--gold); background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.2); padding: 0.4rem 1rem; border-radius: 10px; display: inline-block; margin-bottom: 1rem; }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
        .section-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; }
        .section-card h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 700; color: var(--navy); margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .insight-badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.4rem 0.85rem; border-radius: 20px; font-size: 0.78rem; font-weight: 500; margin-bottom: 1rem; }
        .insight-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.6; margin-bottom: 1.25rem; }
        .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 140px; }
        .chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .chart-bar { width: 100%; background: var(--gold); border-radius: 3px 3px 0 0; transition: all 0.3s; min-height: 4px; }
        .chart-bar:hover { background: var(--gold2); }
        .chart-label { font-size: 10px; color: var(--muted); text-align: center; }
        .chart-val { font-size: 9px; color: var(--muted); }
        .no-data { color: var(--muted); font-size: 0.85rem; text-align: center; padding: 2rem 0; }
        .fund-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .fund-table th { text-align: left; padding: 0.5rem 0.6rem; font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); font-weight: 400; }
        .fund-table td { padding: 0.7rem 0.6rem; border-bottom: 1px solid rgba(0,0,0,0.04); vertical-align: middle; }
        .fund-table tr:last-child td { border-bottom: none; }
        .fund-table tr:hover td { background: rgba(201,168,76,0.03); }
        .fund-name-cell { font-weight: 500; color: var(--navy); font-size: 0.8rem; line-height: 1.4; }
        .fund-amc { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }
        .fund-type-badge { display: inline-block; font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; margin-top: 2px; }
        .amount-val { font-weight: 500; color: var(--navy); }
        .gain-badge { display: inline-block; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
        .gain-badge.pos { background: rgba(22,163,74,0.1); color: var(--green); }
        .gain-badge.neg { background: rgba(220,38,38,0.1); color: var(--red); }
        .loading-nav { font-size: 0.72rem; color: var(--gold); }
        .txn-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .txn-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: #faf9f6; border-radius: 6px; border: 1px solid rgba(0,0,0,0.04); }
        .txn-left { flex: 1; }
        .txn-scheme { font-size: 0.8rem; font-weight: 500; color: var(--navy); line-height: 1.4; }
        .txn-date { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }
        .txn-right { text-align: right; }
        .txn-amount { font-size: 0.88rem; font-weight: 500; color: var(--navy); }
        .txn-units { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }
        .full-width { margin-bottom: 1.5rem; }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dash-grid { grid-template-columns: 1fr; }
          .dash-main { padding: 1rem; }
        }
      `}</style>

      <nav className="dash-nav">
        <div className="dash-nav-logo">Veera Karthik · Investor Portal</div>
        <div className="dash-nav-right">
  <span className="investor-name">👤 {investor?.name || "Investor"}</span>
  <button className="logout-btn" onClick={() => router.push("/goals")}>🎯 Goals</button>
  <button className="logout-btn" onClick={() => router.push("/calculators")}>Calculators</button>
  <button className="logout-btn" onClick={handleLogout}>Logout</button>
</div>
      </nav>

      <div className="dash-main">
        <div className="welcome">
          <h2>Welcome, {investor?.name?.split(" ")[0] || "Investor"} 👋</h2>
          <p>Live portfolio · CAN: {investor?.can} · NAVs updated daily from AMFI</p>
<p style={{fontSize:"0.75rem", color:"#c9a84c", marginTop:"0.4rem", background:"rgba(201,168,76,0.08)", padding:"0.4rem 0.85rem", borderRadius:"4px", display:"inline-block"}}>
  📋 Unit purchases and redemptions are updated in the first week of every month
</p>
        </div>

        {navLoading && <div className="nav-loading">⏳ Fetching live NAVs from AMFI...</div>}

        {/* STAT CARDS */}
        <div className="stats-grid">
          <div className="stat-card navy">
            <div className="stat-label">Total Invested</div>
            <div className="stat-value">₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            <div className="stat-sub">Amount put in</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Value</div>
            <div className="stat-value">₹{totalCurrent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            <div className="stat-sub">{navLoading ? "Fetching..." : "As of today"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Gain / Loss</div>
            <div className={`stat-value ${totalGain >= 0 ? "gain-positive" : "gain-negative"}`}>
              {totalGain >= 0 ? "+" : ""}₹{Math.abs(totalGain).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="stat-sub">{totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(2)}% overall</div>
          </div>
          <div className="stat-card cagr">
            <div className="stat-label">Portfolio CAGR</div>
            <div className={`stat-value ${cagr === null ? "" : cagr >= 0 ? "gain-positive" : "gain-negative"}`}>
              {cagr === null ? (navLoading ? "..." : "—") : `${cagr >= 0 ? "+" : ""}${cagr.toFixed(2)}%`}
            </div>
            <div className="stat-sub" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>
              {cagr === null ? "Need more history" : `Since ${firstTxnDate}`}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Funds</div>
            <div className="stat-value">{funds.length}</div>
            <div className="stat-sub">{transactions.length} transactions</div>
          </div>
        </div>

        {/* PORTFOLIO INSIGHTS ROW */}
        <div className="dash-grid">
          {/* Equity vs Debt */}
          <div className="section-card">
            <h3>📊 Equity vs Debt</h3>
            <div className="insight-badge" style={{ background: `${insight.color}18`, color: insight.color }}>
              {insight.label}
            </div>
            <p className="insight-desc">{insight.desc}</p>
            <DonutChart
              data={equityDebtData}
              centerLabel={`${equityPct.toFixed(0)}%`}
              centerValue="Equity"
              size={160}
            />
          </div>

          {/* Equity Exposure */}
          <div className="section-card">
            <h3>🎯 Equity Exposure</h3>
            {equitySubData.length === 0 ? (
              <p className="no-data">No equity funds</p>
            ) : (
              <>
                <p className="insight-desc">Breakdown of your equity investments by market cap and category</p>
                <DonutChart
                  data={equitySubData}
                  centerLabel="Equity"
                  centerValue="Mix"
                  size={160}
                />
              </>
            )}
          </div>
        </div>

        {/* CHART + FUND TABLE */}
        <div className="dash-grid">
          <div className="section-card">
            <h3>📈 Monthly Investment</h3>
            {months.length === 0 ? (
              <p className="no-data">No data yet</p>
            ) : (
              <div className="chart-bars">
                {months.map(([month, val]: any) => (
                  <div className="chart-bar-wrap" key={month}>
                    <div className="chart-val">₹{(val / 1000).toFixed(0)}k</div>
                    <div className="chart-bar" style={{ height: `${(val / maxMonthVal) * 110}px` }} title={`₹${val.toLocaleString("en-IN")}`} />
                    <div className="chart-label">{month.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-card">
            <h3>💼 Fund Breakdown</h3>
            {funds.length === 0 ? (
              <p className="no-data">No funds yet</p>
            ) : (
              <table className="fund-table">
                <thead>
                  <tr><th>Scheme</th><th>Invested</th><th>Curr. Value</th><th>Return</th></tr>
                </thead>
                <tbody>
                  {funds.map((f: any, i) => {
                    const { type, subtype } = classifyFund(f.scheme);
                    return (
                      <tr key={i}>
                        <td>
                          <div className="fund-name-cell">{f.scheme?.length > 28 ? f.scheme.slice(0, 28) + "…" : f.scheme}</div>
                          <div className="fund-amc">{f.fund}</div>
                          <div className="fund-type-badge" style={{ background: type === "equity" ? "rgba(201,168,76,0.12)" : "rgba(10,22,40,0.08)", color: type === "equity" ? "#92400e" : "#374151" }}>
                            {subtype}
                          </div>
                        </td>
                        <td><span className="amount-val">₹{f.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></td>
                        <td>
                          {f.currentValue
                            ? <span className="amount-val">₹{f.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                            : <span className="loading-nav">{navLoading ? "..." : "N/A"}</span>}
                        </td>
                        <td>
                          {f.gain !== null
                            ? <span className={`gain-badge ${f.gain >= 0 ? "pos" : "neg"}`}>{f.gain >= 0 ? "+" : ""}{f.gainPct?.toFixed(1)}%</span>
                            : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div className="section-card full-width">
          <h3>🧾 Recent Transactions</h3>
          {transactions.length === 0 ? (
            <p className="no-data">No transactions yet</p>
          ) : (
            <div className="txn-list">
              {transactions.slice(0, 10).map((t: any, i) => (
                <div className="txn-item" key={i}>
                  <div className="txn-left">
                    <div className="txn-scheme">{t.scheme_name?.length > 55 ? t.scheme_name.slice(0, 55) + "…" : t.scheme_name}</div>
                    <div className="txn-date">{t.fund_name} · {t.transaction_date}</div>
                  </div>
                  <div className="txn-right">
                    <div className="txn-amount">₹{parseFloat(t.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                    <div className="txn-units">{parseFloat(t.units).toFixed(3)} units @ ₹{parseFloat(t.nav).toFixed(4)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
