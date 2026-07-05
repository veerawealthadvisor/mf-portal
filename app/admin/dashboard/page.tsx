"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { getLiveNAV } from "../../../lib/navHelper";
import { useRouter } from "next/navigation";
import { useSessionGuard } from "../../../lib/sessionGuard";

export default function AdminDashboard() {
  const router = useRouter();
  useSessionGuard(router);

  const [loading, setLoading] = useState(true);
  const [navLoading, setNavLoading] = useState(false);
  const [investors, setInvestors] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fundValues, setFundValues] = useState<any>({});
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const [view, setView] = useState<"global" | "investor">("global");

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: inv, error: invError } = await supabase
        .from("investors")
        .select("*")
        .eq("email", user.email)
        .single();

      console.log("Admin check:", inv, invError);

      if (!inv || !inv.is_admin) { router.push("/dashboard"); return; }

      const { data: allInvestors } = await supabase
        .from("investors")
        .select("*")
        .eq("is_admin", false)
        .order("name");

      const { data: allTxns } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      setInvestors(allInvestors || []);
      setTransactions(allTxns || []);
      setLoading(false);

      setNavLoading(true);
      const schemes = [...new Set((allTxns || []).map((t: any) => t.scheme_name))];
      const navMap: any = {};
      for (const scheme of schemes) {
        try {
          const data = await getLiveNAV(scheme as string);
          if (data) {
            navMap[scheme] = data.nav;
            setFundValues({ ...navMap });
          }
        } catch (e) {
          console.log("NAV fetch failed for:", scheme);
        }
      }
      setNavLoading(false);
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const totalInvested = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const fundUnitMap: any = {};
  transactions.forEach((t: any) => {
    const key = t.scheme_name;
    if (!fundUnitMap[key]) fundUnitMap[key] = { units: 0, invested: 0, fund: t.fund_name };
    fundUnitMap[key].units += parseFloat(t.units) || 0;
    fundUnitMap[key].invested += parseFloat(t.amount) || 0;
  });

  const totalCurrentValue = Object.entries(fundUnitMap).reduce((sum, [scheme, data]: any) => {
    const nav = fundValues[scheme];
    return sum + (nav ? data.units * nav : data.invested);
  }, 0);

  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const investorSummary = investors.map((inv: any) => {
    const txns = transactions.filter((t: any) => t.can === inv.can);
    const invested = txns.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const fundMap: any = {};
    txns.forEach((t: any) => {
      if (!fundMap[t.scheme_name]) fundMap[t.scheme_name] = { units: 0 };
      fundMap[t.scheme_name].units += parseFloat(t.units) || 0;
    });
    const currentValue = Object.entries(fundMap).reduce((sum, [scheme, data]: any) => {
      const nav = fundValues[scheme];
      return sum + (nav ? data.units * nav : invested / Object.keys(fundMap).length);
    }, 0);
    const gain = currentValue - invested;
    const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
    const funds = [...new Set(txns.map((t: any) => t.scheme_name))].length;
    return { ...inv, invested, currentValue, gain, gainPct, funds, txnCount: txns.length };
  });

  const topFunds = Object.entries(fundUnitMap)
    .map(([scheme, data]: any) => ({
      scheme, fund: data.fund, invested: data.invested,
      currentValue: fundValues[scheme] ? data.units * fundValues[scheme] : data.invested,
      units: data.units,
    }))
    .sort((a, b) => b.invested - a.invested);

  const monthMap: any = {};
  transactions.forEach((t: any) => {
    const m = t.month_year || "";
    if (!monthMap[m]) monthMap[m] = 0;
    monthMap[m] += parseFloat(t.amount) || 0;
  });
  const months = Object.entries(monthMap).sort();
  const maxMonth = Math.max(...months.map(([, v]: any) => v), 1);

  const selectedTxns = selectedInvestor
    ? transactions.filter((t: any) => t.can === selectedInvestor.can)
    : [];

  const selectedFunds: any = {};
  selectedTxns.forEach((t: any) => {
    if (!selectedFunds[t.scheme_name]) selectedFunds[t.scheme_name] = { scheme: t.scheme_name, fund: t.fund_name, units: 0, invested: 0 };
    selectedFunds[t.scheme_name].units += parseFloat(t.units) || 0;
    selectedFunds[t.scheme_name].invested += parseFloat(t.amount) || 0;
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628", color: "#e8c97a", fontFamily: "DM Sans, sans-serif" }}>
      Loading admin dashboard...
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a; --white: #fff; --muted: #6b7280; --border: rgba(0,0,0,0.08); --green: #16a34a; --red: #dc2626; }
        body { font-family: 'DM Sans', sans-serif; background: #f0ebe0; }
        .nav { background: var(--navy); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(201,168,76,0.2); position: sticky; top: 0; z-index: 50; }
        .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 700; color: var(--gold2); }
        .nav-right { display: flex; align-items: center; gap: 1rem; }
        .nav-btn { background: transparent; border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 0.4rem 1rem; border-radius: 2px; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; text-decoration: none; }
        .nav-btn:hover { background: var(--gold); color: var(--navy); }
        .admin-badge { font-size: 0.7rem; background: rgba(201,168,76,0.15); color: var(--gold); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(201,168,76,0.3); }
        .main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .page-header { margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .page-header h1 { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; color: var(--navy); }
        .page-header p { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
        .view-tabs { display: flex; background: white; border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
        .view-tab { padding: 0.5rem 1.25rem; border-radius: 6px; border: none; background: none; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: var(--muted); cursor: pointer; transition: all 0.2s; }
        .view-tab.active { background: var(--navy); color: var(--gold2); font-weight: 500; }
        .nav-loading { font-size: 0.72rem; color: var(--gold); background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.2); padding: 0.4rem 1rem; border-radius: 10px; display: inline-block; margin-bottom: 1rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem 1.5rem; }
        .stat-card.navy { background: var(--navy); }
        .stat-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .stat-card.navy .stat-label { color: rgba(255,255,255,0.45); }
        .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 1.7rem; font-weight: 700; color: var(--navy); line-height: 1; }
        .stat-card.navy .stat-value { color: var(--gold2); }
        .stat-sub { font-size: 0.7rem; color: var(--muted); margin-top: 0.4rem; }
        .stat-card.navy .stat-sub { color: rgba(255,255,255,0.35); }
        .green { color: var(--green) !important; }
        .red { color: var(--red) !important; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
        .section-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; }
        .section-card h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 700; color: var(--navy); margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .investor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .investor-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; cursor: pointer; transition: all 0.2s; }
        .investor-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .investor-card.selected { border-color: var(--gold); background: rgba(201,168,76,0.04); }
        .inv-name { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 700; color: var(--navy); margin-bottom: 0.25rem; }
        .inv-can { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.75rem; font-family: monospace; }
        .inv-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .inv-stat-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .inv-stat-val { font-size: 0.88rem; font-weight: 500; color: var(--navy); margin-top: 2px; }
        .gain-badge { display: inline-block; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
        .gain-badge.pos { background: rgba(22,163,74,0.1); color: var(--green); }
        .gain-badge.neg { background: rgba(220,38,38,0.1); color: var(--red); }
        .fund-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .fund-table th { text-align: left; padding: 0.5rem 0.75rem; font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); font-weight: 400; }
        .fund-table td { padding: 0.7rem 0.75rem; border-bottom: 1px solid rgba(0,0,0,0.04); vertical-align: middle; }
        .fund-table tr:last-child td { border-bottom: none; }
        .fund-table tr:hover td { background: rgba(201,168,76,0.03); }
        .fund-name { font-weight: 500; color: var(--navy); font-size: 0.8rem; }
        .fund-amc { font-size: 0.68rem; color: var(--muted); }
        .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; margin-top: 0.5rem; }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .bar { width: 100%; background: var(--gold); border-radius: 3px 3px 0 0; min-height: 3px; transition: all 0.3s; }
        .bar:hover { background: var(--gold2); }
        .bar-label { font-size: 9px; color: var(--muted); text-align: center; }
        .bar-val { font-size: 8px; color: var(--muted); }
        .inv-detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .inv-detail-header h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; color: var(--navy); }
        .back-btn { background: none; border: 1px solid var(--border); padding: 0.4rem 1rem; border-radius: 4px; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; color: var(--muted); cursor: pointer; transition: all 0.2s; }
        .back-btn:hover { border-color: var(--navy); color: var(--navy); }
        .txn-list { display: flex; flex-direction: column; gap: 0.6rem; max-height: 400px; overflow-y: auto; }
        .txn-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: #faf9f6; border-radius: 6px; border: 1px solid rgba(0,0,0,0.04); }
        .txn-scheme { font-size: 0.8rem; font-weight: 500; color: var(--navy); }
        .txn-date { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }
        .txn-amount { font-size: 0.88rem; font-weight: 500; color: var(--navy); text-align: right; }
        .txn-units { font-size: 0.7rem; color: var(--muted); margin-top: 2px; text-align: right; }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .grid2 { grid-template-columns: 1fr; }
          .main { padding: 1rem; }
        }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Admin</div>
        <div className="nav-right">
          <span className="admin-badge">Admin</span>
          <a href="/admin/upload" className="nav-btn">Upload Data</a>
          <a href="/admin/goals" className="nav-btn">🎯 Goals</a>
          <button className="nav-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="main">
        <div className="page-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Complete overview of all investor portfolios</p>
          </div>
          <div className="view-tabs">
            <button className={`view-tab ${view === "global" ? "active" : ""}`} onClick={() => { setView("global"); setSelectedInvestor(null); }}>
              🌐 Global View
            </button>
            <button className={`view-tab ${view === "investor" ? "active" : ""}`} onClick={() => setView("investor")}>
              👥 Investor View
            </button>
          </div>
        </div>

        {navLoading && <div className="nav-loading">⏳ Fetching live NAVs from AMFI...</div>}

        <div className="stats-grid">
          <div className="stat-card navy">
            <div className="stat-label">Total AUM</div>
            <div className="stat-value">₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            <div className="stat-sub">Total invested</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Value</div>
            <div className="stat-value">₹{totalCurrentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            <div className="stat-sub">{navLoading ? "Fetching..." : "Live value"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Gain</div>
            <div className={`stat-value ${totalGain >= 0 ? "green" : "red"}`}>
              {totalGain >= 0 ? "+" : ""}₹{Math.abs(totalGain).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="stat-sub">{totalGainPct.toFixed(2)}% overall</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Investors</div>
            <div className="stat-value">{investors.length}</div>
            <div className="stat-sub">{transactions.length} total transactions</div>
          </div>
        </div>

        {view === "global" && (
          <>
            <div className="grid2">
              <div className="section-card">
                <h3>📊 Monthly Investments</h3>
                <div className="bar-chart">
                  {months.map(([month, val]: any) => (
                    <div className="bar-col" key={month}>
                      <div className="bar-val">₹{(val / 1000).toFixed(0)}k</div>
                      <div className="bar" style={{ height: `${(val / maxMonth) * 90}px` }} title={`₹${val.toLocaleString("en-IN")}`} />
                      <div className="bar-label">{month.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="section-card">
                <h3>💼 Top Funds by AUM</h3>
                <table className="fund-table">
                  <thead>
                    <tr><th>Scheme</th><th>Invested</th><th>Curr. Value</th></tr>
                  </thead>
                  <tbody>
                    {topFunds.slice(0, 6).map((f: any, i) => (
                      <tr key={i}>
                        <td>
                          <div className="fund-name">{f.scheme?.length > 28 ? f.scheme.slice(0, 28) + "…" : f.scheme}</div>
                          <div className="fund-amc">{f.fund}</div>
                        </td>
                        <td>₹{f.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td>₹{f.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="section-card">
              <h3>👥 All Investors Summary</h3>
              <table className="fund-table">
                <thead>
                  <tr><th>Investor</th><th>CAN</th><th>Funds</th><th>Invested</th><th>Current Value</th><th>Gain</th></tr>
                </thead>
                <tbody>
                  {investorSummary.map((inv: any, i) => (
                    <tr key={i} style={{ cursor: "pointer" }} onClick={() => { setSelectedInvestor(inv); setView("investor"); }}>
                      <td><div className="fund-name">{inv.name}</div></td>
                      <td><span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--muted)" }}>{inv.can}</span></td>
                      <td>{inv.funds}</td>
                      <td>₹{inv.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                      <td>₹{inv.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                      <td>
                        <span className={`gain-badge ${inv.gain >= 0 ? "pos" : "neg"}`}>
                          {inv.gain >= 0 ? "+" : ""}{inv.gainPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "investor" && !selectedInvestor && (
          <>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              Click on an investor to see their detailed portfolio
            </p>
            <div className="investor-grid">
              {investorSummary.map((inv: any, i) => (
                <div key={i} className={`investor-card ${selectedInvestor?.can === inv.can ? "selected" : ""}`}
                  onClick={() => setSelectedInvestor(inv)}>
                  <div className="inv-name">{inv.name}</div>
                  <div className="inv-can">CAN: {inv.can}</div>
                  <div className="inv-stats">
                    <div>
                      <div className="inv-stat-label">Invested</div>
                      <div className="inv-stat-val">₹{inv.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <div className="inv-stat-label">Current Value</div>
                      <div className="inv-stat-val">₹{inv.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <div className="inv-stat-label">Funds</div>
                      <div className="inv-stat-val">{inv.funds} schemes</div>
                    </div>
                    <div>
                      <div className="inv-stat-label">Return</div>
                      <div className="inv-stat-val">
                        <span className={`gain-badge ${inv.gain >= 0 ? "pos" : "neg"}`}>
                          {inv.gain >= 0 ? "+" : ""}{inv.gainPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === "investor" && selectedInvestor && (
          <>
            <div className="inv-detail-header">
              <div>
                <h2>{selectedInvestor.name}</h2>
                <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>CAN: {selectedInvestor.can} · {selectedInvestor.email}</p>
              </div>
              <button className="back-btn" onClick={() => setSelectedInvestor(null)}>← All Investors</button>
            </div>
            <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-card navy">
                <div className="stat-label">Total Invested</div>
                <div className="stat-value">₹{selectedInvestor.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                <div className="stat-sub">Amount invested</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Current Value</div>
                <div className="stat-value">₹{selectedInvestor.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                <div className="stat-sub">Live value</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Gain / Loss</div>
                <div className={`stat-value ${selectedInvestor.gain >= 0 ? "green" : "red"}`}>
                  {selectedInvestor.gain >= 0 ? "+" : ""}₹{Math.abs(selectedInvestor.gain).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="stat-sub">{selectedInvestor.gainPct.toFixed(2)}% return</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Funds</div>
                <div className="stat-value">{selectedInvestor.funds}</div>
                <div className="stat-sub">{selectedInvestor.txnCount} transactions</div>
              </div>
            </div>
            <div className="grid2">
              <div className="section-card">
                <h3>💼 Fund Breakdown</h3>
                <table className="fund-table">
                  <thead>
                    <tr><th>Scheme</th><th>Units</th><th>Invested</th><th>Curr. Value</th></tr>
                  </thead>
                  <tbody>
                    {Object.values(selectedFunds).map((f: any, i) => {
                      const nav = fundValues[f.scheme];
                      const cv = nav ? f.units * nav : f.invested;
                      const gain = cv - f.invested;
                      const gainPct = f.invested > 0 ? (gain / f.invested) * 100 : 0;
                      return (
                        <tr key={i}>
                          <td>
                            <div className="fund-name">{f.scheme?.length > 28 ? f.scheme.slice(0, 28) + "…" : f.scheme}</div>
                            <div className="fund-amc">{f.fund}</div>
                          </td>
                          <td style={{ fontSize: "0.78rem" }}>{f.units.toFixed(3)}</td>
                          <td>₹{f.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                          <td>
                            ₹{cv.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            <div><span className={`gain-badge ${gain >= 0 ? "pos" : "neg"}`}>{gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%</span></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="section-card">
                <h3>🧾 Transactions</h3>
                <div className="txn-list">
                  {selectedTxns.map((t: any, i) => (
                    <div className="txn-item" key={i}>
                      <div>
                        <div className="txn-scheme">{t.scheme_name?.length > 35 ? t.scheme_name.slice(0, 35) + "…" : t.scheme_name}</div>
                        <div className="txn-date">{t.transaction_date}</div>
                      </div>
                      <div>
                        <div className="txn-amount">₹{parseFloat(t.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                        <div className="txn-units">{parseFloat(t.units).toFixed(3)} units</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
