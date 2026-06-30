"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "next/navigation";

const GOAL_TYPES = [
  { type: "retirement", label: "Retirement", icon: "🏖️", color: "#c9a84c" },
  { type: "education", label: "Child's Education", icon: "🎓", color: "#3b82f6" },
  { type: "marriage", label: "Child's Marriage", icon: "💍", color: "#ec4899" },
  { type: "house", label: "Buy a House", icon: "🏠", color: "#16a34a" },
  { type: "car", label: "Buy a Car", icon: "🚗", color: "#8b5cf6" },
  { type: "holiday", label: "Holiday Planning", icon: "✈️", color: "#0891b2" },
];

function formatINR(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function calcFutureValue(amount: number, rate: number, years: number) {
  return amount * Math.pow(1 + rate / 100, years);
}

function calcRequiredSIP(targetAmount: number, currentCorpus: number, rate: number, years: number) {
  const shortfall = targetAmount - calcFutureValue(currentCorpus, rate, years);
  if (shortfall <= 0) return 0;
  const months = years * 12;
  const r = rate / 100 / 12;
  if (r === 0) return shortfall / months;
  return (shortfall * r) / ((Math.pow(1 + r, months) - 1) * (1 + r));
}

const currentYear = new Date().getFullYear();

const emptyForm = {
  goal_type: "retirement",
  goal_name: "Retirement",
  target_amount: "",
  target_year: currentYear + 10,
  inflation_rate: 6,
  expected_return: 12,
};

export default function AdminGoalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [investors, setInvestors] = useState<any[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: inv } = await supabase.from("investors").select("*").eq("email", user.email).single();
      if (!inv?.is_admin) { router.push("/dashboard"); return; }

      const { data: all } = await supabase.from("investors").select("*").eq("is_admin", false).order("name");
      setInvestors(all || []);
      setLoading(false);
    };
    init();
  }, []);

  const selectInvestor = async (inv: any) => {
    setSelectedInvestor(inv);
    setShowForm(false);
    setEditGoal(null);
    setGoalsLoading(true);
    const { data } = await supabase.from("goals").select("*").eq("investor_id", inv.id).order("target_year");
    setGoals(data || []);
    setGoalsLoading(false);
  };

  const handleSave = async () => {
    if (!form.goal_name.trim() || !form.target_amount || !selectedInvestor) return;
    setSaving(true);
    const payload = {
      investor_id: selectedInvestor.id,
      goal_type: form.goal_type,
      goal_name: form.goal_name.trim(),
      target_amount: parseFloat(form.target_amount),
      target_year: parseInt(String(form.target_year)),
      inflation_rate: parseFloat(String(form.inflation_rate)),
      expected_return: parseFloat(String(form.expected_return)),
    };

    if (editGoal) {
      const { error } = await supabase.from("goals").update(payload).eq("id", editGoal.id);
      if (error) { showToast("Failed to update goal", "error"); }
      else {
        setGoals(g => g.map(x => x.id === editGoal.id ? { ...x, ...payload } : x));
        showToast(`✅ "${form.goal_name}" updated`);
      }
    } else {
      const { data, error } = await supabase.from("goals").insert(payload).select().single();
      if (error) { showToast("Failed to add goal", "error"); }
      else {
        setGoals(g => [...g, data]);
        showToast(`✅ "${form.goal_name}" added for ${selectedInvestor.name}`);
      }
    }
    setSaving(false);
    setShowForm(false);
    setEditGoal(null);
    setForm({ ...emptyForm });
  };

  const handleEdit = (goal: any) => {
    setEditGoal(goal);
    setForm({
      goal_type: goal.goal_type,
      goal_name: goal.goal_name,
      target_amount: String(goal.target_amount),
      target_year: goal.target_year,
      inflation_rate: goal.inflation_rate,
      expected_return: goal.expected_return,
    });
    setShowForm(true);
  };

  const handleDelete = async (goalId: string, goalName: string) => {
    if (!confirm(`Delete "${goalName}" for ${selectedInvestor?.name}? This cannot be undone.`)) return;
    setDeleting(goalId);
    const { error } = await supabase.from("goals").delete().eq("id", goalId);
    if (error) { showToast("Failed to delete goal", "error"); }
    else {
      setGoals(g => g.filter(x => x.id !== goalId));
      showToast(`🗑️ "${goalName}" deleted`);
    }
    setDeleting(null);
  };

  const filteredInvestors = investors.filter(inv =>
    inv.name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.can?.toLowerCase().includes(search.toLowerCase()) ||
    inv.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628", color: "#e8c97a", fontFamily: "DM Sans, sans-serif" }}>
      Loading...
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

        .layout { display: grid; grid-template-columns: 300px 1fr; gap: 0; min-height: calc(100vh - 57px); }

        /* LEFT PANEL */
        .left-panel { background: white; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .left-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
        .left-header h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; color: var(--navy); margin-bottom: 0.75rem; }
        .search-input { width: 100%; padding: 0.6rem 0.9rem; border: 1px solid var(--border); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: var(--navy); background: #faf9f6; outline: none; }
        .search-input:focus { border-color: var(--gold); }
        .investor-list { flex: 1; overflow-y: auto; }
        .inv-item { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: space-between; }
        .inv-item:hover { background: rgba(201,168,76,0.05); }
        .inv-item.active { background: rgba(201,168,76,0.08); border-left: 3px solid var(--gold); }
        .inv-item-name { font-weight: 500; font-size: 0.88rem; color: var(--navy); }
        .inv-item-can { font-size: 0.7rem; color: var(--muted); font-family: monospace; margin-top: 2px; }
        .goal-count-badge { font-size: 0.68rem; background: var(--navy); color: var(--gold2); padding: 2px 8px; border-radius: 10px; }

        /* RIGHT PANEL */
        .right-panel { padding: 2rem; overflow-y: auto; }
        .right-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem; }
        .right-header h1 { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; color: var(--navy); }
        .right-header p { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; color: var(--muted); text-align: center; }
        .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        .empty-state h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: var(--navy); margin-bottom: 0.5rem; }
        .empty-state p { font-size: 0.85rem; max-width: 300px; line-height: 1.6; }

        /* SUMMARY STATS */
        .summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.75rem; }
        .sum-card { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; }
        .sum-card.navy { background: var(--navy); }
        .sum-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
        .sum-card.navy .sum-label { color: rgba(255,255,255,0.4); }
        .sum-value { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; font-weight: 700; color: var(--navy); }
        .sum-card.navy .sum-value { color: var(--gold2); }
        .red-val { color: var(--red) !important; }
        .green-val { color: var(--green) !important; }

        /* GOAL CARDS */
        .goals-grid { display: flex; flex-direction: column; gap: 1rem; }
        .goal-card { background: white; border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem 1.5rem; transition: box-shadow 0.2s; }
        .goal-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .goal-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
        .goal-icon-wrap { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; }
        .goal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 700; color: var(--navy); }
        .goal-subtitle { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
        .goal-actions { display: flex; gap: 0.5rem; }
        .action-btn { padding: 0.35rem 0.85rem; border-radius: 4px; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; border: 1px solid; }
        .edit-btn { border-color: var(--gold); color: var(--gold); background: transparent; }
        .edit-btn:hover { background: var(--gold); color: var(--navy); }
        .del-btn { border-color: #fecaca; color: var(--red); background: transparent; }
        .del-btn:hover { background: #fef2f2; }

        .goal-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
        .g-stat-label { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .g-stat-val { font-size: 0.9rem; font-weight: 500; color: var(--navy); margin-top: 3px; }

        .progress-wrap { display: flex; align-items: center; gap: 0.75rem; }
        .progress-bar-bg { flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .progress-pct { font-size: 0.75rem; font-weight: 600; min-width: 36px; text-align: right; }

        /* ADD GOAL FORM */
        .add-btn { background: var(--gold); color: var(--navy); border: none; padding: 0.6rem 1.4rem; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .add-btn:hover { background: var(--gold2); transform: translateY(-1px); }

        .form-card { background: white; border: 2px solid rgba(201,168,76,0.3); border-radius: 10px; padding: 1.75rem; margin-bottom: 1.75rem; }
        .form-card h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; color: var(--navy); margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .goal-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1.25rem; }
        .type-btn { padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; background: white; cursor: pointer; text-align: center; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .type-btn:hover { border-color: var(--gold); }
        .type-btn.selected { border-color: var(--gold); background: rgba(201,168,76,0.08); }
        .type-btn .t-icon { font-size: 1.2rem; display: block; margin-bottom: 3px; }
        .type-btn .t-label { font-size: 0.72rem; color: var(--navy); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-group label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .form-group input { padding: 0.7rem 0.9rem; border: 1px solid var(--border); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: var(--navy); background: #faf9f6; outline: none; transition: border-color 0.2s; }
        .form-group input:focus { border-color: var(--gold); background: white; }
        .form-btns { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
        .save-btn { background: var(--navy); color: var(--gold2); border: none; padding: 0.7rem 1.75rem; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .save-btn:hover:not(:disabled) { background: #0f1f3d; }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cancel-btn { background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 0.7rem 1.25rem; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .cancel-btn:hover { border-color: var(--navy); color: var(--navy); }

        /* TOAST */
        .toast { position: fixed; bottom: 2rem; right: 2rem; padding: 0.85rem 1.5rem; border-radius: 8px; font-size: 0.85rem; font-family: 'DM Sans', sans-serif; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slideUp 0.3s ease; }
        .toast.success { background: var(--navy); color: var(--gold2); border: 1px solid rgba(201,168,76,0.3); }
        .toast.error { background: #fef2f2; color: var(--red); border: 1px solid #fecaca; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
          .layout { grid-template-columns: 1fr; }
          .left-panel { max-height: 280px; }
          .summary-strip { grid-template-columns: repeat(2, 1fr); }
          .goal-stats { grid-template-columns: repeat(2, 1fr); }
          .form-row { grid-template-columns: 1fr; }
          .goal-type-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Admin</div>
        <div className="nav-right">
          <span className="admin-badge">Admin</span>
          <a href="/admin/dashboard" className="nav-btn">← Dashboard</a>
          <a href="/admin/upload" className="nav-btn">Upload Data</a>
          <button className="nav-btn" onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}>Logout</button>
        </div>
      </nav>

      <div className="layout">

        {/* LEFT: Investor list */}
        <div className="left-panel">
          <div className="left-header">
            <h2>🎯 Goals Manager</h2>
            <input
              className="search-input"
              placeholder="Search investor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="investor-list">
            {filteredInvestors.map((inv: any) => (
              <div
                key={inv.id}
                className={`inv-item ${selectedInvestor?.id === inv.id ? "active" : ""}`}
                onClick={() => selectInvestor(inv)}
              >
                <div>
                  <div className="inv-item-name">{inv.name}</div>
                  <div className="inv-item-can">CAN: {inv.can}</div>
                </div>
                {selectedInvestor?.id === inv.id && goals.length > 0 && (
                  <span className="goal-count-badge">{goals.length} goals</span>
                )}
              </div>
            ))}
            {filteredInvestors.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.82rem" }}>
                No investors found
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Goals panel */}
        <div className="right-panel">

          {/* No investor selected */}
          {!selectedInvestor && (
            <div className="empty-state">
              <div className="empty-icon">👈</div>
              <h3>Select an Investor</h3>
              <p>Choose an investor from the left panel to view and manage their financial goals.</p>
            </div>
          )}

          {/* Investor selected */}
          {selectedInvestor && (
            <>
              {/* Header */}
              <div className="right-header">
                <div>
                  <h1>{selectedInvestor.name}</h1>
                  <p>CAN: {selectedInvestor.can} · {selectedInvestor.email}</p>
                </div>
                <button className="add-btn" onClick={() => { setShowForm(true); setEditGoal(null); setForm({ ...emptyForm }); }}>
                  + Add Goal
                </button>
              </div>

              {/* Summary strip */}
              {goals.length > 0 && (() => {
                const totalCorpus = goals.reduce((s, g) => {
                  const yrs = Math.max(1, g.target_year - currentYear);
                  return s + calcFutureValue(g.target_amount, g.inflation_rate, yrs);
                }, 0);
                const totalSIP = goals.reduce((s, g) => {
                  const yrs = Math.max(1, g.target_year - currentYear);
                  const fv = calcFutureValue(g.target_amount, g.inflation_rate, yrs);
                  return s + calcRequiredSIP(fv, 0, g.expected_return, yrs);
                }, 0);
                return (
                  <div className="summary-strip">
                    <div className="sum-card navy">
                      <div className="sum-label">Total Goals</div>
                      <div className="sum-value">{goals.length}</div>
                    </div>
                    <div className="sum-card">
                      <div className="sum-label">Corpus Required</div>
                      <div className="sum-value">{formatINR(totalCorpus)}</div>
                    </div>
                    <div className="sum-card">
                      <div className="sum-label">Total Shortfall</div>
                      <div className="sum-value red-val">{formatINR(totalCorpus)}</div>
                    </div>
                    <div className="sum-card">
                      <div className="sum-label">Monthly SIP Needed</div>
                      <div className="sum-value">₹{Math.round(totalSIP).toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Add / Edit Form */}
              {showForm && (
                <div className="form-card">
                  <h3>{editGoal ? "✏️ Edit Goal" : "➕ Add New Goal"} for {selectedInvestor.name}</h3>

                  {/* Goal type selector */}
                  <div className="goal-type-grid">
                    {GOAL_TYPES.map(gt => (
                      <button
                        key={gt.type}
                        className={`type-btn ${form.goal_type === gt.type ? "selected" : ""}`}
                        onClick={() => setForm(f => ({ ...f, goal_type: gt.type, goal_name: gt.label }))}
                      >
                        <span className="t-icon">{gt.icon}</span>
                        <span className="t-label">{gt.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                      <label>Goal Name</label>
                      <input
                        value={form.goal_name}
                        onChange={e => setForm(f => ({ ...f, goal_name: e.target.value }))}
                        placeholder="e.g. Daughter's Education"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Target Amount (Today's Value) ₹</label>
                      <input
                        type="number"
                        value={form.target_amount}
                        onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                        placeholder="e.g. 5000000"
                      />
                    </div>
                    <div className="form-group">
                      <label>Target Year</label>
                      <input
                        type="number"
                        value={form.target_year}
                        onChange={e => setForm(f => ({ ...f, target_year: parseInt(e.target.value) }))}
                        min={currentYear + 1}
                        max={2075}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Inflation Rate (%)</label>
                      <input
                        type="number"
                        value={form.inflation_rate}
                        onChange={e => setForm(f => ({ ...f, inflation_rate: parseFloat(e.target.value) }))}
                        step="0.5" min="0" max="20"
                      />
                    </div>
                    <div className="form-group">
                      <label>Expected Return (%)</label>
                      <input
                        type="number"
                        value={form.expected_return}
                        onChange={e => setForm(f => ({ ...f, expected_return: parseFloat(e.target.value) }))}
                        step="0.5" min="0" max="30"
                      />
                    </div>
                  </div>

                  <div className="form-btns">
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : editGoal ? "Update Goal" : "Add Goal"}
                    </button>
                    <button className="cancel-btn" onClick={() => { setShowForm(false); setEditGoal(null); setForm({ ...emptyForm }); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Goals loading */}
              {goalsLoading && (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                  Loading goals...
                </div>
              )}

              {/* No goals yet */}
              {!goalsLoading && goals.length === 0 && !showForm && (
                <div className="empty-state">
                  <div className="empty-icon">🎯</div>
                  <h3>No Goals Yet</h3>
                  <p>{selectedInvestor.name} has no financial goals. Click "Add Goal" to create their first goal.</p>
                </div>
              )}

              {/* Goal cards */}
              {!goalsLoading && goals.length > 0 && (
                <div className="goals-grid">
                  {goals.map((goal: any) => {
                    const yrs = Math.max(1, goal.target_year - currentYear);
                    const fv = calcFutureValue(goal.target_amount, goal.inflation_rate, yrs);
                    const sip = calcRequiredSIP(fv, 0, goal.expected_return, yrs);
                    const shortfall = fv;
                    const pct = 0; // 0% since no corpus mapped here; investor's goals page shows actual %
                    const gInfo = GOAL_TYPES.find(gt => gt.type === goal.goal_type);
                    const bColor = gInfo?.color || "#c9a84c";

                    return (
                      <div className="goal-card" key={goal.id}>
                        <div className="goal-card-top">
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div className="goal-icon-wrap" style={{ background: `${bColor}18` }}>
                              <span>{gInfo?.icon}</span>
                            </div>
                            <div>
                              <div className="goal-title">{goal.goal_name}</div>
                              <div className="goal-subtitle">
                                {gInfo?.label} · Target: {goal.target_year} · {yrs} yrs left
                              </div>
                            </div>
                          </div>
                          <div className="goal-actions">
                            <button className="action-btn edit-btn" onClick={() => handleEdit(goal)}>Edit</button>
                            <button
                              className="action-btn del-btn"
                              onClick={() => handleDelete(goal.id, goal.goal_name)}
                              disabled={deleting === goal.id}
                            >
                              {deleting === goal.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </div>

                        <div className="goal-stats">
                          <div>
                            <div className="g-stat-label">Today's Value</div>
                            <div className="g-stat-val">{formatINR(goal.target_amount)}</div>
                          </div>
                          <div>
                            <div className="g-stat-label">Inflation Adjusted</div>
                            <div className="g-stat-val">{formatINR(fv)}</div>
                          </div>
                          <div>
                            <div className="g-stat-label">SIP Needed/mo</div>
                            <div className="g-stat-val" style={{ color: "var(--red)" }}>
                              ₹{Math.round(sip).toLocaleString("en-IN")}
                            </div>
                          </div>
                          <div>
                            <div className="g-stat-label">Inflation Rate</div>
                            <div className="g-stat-val">{goal.inflation_rate}%</div>
                          </div>
                          <div>
                            <div className="g-stat-label">Expected Return</div>
                            <div className="g-stat-val">{goal.expected_return}%</div>
                          </div>
                          <div>
                            <div className="g-stat-label">Shortfall</div>
                            <div className="g-stat-val" style={{ color: "var(--red)" }}>{formatINR(shortfall)}</div>
                          </div>
                        </div>

                        <div className="progress-wrap">
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: bColor }} />
                          </div>
                          <span className="progress-pct" style={{ color: bColor }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
