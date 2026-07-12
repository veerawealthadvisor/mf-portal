"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const GOAL_TYPES = [
  { type: "retirement", label: "Retirement", icon: "🏖️", pdfLabel: "[RET]", color: "#c9a84c" },
  { type: "education", label: "Child's Education", icon: "🎓", pdfLabel: "[EDU]", color: "#3b82f6" },
  { type: "marriage", label: "Child's Marriage", icon: "💍", pdfLabel: "[MAR]", color: "#ec4899" },
  { type: "house", label: "Buy a House", icon: "🏠", pdfLabel: "[HSE]", color: "#16a34a" },
  { type: "car", label: "Buy a Car", icon: "🚗", pdfLabel: "[CAR]", color: "#8b5cf6" },
  { type: "holiday", label: "Holiday Planning", icon: "✈️", pdfLabel: "[HOL]", color: "#0891b2" },
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

// ✅ Shared helper — computes per-goal weighted corpus allocation
// Weight = target_amount / years_remaining (bigger + urgent = more corpus now)
function computeGoalWeights(goals: any[], currentYear: number) {
  const weights = goals.map((g: any) => {
    const yrs = Math.max(1, g.target_year - currentYear);
    return (parseFloat(String(g.target_amount)) || 0) / yrs;
  });
  const total = weights.reduce((s: number, w: number) => s + w, 0) || 1;
  return { weights, total };
}

export default function GoalsPage() {
  const router = useRouter();
  const [investor, setInvestor] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);

  const [form, setForm] = useState({
    goal_type: "retirement",
    goal_name: "",
    target_amount: "",
    target_year: new Date().getFullYear() + 10,
    inflation_rate: 6,
    expected_return: 12,
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: inv } = await supabase
        .from("investors").select("*").eq("email", user.email).single();
      if (!inv) { router.push("/dashboard"); return; }
      if (inv.is_admin) { router.push("/admin/dashboard"); return; }
      setInvestor(inv);

      const { data: goalsData } = await supabase
        .from("goals").select("*").eq("can", inv.can).order("created_at");
      setGoals(goalsData || []);

      const { data: txns } = await supabase
        .from("transactions").select("scheme_name, fund_name, units, amount")
        .eq("can", inv.can);

      const fundMap: any = {};
      (txns || []).forEach((t: any) => {
        if (!fundMap[t.scheme_name]) {
          fundMap[t.scheme_name] = { scheme: t.scheme_name, fund: t.fund_name, units: 0, invested: 0 };
        }
        fundMap[t.scheme_name].units += parseFloat(t.units) || 0;
        fundMap[t.scheme_name].invested += parseFloat(t.amount) || 0;
      });
      setFunds(Object.values(fundMap));
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalInvested = funds.reduce((s, f) => s + f.invested, 0);
  const currentYear = new Date().getFullYear();

  const handleSave = async () => {
    if (!form.goal_name.trim() || !form.target_amount) return;
    setSaving(true);

    if (editGoal) {
      await supabase.from("goals").update({
        goal_type: form.goal_type,
        goal_name: form.goal_name,
        target_amount: parseFloat(form.target_amount),
        target_year: form.target_year,
        inflation_rate: form.inflation_rate,
        expected_return: form.expected_return,
      }).eq("id", editGoal.id);
    } else {
      await supabase.from("goals").insert({
        can: investor.can,
        goal_type: form.goal_type,
        goal_name: form.goal_name,
        target_amount: parseFloat(form.target_amount),
        target_year: form.target_year,
        inflation_rate: form.inflation_rate,
        expected_return: form.expected_return,
      });
    }

    const { data: goalsData } = await supabase
      .from("goals").select("*").eq("can", investor.can).order("created_at");
    setGoals(goalsData || []);
    setShowAdd(false);
    setEditGoal(null);
    setForm({ goal_type: "retirement", goal_name: "", target_amount: "", target_year: currentYear + 10, inflation_rate: 6, expected_return: 12 });
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(goals.filter(g => g.id !== id));
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
    setShowAdd(true);
  };

  const downloadPDF = async () => {
  if (!investor || goals.length === 0) return;
  setPdfLoading(true);
  try {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setLanguage("en");

    // ── CONSTANTS ──────────────────────────────────────────
    const W = 210, H = 297;
    const M = 15;           // left/right margin
    const CW = W - M * 2;  // content width = 180mm

    const NAVY  = [10, 22, 40]    as [number, number, number];
    const GOLD  = [201, 168, 76]  as [number, number, number];
    const GOLD2 = [232, 201, 122] as [number, number, number];
    const WHITE = [255, 255, 255] as [number, number, number];
    const MUTED = [107, 114, 128] as [number, number, number];
    const GREEN = [22, 163, 74]   as [number, number, number];
    const RED   = [220, 38, 38]   as [number, number, number];
    const AMBER = [217, 119, 6]   as [number, number, number];
    const LIGHT = [248, 245, 240] as [number, number, number];
    const SLATE = [14, 26, 50]    as [number, number, number];

    // ── HELPERS ────────────────────────────────────────────
    const sf = (style: "bold"|"normal"|"italic"|"bolditalic" = "normal") =>
      doc.setFont("times", style);

    const wrap = (text: string, maxW: number) =>
      doc.splitTextToSize(text, maxW);

    const txt = (text: string, x: number, y: number, opts?: any) =>
      doc.text(text, x, y, opts);

    const wtxt = (text: string, x: number, y: number, maxW: number, opts?: any) =>
      doc.text(wrap(text, maxW), x, y, opts);

    // Draw a rounded info card with label + value
    const infoCard = (x: number, y: number, w: number, h: number,
      label: string, value: string, labelColor: [number,number,number],
      valueColor: [number,number,number], bgColor: [number,number,number],
      accentColor?: [number,number,number]) => {
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]); doc.roundedRect(x, y, w, h, 2, 2, "F");
      if (accentColor) { doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); doc.rect(x, y, 2, h, "F"); }
      doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]); doc.setFontSize(6); sf("normal");
      txt(wrap(label, w - 8), x + 5, y + 6);
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]); doc.setFontSize(8.5); sf("bold");
      txt(wrap(value, w - 8), x + 5, y + 13);
    };

    // Horizontal divider line
    const divider = (y: number, color: [number,number,number] = GOLD, opacity = 0.4) => {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setGState(new (doc as any).GState({ opacity }));
      doc.rect(M, y, CW, 0.4, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    };

    // Section heading
    const sectionHead = (title: string, y: number, icon = "") => {
      doc.setFillColor(...NAVY); doc.rect(M, y, CW, 8, "F");
      doc.setFillColor(...GOLD); doc.rect(M, y, 3, 8, "F");
      doc.setTextColor(...GOLD2); doc.setFontSize(8); sf("bold");
      txt(`${icon}  ${title}`, M + 7, y + 5.5);
      return y + 12;
    };

    // Page header (reused on every page)
    const pageHeader = (pageTitle: string, subtitle = "") => {
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, 20, "F");
      doc.setFillColor(...GOLD); doc.rect(0, 20, W, 1, "F");
      doc.setTextColor(...GOLD2); doc.setFontSize(11); sf("bold");
      txt(pageTitle, M, 13);
      if (subtitle) {
        doc.setTextColor(...MUTED); doc.setFontSize(7); sf("normal");
        txt(subtitle, W - M, 13, { align: "right" });
      }
    };

    // Footer on every page
    const pageFooter = (pageNum: number, total: number) => {
      doc.setFillColor(...NAVY); doc.rect(0, H - 12, W, 12, "F");
      doc.setFillColor(...GOLD); doc.rect(0, H - 12, W, 0.4, "F");
      doc.setTextColor(...MUTED); doc.setFontSize(6); sf("normal");
      txt("Veera Karthik Subburaj  |  ARN: 355717  |  8148582571  |  veerawealthadvisor@gmail.com", M, H - 5);
      doc.setTextColor(...GOLD); doc.setFontSize(6); sf("bold");
      txt(`Page ${pageNum} of ${total}`, W - M, H - 5, { align: "right" });
    };

    // ── PRE-COMPUTE ALL GOAL DATA ──────────────────────────
    // Corpus weighting = target amount × urgency (1/years).
    // A goal with fewer years gets a larger share because it has less time to grow.
    // A goal with a larger target also gets a larger share.
    // Both factors combined give a fair, financially sound allocation of the current portfolio.
    //
    // Example: Retirement ₹50L/20yrs, Education ₹15L/8yrs, Car ₹5L/3yrs
    //   Raw weights: 50L/20=2.5, 15L/8=1.875, 5L/3=1.667 → total=6.042
    //   Corpus share: 41.4%, 31.0%, 27.6%
    //   Car gets a bigger share despite being smallest — because it's only 3 years away.
    const goalWeights = goals.map((g2: any) => {
      const yrs2 = Math.max(1, g2.target_year - currentYear);
      return (parseFloat(g2.target_amount) || 0) / yrs2;
    });
    const totalWeight = goalWeights.reduce((s: number, w: number) => s + w, 0) || 1;

    const goalData = goals.map((g: any, gi: number) => {
      const years   = Math.max(1, g.target_year - currentYear);
      const fv      = calcFutureValue(g.target_amount, g.inflation_rate, years);
      // ✅ Weighted by both target size AND urgency (shorter horizon = more corpus now)
      const corpus  = totalInvested * (goalWeights[gi] / totalWeight);
      const fvCorpus = calcFutureValue(corpus, g.expected_return, years);
      const shortfall = Math.max(0, fv - fvCorpus);
      const sip     = calcRequiredSIP(fv, corpus, g.expected_return, years);
      const pct     = Math.min(100, (fvCorpus / fv) * 100);
      const info    = GOAL_TYPES.find((gt: any) => gt.type === g.goal_type);
      const health  = pct >= 75 ? "ON TRACK" : pct >= 40 ? "NEEDS ATTENTION" : "FUNDING GAP";
      const healthColor: [number,number,number] = pct >= 75 ? GREEN : pct >= 40 ? AMBER : RED;
      const priority = years <= 5 ? "HIGH" : years <= 12 ? "MEDIUM" : "LOW";
      const priorityColor: [number,number,number] = years <= 5 ? RED : years <= 12 ? AMBER : GREEN;
      const riskProfile = g.expected_return >= 14 ? "Aggressive" : g.expected_return >= 11 ? "Moderate" : "Conservative";
      return { g, years, fv, corpus, fvCorpus, shortfall, sip, pct, info,
               health, healthColor, priority, priorityColor, riskProfile };
    });

    const totalFV       = goalData.reduce((s: number, d: any) => s + d.fv, 0);
    const totalShortfall= goalData.reduce((s: number, d: any) => s + d.shortfall, 0);
    const totalSIP      = goalData.reduce((s: number, d: any) => s + d.sip, 0);
    const avgReturn     = goals.length ? goals.reduce((s: number, g: any) => s + g.expected_return, 0) / goals.length : 12;
    const avgInflation  = goals.length ? goals.reduce((s: number, g: any) => s + g.inflation_rate, 0) / goals.length : 6;
    const avgYears      = goals.length ? Math.round(goals.reduce((s: number, g: any) => s + Math.max(1, g.target_year - currentYear), 0) / goals.length) : 10;
    const overallRisk   = avgReturn >= 14 ? "Aggressive" : avgReturn >= 11 ? "Moderate" : "Conservative";
    const onTrackCount  = goalData.filter((d: any) => d.health === "ON TRACK").length;
    const overallHealth = onTrackCount === goals.length ? "ON TRACK"
                        : onTrackCount >= goals.length / 2 ? "NEEDS ATTENTION" : "FUNDING GAP";
    const overallHealthColor: [number,number,number] =
      overallHealth === "ON TRACK" ? GREEN : overallHealth === "NEEDS ATTENTION" ? AMBER : RED;

    const equityKeywords = ["equity","flexi","large","mid","small","multi","value","growth","elss","nifty","sensex"];
    let equityAmt = 0, debtAmt = 0;
    funds.forEach((f: any) => {
      const name = (f.scheme + " " + f.fund).toLowerCase();
      if (equityKeywords.some((k: string) => name.includes(k))) equityAmt += f.invested;
      else debtAmt += f.invested;
    });
    const totalForPie = equityAmt + debtAmt || 1;
    const equityPct   = equityAmt / totalForPie;

    const TOTAL_PAGES = 2 + goals.length + 1; // cover + summary + N goal pages + closing

    // ══════════════════════════════════════════════════════
    // PAGE 1 — COVER PAGE
    // ══════════════════════════════════════════════════════
    let pg = 1;

    // Dark background
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
    doc.setFillColor(6, 14, 28); doc.rect(0, 0, W, 65, "F");
    doc.setFillColor(...GOLD); doc.rect(0, 65, W, 1.5, "F");

    // Logo
    try {
      const logoRes  = await fetch("/icons/icon-512x512.png");
      const logoBlob = await logoRes.blob();
      const logoUrl  = await new Promise<string>(res => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(logoBlob);
      });
      doc.addImage(logoUrl, "PNG", M, 8, 20, 20);
    } catch {
      doc.setFillColor(...GOLD); doc.circle(M + 10, 18, 9, "F");
      doc.setFillColor(6, 14, 28); doc.circle(M + 10, 18, 7, "F");
      doc.setTextColor(...GOLD); doc.setFontSize(8); sf("bold");
      txt("VK", M + 10, 21, { align: "center" });
    }

    doc.setTextColor(...GOLD2); doc.setFontSize(14); sf("bold");
    txt("Veera Karthik Subburaj", M + 26, 16);
    doc.setTextColor(180, 190, 200); doc.setFontSize(7.5); sf("normal");
    txt("AMFI Registered Mutual Fund Distributor  |  ARN: 355717", M + 26, 22);
    txt("8148582571  |  veerawealthadvisor@gmail.com  |  investwithveera.vercel.app", M + 26, 28);

    // Report title
    doc.setTextColor(...GOLD); doc.setFontSize(18); sf("bold");
    wtxt("Goal-Based Financial Planning Report", W / 2, 46, CW, { align: "center" });
    doc.setTextColor(203, 213, 225); doc.setFontSize(9); sf("italic");
    txt("A Personalised Wealth Planning Analysis", W / 2, 55, { align: "center" });

    // Client strip
    doc.setFillColor(15, 31, 61); doc.rect(0, 67, W, 24, "F");
    doc.setTextColor(...MUTED); doc.setFontSize(7); sf("normal");
    txt("PREPARED FOR", M, 74);
    doc.setTextColor(...WHITE); doc.setFontSize(13); sf("bold");
    wtxt(investor?.name || "Investor", M, 82, 120);
    const reportDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    doc.setTextColor(...MUTED); doc.setFontSize(7); sf("normal");
    txt("REPORT DATE", W - M - 50, 74);
    doc.setTextColor(...WHITE); doc.setFontSize(9); sf("bold");
    txt(reportDate, W - M - 50, 82);
    txt(`CAN: ${investor?.can}`, W - M - 50, 88);

    // ── Financial Snapshot Cards (2×3 grid) ──
    let cy = 100;
    doc.setTextColor(...GOLD); doc.setFontSize(8); sf("bold");
    txt("FINANCIAL SNAPSHOT", M, cy - 2);
    doc.setFillColor(...GOLD); doc.rect(M, cy, CW, 0.4, "F");
    cy += 5;

    const snapCards = [
      { label: "Goals Identified",        value: String(goals.length),       color: GOLD  },
      { label: "Current Portfolio Value",  value: pdfINR(totalInvested),   color: GOLD2 },
      { label: "Total Corpus Required",    value: pdfINR(totalFV),         color: GOLD2 },
      { label: "Planning Shortfall",       value: pdfINR(totalShortfall),  color: RED   },
      { label: "Monthly SIP Required",     value: `Rs.${Math.round(totalSIP).toLocaleString("en-IN")}`, color: GREEN },
      { label: "Overall Goal Health",      value: overallHealth,              color: overallHealthColor },
    ];
    const scW = (CW - 4) / 3;
    snapCards.forEach((sc, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      const sx = M + col * (scW + 2), sy = cy + row * 20;
      doc.setFillColor(...SLATE); doc.roundedRect(sx, sy, scW, 18, 2, 2, "F");
      doc.setFillColor(sc.color[0], sc.color[1], sc.color[2]); doc.rect(sx, sy, 2, 18, "F");
      doc.setTextColor(130, 140, 155); doc.setFontSize(5.5); sf("normal");
      txt(sc.label.toUpperCase(), sx + 5, sy + 6);
      doc.setTextColor(sc.color[0], sc.color[1], sc.color[2]); doc.setFontSize(8.5); sf("bold");
      txt(wrap(sc.value, scW - 8), sx + 5, sy + 14);
    });
    cy += 44;

    // ── Goals Overview list ──
    doc.setTextColor(...GOLD); doc.setFontSize(8); sf("bold");
    txt("GOALS AT A GLANCE", M, cy + 4);
    doc.setFillColor(...GOLD); doc.rect(M, cy + 6, CW, 0.4, "F");
    cy += 10;

    goalData.slice(0, 6).forEach((d: any) => {
      doc.setFillColor(...SLATE); doc.rect(M, cy, CW, 16, "F");
      // Priority dot
      doc.setFillColor(d.priorityColor[0], d.priorityColor[1], d.priorityColor[2]); doc.circle(M + 4, cy + 8, 2, "F");
      // Goal name + meta
      doc.setTextColor(...WHITE); doc.setFontSize(7.5); sf("bold");
      txt(wrap(`${d.info?.pdfLabel || ""} ${d.g.goal_name}`, 100), M + 10, cy + 6);
      doc.setTextColor(...MUTED); doc.setFontSize(6); sf("normal");
      const meta = `${d.g.target_year}  ·  ${d.years} yrs  ·  Target: ${pdfINR(d.fv)}  ·  SIP: Rs.${Math.round(d.sip).toLocaleString("en-IN")}/mo`;
      txt(wrap(meta, 110), M + 10, cy + 12);
      // Health badge
      doc.setFillColor(d.healthColor[0], d.healthColor[1], d.healthColor[2]); doc.roundedRect(W - M - 32, cy + 4, 30, 8, 1, 1, "F");
      doc.setTextColor(...WHITE); doc.setFontSize(5.5); sf("bold");
      txt(d.health, W - M - 17, cy + 9, { align: "center" });
      // Progress bar
      const bx = W - M - 68, bw = 32;
      doc.setFillColor(30, 45, 75); doc.roundedRect(bx, cy + 5, bw, 4, 1, 1, "F");
      doc.setFillColor(d.healthColor[0], d.healthColor[1], d.healthColor[2]);
      doc.roundedRect(bx, cy + 5, Math.max(2, bw * d.pct / 100), 4, 1, 1, "F");
      doc.setTextColor(d.healthColor[0], d.healthColor[1], d.healthColor[2]); doc.setFontSize(5.5); sf("bold");
      const pctLabel = d.pct < 1 ? "Just Started" : `${d.pct.toFixed(0)}%`;
      txt(pctLabel, bx - 2, cy + 8, { align: "right" });
      cy += 18;
    });

    // ── Asset Allocation mini pie ──
    cy += 4;
    divider(cy); cy += 6;
    doc.setTextColor(...GOLD); doc.setFontSize(7); sf("bold");
    txt("CURRENT ASSET ALLOCATION", M, cy + 4);
    cy += 8;
    const pieX = M + 14, pieY = cy + 16, pieR = 14;
    const equityAngle = equityPct * 2 * Math.PI;
    const pieSteps = 60;
    doc.setFillColor(201, 168, 76);
    for (let s = 0; s < pieSteps; s++) {
      const a1 = (s / pieSteps) * equityAngle - Math.PI / 2;
      const a2 = ((s + 1) / pieSteps) * equityAngle - Math.PI / 2;
      doc.triangle(pieX, pieY, pieX + pieR * Math.cos(a1), pieY + pieR * Math.sin(a1), pieX + pieR * Math.cos(a2), pieY + pieR * Math.sin(a2), "F");
    }
    doc.setFillColor(59, 130, 246);
    for (let s = 0; s < pieSteps; s++) {
      const a1 = equityAngle + (s / pieSteps) * (2 * Math.PI - equityAngle) - Math.PI / 2;
      const a2 = equityAngle + ((s + 1) / pieSteps) * (2 * Math.PI - equityAngle) - Math.PI / 2;
      doc.triangle(pieX, pieY, pieX + pieR * Math.cos(a1), pieY + pieR * Math.sin(a1), pieX + pieR * Math.cos(a2), pieY + pieR * Math.sin(a2), "F");
    }
    doc.setFillColor(...NAVY); doc.circle(pieX, pieY, pieR * 0.52, "F");
    doc.setTextColor(...WHITE); doc.setFontSize(6); sf("bold");
    txt(`${Math.round(equityPct * 100)}%`, pieX, pieY - 1, { align: "center" });
    doc.setFontSize(4.5); sf("normal"); txt("Equity", pieX, pieY + 3.5, { align: "center" });

    const legX = M + 34;
    doc.setFillColor(201, 168, 76); doc.rect(legX, cy + 10, 5, 3.5, "F");
    doc.setTextColor(...WHITE); doc.setFontSize(6.5); sf("normal");
    txt(`Equity  ${Math.round(equityPct * 100)}%  ·  ${pdfINR(equityAmt)}`, legX + 7, cy + 13);
    doc.setFillColor(59, 130, 246); doc.rect(legX, cy + 17, 5, 3.5, "F");
    txt(`Debt  ${Math.round((1 - equityPct) * 100)}%  ·  ${pdfINR(debtAmt)}`, legX + 7, cy + 20);

    // ── Risk profile & horizon ──
    const rpX = W / 2 + 10;
    const rpItems = [
      ["Risk Profile", overallRisk],
      ["Avg. Expected Return", `${avgReturn.toFixed(1)}%`],
      ["Avg. Inflation Assumed", `${avgInflation.toFixed(1)}%`],
      ["Avg. Investment Horizon", `${avgYears} years`],
    ];
    let rpY = cy + 6;
    rpItems.forEach(([lbl, val]) => {
      doc.setFillColor(...SLATE); doc.rect(rpX, rpY, W - rpX - M, 8, "F");
      doc.setTextColor(...MUTED); doc.setFontSize(6); sf("normal");
      txt(lbl, rpX + 3, rpY + 5.5);
      doc.setTextColor(...GOLD); sf("bold");
      txt(val, W - M - 2, rpY + 5.5, { align: "right" });
      rpY += 9;
    });

    pageFooter(pg, TOTAL_PAGES);

    // ══════════════════════════════════════════════════════
    // PAGE 2 — GOALS SUMMARY + ASSUMPTIONS
    // ══════════════════════════════════════════════════════
    doc.addPage(); pg++;
    pageHeader("Goals Summary", investor?.name);

    // 4 summary cards
    let y = 28;
    const sumCards = [
      { label: "Total Goals",            value: String(goals.length),            color: GOLD,  accent: GOLD  },
      { label: "Total Corpus Required",  value: pdfINR(totalFV),              color: WHITE, accent: NAVY  },
      { label: "Total Shortfall",        value: pdfINR(totalShortfall),       color: RED,   accent: RED   },
      { label: "Additional SIP Needed",  value: `Rs.${Math.round(totalSIP).toLocaleString("en-IN")}/mo`, color: GREEN, accent: GREEN },
    ];
    const sumW = (CW - 6) / 4;
    sumCards.forEach((card, i) => {
      const cx = M + i * (sumW + 2);
      doc.setFillColor(...NAVY); doc.roundedRect(cx, y, sumW, 20, 2, 2, "F");
      doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]); doc.rect(cx, y, 2, 20, "F");
      doc.setTextColor(...MUTED); doc.setFontSize(6); sf("normal");
      txt(wrap(card.label, sumW - 8), cx + 5, y + 7);
      doc.setTextColor(card.color[0], card.color[1], card.color[2]); doc.setFontSize(9); sf("bold");
      txt(wrap(card.value, sumW - 8), cx + 5, y + 16);
    });
    y += 27;

    // Goals table
    y = sectionHead("All Goals Overview", y, "");
    const tableRows = goalData.map((d: any) => [
      `${d.info?.pdfLabel || ""} ${d.g.goal_name}`,
      String(d.g.target_year),
      `${d.years} yrs`,
      pdfINR(d.fv),
      pdfINR(d.fvCorpus),
      pdfINR(d.shortfall),
      `Rs.${Math.round(d.sip).toLocaleString("en-IN")}/mo`,
      `${d.pct.toFixed(0)}%`,
      d.health,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Goal", "Year", "Left", "Target Corpus", "Projected", "Shortfall", "SIP Needed", "Progress", "Status"]],
      body: tableRows,
      theme: "grid",
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 12 },
        2: { cellWidth: 10 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 13 },
        8: { cellWidth: 21 },
      },
      headStyles: { fillColor: NAVY, textColor: GOLD, fontSize: 6.5, fontStyle: "bold", font: "times" },
      bodyStyles: { fontSize: 6.5, font: "times", overflow: "linebreak", textColor: [30, 30, 30] as [number,number,number] },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 2 },
      margin: { left: M, right: M },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 5 && data.row.index >= 0)
          data.cell.styles.textColor = RED;
        if (data.section === "body" && data.column.index === 6 && data.row.index >= 0)
          data.cell.styles.textColor = GREEN;
      },
    });

    let afterTable = (doc as any).lastAutoTable?.finalY || y + 60;
    afterTable += 8;

    // ── Assumptions Section ──
    afterTable = sectionHead("Planning Assumptions & Methodology", afterTable, "");
    doc.setFillColor(...LIGHT); doc.roundedRect(M, afterTable, CW, 38, 2, 2, "F");
    doc.setFillColor(...GOLD); doc.rect(M, afterTable, 2, 38, "F");

    const assumCols = [
      ["Expected Equity Return", `${avgReturn.toFixed(1)}% p.a.`, "Compounding", "Monthly (SIP)"],
      ["Assumed Inflation Rate", `${avgInflation.toFixed(1)}% p.a.`, "SIP Frequency", "Monthly"],
      ["Compounding Method", "Compound Annual", "Review Frequency", "Annual"],
    ];
    const aColW = CW / 3;
    doc.setTextColor(...NAVY); doc.setFontSize(6); sf("bold");
    assumCols.forEach((col, ci) => {
      const ax = M + 4 + ci * aColW;
      txt(col[0], ax, afterTable + 8);
      doc.setTextColor(...GOLD); doc.setFontSize(7); sf("bold");
      txt(col[1], ax, afterTable + 14);
      doc.setTextColor(...NAVY); doc.setFontSize(6); sf("bold");
      txt(col[2], ax, afterTable + 22);
      doc.setTextColor(...GOLD); doc.setFontSize(7); sf("bold");
      txt(col[3], ax, afterTable + 28);
    });

    afterTable += 42;
    doc.setFillColor(255, 249, 235); doc.roundedRect(M, afterTable, CW, 12, 2, 2, "F");
    doc.setTextColor(...AMBER); doc.setFontSize(6.5); sf("italic");
    wtxt("Note: All projections are estimates based on the assumed rates above. Actual returns may vary. This report is for planning purposes only and does not constitute financial advice.", M + 4, afterTable + 5, CW - 8);

    pageFooter(pg, TOTAL_PAGES);

    // ══════════════════════════════════════════════════════
    // PAGES 3 to N — INDIVIDUAL GOAL PAGES
    // ══════════════════════════════════════════════════════
    for (const d of goalData) {
      doc.addPage(); pg++;
      const { g, years, fv, corpus, fvCorpus, shortfall, sip, pct, info,
              health, healthColor, priority, priorityColor, riskProfile } = d;

      pageHeader(`${info?.pdfLabel || ""} ${g.goal_name}`, investor?.name);

      // Health + Priority badges
      doc.setFillColor(healthColor[0], healthColor[1], healthColor[2]); doc.roundedRect(W - M - 52, 5, 25, 9, 1, 1, "F");
      doc.setTextColor(...WHITE); doc.setFontSize(6); sf("bold");
      txt(health, W - M - 52 + 12.5, 10.5, { align: "center" });

      const priColors: Record<string, [number,number,number]> = { HIGH: RED, MEDIUM: AMBER, LOW: GREEN };
      doc.setFillColor((priColors[priority] || GOLD)[0], (priColors[priority] || GOLD)[1], (priColors[priority] || GOLD)[2]; doc.roundedRect(W - M - 25, 5, 22, 9, 1, 1, "F");
      doc.setTextColor(...WHITE); doc.setFontSize(6); sf("bold");
      txt(`${priority} PRIORITY`, W - M - 25 + 11, 10.5, { align: "center" });

      let gy = 26;

      // ── Where Am I Today? (6 info cards) ──
      gy = sectionHead("Where Am I Today?  →  Where Do I Need To Reach?", gy, "");
      const gcW = (CW - 4) / 3;
      const gCards = [
        { label: "Goal (Today's Value)",           value: pdfINR(g.target_amount),    c: GOLD  },
        { label: `Inflation-Adjusted (${g.target_year})`, value: pdfINR(fv),          c: WHITE },
        { label: "Projected from Current Portfolio",value: pdfINR(fvCorpus),          c: GREEN },
        { label: "Remaining Shortfall",             value: pdfINR(shortfall),          c: shortfall > 0 ? RED : GREEN },
        { label: "Additional SIP Required / Month", value: `Rs.${Math.round(sip).toLocaleString("en-IN")}`, c: sip > 0 ? AMBER : GREEN },
        { label: "Years to Goal",                   value: `${years} years (${g.target_year})`, c: WHITE },
      ];
      gCards.forEach((card, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        const cx = M + col * (gcW + 2), cy2 = gy + row * 22;
        doc.setFillColor(...NAVY); doc.roundedRect(cx, cy2, gcW, 20, 2, 2, "F");
        doc.setFillColor(card.c[0], card.c[1], card.c[2]); doc.rect(cx, cy2, 2, 20, "F");
        doc.setTextColor(...MUTED); doc.setFontSize(6); sf("normal");
        txt(wrap(card.label, gcW - 8), cx + 5, cy2 + 6.5);
        doc.setTextColor(card.c[0], card.c[1], card.c[2]); doc.setFontSize(8.5); sf("bold");
        txt(wrap(card.value, gcW - 8), cx + 5, cy2 + 14.5);
      });
      gy += 48;

      // ── How Was This Calculated? ──
      gy = sectionHead("How Was This Calculated?", gy, "");
      doc.setFillColor(...LIGHT); doc.roundedRect(M, gy, CW, 22, 2, 2, "F");
      doc.setFillColor(...GOLD); doc.rect(M, gy, 2, 22, "F");
      const calcCols = [
        ["Today's Value", pdfINR(g.target_amount)],
        ["Inflation Rate", `${g.inflation_rate}% p.a.`],
        ["Time Remaining", `${years} years`],
        ["Future Value", pdfINR(fv)],
        ["Current Corpus", pdfINR(corpus)],
        ["SIP Required", `Rs.${Math.round(sip).toLocaleString("en-IN")}/mo`],
      ];
      const calcW = CW / 6;
      calcCols.forEach(([lbl, val], ci) => {
        const cx = M + 4 + ci * calcW;
        doc.setTextColor(...MUTED); doc.setFontSize(5.5); sf("normal");
        txt(lbl, cx, gy + 8);
        doc.setTextColor(...NAVY); doc.setFontSize(7.5); sf("bold");
        txt(val, cx, gy + 16);
        if (ci < 5) {
          doc.setTextColor(...GOLD); doc.setFontSize(9); sf("bold");
          txt("→", cx + calcW - 4, gy + 13);
        }
      });
      gy += 28;

      // ── Goal Funding Status (progress bar) ──
      gy = sectionHead("Goal Funding Status", gy, "");
      const barW = CW - 40;
      doc.setFillColor(229, 231, 235); doc.roundedRect(M, gy, barW, 9, 2, 2, "F");
      doc.setFillColor(healthColor[0], healthColor[1], healthColor[2]);
      doc.roundedRect(M, gy, Math.max(3, barW * pct / 100), 9, 2, 2, "F");
      doc.setTextColor(healthColor[0], healthColor[1], healthColor[2]); doc.setFontSize(9); sf("bold");
      const fundedLabel = pct < 1 ? "Just Started" : `${pct.toFixed(1)}% Funded`;
      txt(fundedLabel, M + barW + 3, gy + 7);
      gy += 14;

      // Funded vs Shortfall — two separate info lines to avoid overlap
      doc.setFillColor(240, 253, 244); doc.roundedRect(M, gy, CW / 2 - 2, 7, 1, 1, "F");
      doc.setFillColor(254, 242, 242); doc.roundedRect(M + CW / 2 + 2, gy, CW / 2 - 2, 7, 1, 1, "F");
      doc.setTextColor(22, 163, 74); doc.setFontSize(6); sf("bold");
      txt(`Projected Growth: ${pdfINR(fvCorpus)}`, M + 4, gy + 5);
      doc.setTextColor(...RED);
      txt(`Funding Gap: ${pdfINR(shortfall)}`, M + CW / 2 + 6, gy + 5);
      gy += 14;

      // ── Portfolio Allocation for This Goal ──
      // Show each fund's proportional share allocated to this specific goal.
      // corpus = this goal's weighted share of totalInvested.
      // Each fund contributes proportionally: fund_allocated = f.invested * (corpus / totalInvested)
      gy = sectionHead("Portfolio Allocation for This Goal", gy, "");
      const totalFundInvested = funds.reduce((s: number, f: any) => s + f.invested, 0) || 1;
      // corpus is already this goal's weighted share computed in goalData
      const goalShare = corpus / totalFundInvested; // fraction of portfolio belonging to this goal
      const fundRows = funds.map((f: any, idx: number) => {
        const allocatedAmt = f.invested * goalShare;
        const fundPct = (f.invested / totalFundInvested) * 100;
        return [
          String(idx + 1),
          f.scheme,
          f.fund,
          pdfINR(allocatedAmt),           // goal-proportional amount
          `${fundPct.toFixed(1)}%`,        // fund's share of total portfolio
        ];
      });

      autoTable(doc, {
        startY: gy,
        head: [["#", "Scheme Name", "Fund House", "Goal Allocation", "Portfolio %"]],
        body: fundRows.length > 0 ? fundRows : [["—", "No investments mapped yet", "", "", ""]],
        theme: "grid",
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 74 },
          2: { cellWidth: 42 },
          3: { cellWidth: 28 },
          4: { cellWidth: 18 },
        },
        headStyles: { fillColor: NAVY, textColor: GOLD, fontSize: 6.5, fontStyle: "bold", font: "times" },
        bodyStyles: { fontSize: 6.5, font: "times", overflow: "linebreak", textColor: [30, 30, 30] as [number,number,number] },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { cellPadding: 2 },
        margin: { left: M, right: M },
      });

      let finalY = (doc as any).lastAutoTable?.finalY || gy + 30;
      finalY += 6;

      // ── Personalised Recommendation ──
      finalY = sectionHead("Recommended Action", finalY, "");

      if (shortfall <= 0) {
        doc.setFillColor(...LIGHT); doc.roundedRect(M, finalY, CW, 22, 2, 2, "F");
        doc.setFillColor(...GREEN); doc.rect(M, finalY, 3, 22, "F");
        doc.setTextColor(...NAVY); doc.setFontSize(7.5); sf("bold");
        wtxt("Your existing investments are projected to fully meet this goal. Well done!", M + 7, finalY + 9, CW - 14);
        doc.setTextColor(...MUTED); doc.setFontSize(7); sf("normal");
        wtxt("Continue your current SIP discipline and review this goal annually to stay on track.", M + 7, finalY + 16, CW - 14);
        finalY += 28;
      } else {
        // Goal-type-specific opening line
        const goalTypeIntros: Record<string, string> = {
          retirement: `Retirement planning benefits enormously from time. With ${years} years ahead, starting a disciplined SIP now allows compounding to do the heavy lifting for you.`,
          education: `Education costs are rising faster than general inflation. With ${years} years to plan, a consistent SIP today can fully fund this important milestone.`,
          marriage: `Marriage expenses can be planned well in advance. A regular SIP over the next ${years} years can help you celebrate this occasion without financial stress.`,
          house: `Since this is a long-term goal, equity-oriented investments may help you benefit from compounding over the ${years} years remaining before your target date.`,
          car: `Consider starting your SIP now and stepping it up gradually each year. Even small annual increases over ${years} years can make a significant difference to your corpus.`,
          holiday: `A focused savings plan over the next ${years} years can help you enjoy this experience without touching your emergency fund or long-term investments.`,
        };
        const intro = goalTypeIntros[g.goal_type] || `With ${years} years remaining, a disciplined SIP started today can significantly close your funding gap.`;
        const introLines = wrap(intro, CW - 14);
        const sipLine = `An additional SIP of Rs.${Math.round(sip).toLocaleString("en-IN")} per month, started today, can bridge your funding gap and help you achieve your ${g.goal_name} goal by ${g.target_year}.`;
        const sipLines = wrap(sipLine, CW - 14);
        const lumpsum = shortfall / Math.pow(1 + g.expected_return / 100, years);
        const rec2 = `Alternatively, a one-time investment of ${pdfINR(Math.round(lumpsum))} today — if invested at ${g.expected_return}% p.a. — can bridge this shortfall entirely.`;
        const rec2Lines = wrap(rec2, CW - 14);
        const boxH = 10 + (introLines.length + sipLines.length + rec2Lines.length) * 5 + 4;

        doc.setFillColor(...LIGHT); doc.roundedRect(M, finalY, CW, boxH, 2, 2, "F");
        doc.setFillColor(healthColor[0], healthColor[1], healthColor[2]); doc.rect(M, finalY, 3, boxH, "F");

        let ry = finalY + 8;
        doc.setTextColor(...NAVY); doc.setFontSize(7.5); sf("bold");
        wtxt(intro, M + 7, ry, CW - 14); ry += introLines.length * 5 + 3;
        doc.setFontSize(7); sf("normal");
        wtxt(sipLine, M + 7, ry, CW - 14); ry += sipLines.length * 5 + 3;
        doc.setTextColor(...MUTED);
        wtxt(rec2, M + 7, ry, CW - 14);
        finalY += boxH + 6;
      }

      // Smart tips (dynamic based on years + shortfall)
      const tips: string[] = [];
      if (years <= 3)  tips.push("This is a short-term goal. Consider shifting partially to debt or liquid funds to protect your corpus.");
      if (years >= 10) tips.push("A long investment horizon works in your favour. Equity-oriented funds can help generate inflation-beating returns.");
      if (sip > 0)     tips.push(`Increasing your SIP by 10% every year can significantly reduce the gap and potentially surpass your target.`);
      if (pct < 40)    tips.push("This goal has a high shortfall. Consider prioritising it in your next investment review.");
      if (pct >= 75)   tips.push("Your goal is well-funded. Maintain your current investment discipline.");
      tips.push(`Review this goal annually and update the target amount if your expected costs change.`);

      if (tips.length > 0 && finalY < H - 40) {
        doc.setFillColor(235, 245, 255); doc.roundedRect(M, finalY, CW, tips.length * 9 + 8, 2, 2, "F");
        doc.setFillColor(59, 130, 246); doc.rect(M, finalY, 2, tips.length * 9 + 8, "F");
        doc.setTextColor(30, 64, 120); doc.setFontSize(6.5); sf("bold");
        txt("PLANNING TIPS FOR THIS GOAL", M + 6, finalY + 7);
        doc.setTextColor(30, 64, 120); sf("normal");
        tips.forEach((tip, ti) => {
          txt(`•  ${tip}`, M + 6, finalY + 14 + ti * 9, { maxWidth: CW - 12 } as any);
        });
      }

      pageFooter(pg, TOTAL_PAGES);
    }

    // ══════════════════════════════════════════════════════
    // LAST PAGE — STRATEGY SUMMARY + NEXT STEPS + CLOSING
    // ══════════════════════════════════════════════════════
    doc.addPage(); pg++;
    pageHeader("Investment Strategy & Next Steps", investor?.name);

    let ly = 26;

    // Strategy table
    ly = sectionHead("Goal-wise SIP Strategy", ly, "");
    const stratRows = goalData.map((d: any) => [
      `${d.info?.pdfLabel || ""} ${d.g.goal_name}`,
      String(d.g.target_year),
      `${d.years} yrs`,
      pdfINR(d.fv),
      `Rs.${Math.round(d.sip).toLocaleString("en-IN")}/mo`,
      d.health,
      d.priority,
    ]);

    autoTable(doc, {
      startY: ly,
      head: [["Goal", "Year", "Left", "Corpus Required", "Monthly SIP", "Status", "Priority"]],
      body: [
        ...stratRows,
        ["", "", "TOTAL", pdfINR(totalFV), `Rs.${Math.round(totalSIP).toLocaleString("en-IN")}/mo`, "", ""],
      ],
      theme: "grid",
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 16 },
        2: { cellWidth: 13 },
        3: { cellWidth: 34 },
        4: { cellWidth: 30 },
        5: { cellWidth: 24 },
        6: { cellWidth: 21 },
      },
      headStyles: { fillColor: NAVY, textColor: GOLD, fontSize: 7, fontStyle: "bold", font: "times" },
      bodyStyles: { fontSize: 7, font: "times", overflow: "linebreak", textColor: [30, 30, 30] as [number,number,number] },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 2.5 },
      margin: { left: M, right: M },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index === stratRows.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = NAVY;
          data.cell.styles.textColor = GOLD;
        }
      },
    });

    ly = (doc as any).lastAutoTable?.finalY || ly + 60;
    ly += 8;

    // ── Financial Insights ──
    ly = sectionHead("Financial Insights", ly, "");

    const insights: string[] = [];
    const longTermGoals = goalData.filter((d: any) => d.years >= 10).length;
    if (longTermGoals > 0) insights.push(`You have ${longTermGoals} long-term goal(s) with 10+ years remaining — equity-oriented mutual funds can potentially generate inflation-beating returns over this horizon.`);
    if (totalSIP > 0) insights.push(`Starting a combined SIP of Rs.${Math.round(totalSIP).toLocaleString("en-IN")}/month today and increasing it by 10% annually can significantly improve your goal achievement rate.`);
    if (equityPct < 0.5 && avgYears > 7) insights.push("Your current portfolio has a higher debt allocation. Considering your time horizon, increasing equity exposure may improve long-term returns.");
    if (goalData.filter((d: any) => d.pct < 40).length > 0) insights.push("Some goals show high shortfalls. An early review and SIP top-up can dramatically reduce the gap over time.");
    insights.push("Even small, consistent annual increases in your SIP amount (step-up SIP) can have a compounding effect on your wealth over time.");

    const insightBoxH = insights.length * 11 + 8;
    doc.setFillColor(250, 247, 237); doc.roundedRect(M, ly, CW, insightBoxH, 2, 2, "F");
    doc.setFillColor(...GOLD); doc.rect(M, ly, 2, insightBoxH, "F");
    insights.forEach((ins, ii) => {
      doc.setTextColor(...NAVY); doc.setFontSize(7); sf("bold");
      txt("💡", M + 5, ly + 9 + ii * 11);
      doc.setTextColor(50, 50, 50); sf("normal");
      wtxt(ins, M + 12, ly + 9 + ii * 11, CW - 18);
    });
    ly += insightBoxH + 8;

    // ── Next Steps ──
    ly = sectionHead("Your Next Steps", ly, "");
    const nextSteps = [
      ["Start your SIP immediately",           "Every month you delay increases the required SIP. Begin today to maximise compounding."],
      ["Increase SIP by 10% every year",        "A step-up SIP aligned to your salary increment can dramatically shorten your funding gap."],
      ["Review your goals annually",            "Life changes — update target amounts, timelines, and return assumptions every year."],
      ["Update after major life events",        "Marriage, promotion, new child, or any major income change should trigger a goal review."],
      ["Diversify across goal timelines",       "Short-term goals in debt; long-term goals in equity. Match your investment horizon to your fund choice."],
      ["Consult your Mutual Fund Distributor",  "For personalised advice, fund selection, and portfolio rebalancing — reach out to Veera Karthik Subburaj."],
    ];
    const stepH = 12;
    nextSteps.forEach(([title, desc], si) => {
      const sy = ly + si * (stepH + 2);
      doc.setFillColor(si % 2 === 0 ? 248 : 243, 245, 240); doc.roundedRect(M, sy, CW, stepH, 1, 1, "F");
      doc.setFillColor(...GOLD); doc.circle(M + 5, sy + 6, 3, "F");
      doc.setTextColor(...NAVY); doc.setFontSize(5.5); sf("bold");
      txt(String(si + 1), M + 5, sy + 7.5, { align: "center" });
      doc.setTextColor(...NAVY); doc.setFontSize(7); sf("bold");
      txt(title, M + 12, sy + 5.5);
      doc.setTextColor(...MUTED); doc.setFontSize(6.5); sf("normal");
      wtxt(desc, M + 12, sy + 10.5, CW - 18);
    });
    ly += nextSteps.length * (stepH + 2) + 8;

    // ── Financial Readiness Score ──
    ly = sectionHead("Your Financial Readiness Score", ly, "");
    const scoredGoals = goalData.filter((d: any) => d.fv > 0);
    const avgPct = scoredGoals.length > 0
      ? scoredGoals.reduce((s: number, d: any) => s + d.pct, 0) / scoredGoals.length : 0;
    const score = Math.round(Math.min(100, avgPct));
    const scoreColor: [number,number,number] = score >= 70 ? GREEN : score >= 40 ? AMBER : RED;
    const scoreLabel = score >= 70 ? "Good" : score >= 40 ? "Fair" : "Needs Attention";
    const onTrack = goalData.filter((d: any) => d.pct >= 75).length;
    const needsWork = goalData.filter((d: any) => d.pct < 40).length;

    doc.setFillColor(...SLATE); doc.roundedRect(M, ly, CW, 38, 2, 2, "F");
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]); doc.rect(M, ly, 3, 38, "F");

    // Score circle
    const scX = M + 25, scY = ly + 19;
    doc.setFillColor(...NAVY); doc.circle(scX, scY, 16, "F");
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]); doc.circle(scX, scY, 14, "S");
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]); doc.setFontSize(16); sf("bold");
    txt(String(score), scX, scY + 4, { align: "center" });
    doc.setFontSize(5.5); sf("normal"); txt("out of 100", scX, scY + 9, { align: "center" });

    doc.setTextColor(...GOLD2); doc.setFontSize(9); sf("bold");
    txt(`Overall Readiness: ${scoreLabel}`, M + 46, ly + 10);
    doc.setFontSize(7); sf("normal");
    doc.setTextColor(22, 163, 74);
    txt(`Strengths:  ${onTrack} goal(s) on track  ·  Equity allocation supports long-term growth`, M + 46, ly + 18);
    doc.setTextColor(...AMBER);
    txt(`Improve:  Increase monthly SIP  ·  Prioritise ${needsWork} high-impact goal(s)  ·  Review annually`, M + 46, ly + 26);
    doc.setTextColor(156, 163, 175); doc.setFontSize(6); sf("italic");
    txt("Score is based on average goal funding across all identified goals.", M + 46, ly + 34);
    ly += 46;

    // ── Closing CTA ──
    if (ly < H - 55) {
      doc.setFillColor(6, 14, 28); doc.roundedRect(M, ly, CW, 38, 3, 3, "F");
      doc.setFillColor(...GOLD); doc.roundedRect(M, ly, CW, 38, 3, 3, "S");
      doc.setTextColor(...GOLD2); doc.setFontSize(11); sf("bold");
      wtxt("Your financial journey doesn't end here.", W / 2, ly + 11, CW - 10, { align: "center" });
      doc.setTextColor(203, 213, 225); doc.setFontSize(7.5); sf("normal");
      wtxt(
        "This report provides a strong foundation. Regular reviews and personalised guidance can significantly improve your chances of achieving every goal you have set. Connect with your Mutual Fund Distributor for periodic reviews and goal-based investment advice.",
        W / 2, ly + 20, CW - 20, { align: "center" }
      );
      doc.setTextColor(...GOLD); doc.setFontSize(8); sf("bold");
      txt("Veera Karthik Subburaj  |  8148582571  |  veerawealthadvisor@gmail.com", W / 2, ly + 33, { align: "center" });
    }

    // ── Personal Thank You ──
    if (ly < H - 52) {
      doc.setFillColor(15, 31, 61); doc.roundedRect(M, ly, CW, 22, 2, 2, "F");
      doc.setFillColor(...GOLD); doc.rect(M, ly, 2, 22, "F");
      doc.setTextColor(...GOLD2); doc.setFontSize(8); sf("bold");
      txt("Thank you for using InvestWithVeera.", M + 6, ly + 7);
      doc.setTextColor(180, 190, 200); doc.setFontSize(7); sf("normal");
      wtxt("This report is your financial starting point. Staying disciplined with your investments and reviewing your goals regularly can significantly improve your long-term outcomes. If you would like a personalised review or help building a goal-based portfolio, feel free to connect.", M + 6, ly + 13, CW - 12);
      ly += 26;
    }

    // ── Disclaimer ──
    const dlY = H - 32;
    doc.setFillColor(240, 235, 224); doc.roundedRect(M, dlY, CW, 18, 2, 2, "F");
    doc.setFillColor(...AMBER); doc.rect(M, dlY, 2, 18, "F");
    doc.setTextColor(...AMBER); doc.setFontSize(6.5); sf("bold");
    txt("DISCLAIMER", M + 5, dlY + 6);
    doc.setTextColor(...MUTED); doc.setFontSize(6); sf("normal");
    wtxt(
      "Mutual fund investments are subject to market risks. Past performance is not indicative of future results. All projections are estimates based on assumed rates and are for illustrative purposes only. Please read all scheme-related documents carefully before investing. This is an automated report and does not constitute personalised financial advice.",
      M + 5, dlY + 11, CW - 10
    );

    pageFooter(pg, TOTAL_PAGES);

    // ── Save ──
    const fname = `${investor?.name}_Goal_Report_${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.pdf`;
    doc.save(fname);

  } catch (err) {
    console.error("PDF error:", err);
  }
  setPdfLoading(false);
};

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ── UI RENDER ──────────────────────────────────────────────
  // Pre-compute weights once for all goal cards (same formula as PDF)
  const { weights: uiWeights, total: uiTotalWeight } = computeGoalWeights(goals, currentYear);

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
        .nav-btn { background: transparent; border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 0.4rem 1rem; border-radius: 2px; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; text-decoration: none; display: inline-block; }
        .nav-btn:hover { background: var(--gold); color: var(--navy); }
        .nav-btn.gold { background: var(--gold); color: var(--navy); font-weight: 500; }
        .nav-btn.gold:hover { background: var(--gold2); }

        .main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
        .page-header h1 { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; font-weight: 700; color: var(--navy); }
        .page-header p { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
        .header-btns { display: flex; gap: 0.75rem; }

        .empty-state { text-align: center; padding: 4rem 2rem; background: var(--white); border: 1px solid var(--border); border-radius: 12px; }
        .empty-icon { font-size: 3.5rem; margin-bottom: 1rem; }
        .empty-title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; color: var(--navy); margin-bottom: 0.5rem; }
        .empty-sub { font-size: 0.88rem; color: var(--muted); margin-bottom: 1.5rem; }

        .goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
        .goal-card { background: var(--white); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; transition: all 0.2s; }
        .goal-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
        .goal-card-header { padding: 1.25rem; display: flex; align-items: center; gap: 0.75rem; }
        .goal-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
        .goal-name { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 700; color: var(--navy); }
        .goal-year { font-size: 0.75rem; color: var(--muted); }
        .goal-card-body { padding: 0 1.25rem 1rem; }
        .goal-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
        .goal-stat-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
        .goal-stat-val { font-size: 0.9rem; font-weight: 500; color: var(--navy); }
        .goal-stat-val.red { color: var(--red); }
        .goal-stat-val.green { color: var(--green); }
        .progress-wrap { margin-bottom: 1rem; }
        .progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted); margin-bottom: 4px; }
        .progress-bg { background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden; }
        .progress-fill { height: 8px; border-radius: 4px; transition: width 0.5s; }
        .goal-actions { display: flex; gap: 0.5rem; }
        .action-btn { flex: 1; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border); background: none; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; color: var(--muted); }
        .action-btn:hover { border-color: var(--gold); color: var(--navy); }
        .action-btn.danger:hover { border-color: var(--red); color: var(--red); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); }
        .modal { background: var(--white); border-radius: 12px; padding: 2rem; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
        .modal h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; color: var(--navy); margin-bottom: 1.5rem; }
        .form-field { margin-bottom: 1.1rem; }
        .form-field label { display: block; font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; font-weight: 500; }
        .form-field input, .form-field select { width: 100%; padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: var(--navy); outline: none; transition: border-color 0.2s; background: #faf9f6; }
        .form-field input:focus, .form-field select:focus { border-color: var(--gold); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .goal-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .goal-type-btn { padding: 0.6rem; border: 1px solid #e5e7eb; border-radius: 6px; background: none; cursor: pointer; text-align: center; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .goal-type-btn:hover { border-color: var(--gold); }
        .goal-type-btn.selected { border-color: var(--navy); background: var(--navy); }
        .goal-type-btn .type-icon { font-size: 1.25rem; display: block; margin-bottom: 2px; }
        .goal-type-btn .type-label { font-size: 0.7rem; color: var(--muted); }
        .goal-type-btn.selected .type-label { color: var(--gold2); }
        .modal-footer { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
        .btn-save { flex: 2; background: var(--navy); color: white; border: none; padding: 0.85rem; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-save:hover { background: #1a3a5c; }
        .btn-cancel { flex: 1; background: none; border: 1px solid #e5e7eb; color: var(--muted); padding: 0.85rem; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; cursor: pointer; }

        @media (max-width: 768px) {
          .goals-grid { grid-template-columns: 1fr; }
          .main { padding: 1rem; }
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Investor Portal</div>
        <div className="nav-right">
          <a href="/dashboard" className="nav-btn">← Dashboard</a>
          <a href="/calculators" className="nav-btn">Calculators</a>
          <button className="nav-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="main">
        <div className="page-header">
          <div>
            <h1>🎯 My Financial Goals</h1>
            <p>Track your progress towards every life goal — {investor?.name}</p>
          </div>
          <div className="header-btns">
            {goals.length > 0 && (
              <button className="nav-btn gold" onClick={downloadPDF} disabled={pdfLoading}>
                {pdfLoading ? "Generating..." : "📄 Download Report"}
              </button>
            )}
            <button className="nav-btn gold" onClick={() => { setShowAdd(true); setEditGoal(null); setForm({ goal_type: "retirement", goal_name: "", target_amount: "", target_year: currentYear + 10, inflation_rate: 6, expected_return: 12 }); }}>
              + Add Goal
            </button>
          </div>
        </div>

        {goals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <div className="empty-title">No goals set yet</div>
            <div className="empty-sub">Add your first financial goal to see how your investments are tracking towards it</div>
            <button className="nav-btn gold" onClick={() => setShowAdd(true)}>+ Add Your First Goal</button>
          </div>
        ) : (
          <div className="goals-grid">
            {goals.map((goal: any, goalIdx: number) => {
              const years = Math.max(1, goal.target_year - currentYear);
              const fv = calcFutureValue(goal.target_amount, goal.inflation_rate, years);
              // ✅ FIX 7: Use weighted corpus — same formula as PDF
              const corpus = totalInvested * (uiWeights[goalIdx] / uiTotalWeight);
              const fvCorpus = calcFutureValue(corpus, goal.expected_return, years);
              const shortfall = Math.max(0, fv - fvCorpus);
              const sip = calcRequiredSIP(fv, corpus, goal.expected_return, years);
              const pct = Math.min(100, (fvCorpus / fv) * 100);
              const goalInfo = GOAL_TYPES.find((gt: any) => gt.type === goal.goal_type);
              const barColor = pct >= 75 ? "#16a34a" : pct >= 40 ? "#c9a84c" : "#dc2626";

              return (
                <div className="goal-card" key={goal.id}>
                  <div className="goal-card-header">
                    <div className="goal-icon-wrap" style={{ background: `${goalInfo?.color}18` }}>
                      <span>{goalInfo?.icon}</span>
                    </div>
                    <div>
                      <div className="goal-name">{goal.goal_name}</div>
                      <div className="goal-year">Target: {goal.target_year} · {years} years away</div>
                    </div>
                  </div>
                  <div className="goal-card-body">
                    <div className="goal-stats">
                      <div>
                        <div className="goal-stat-label">Target Corpus</div>
                        <div className="goal-stat-val">{formatINR(fv)}</div>
                      </div>
                      <div>
                        <div className="goal-stat-label">Current Value</div>
                        <div className="goal-stat-val">{formatINR(fvCorpus)}</div>
                      </div>
                      <div>
                        <div className="goal-stat-label">Shortfall</div>
                        <div className={`goal-stat-val ${shortfall > 0 ? "red" : "green"}`}>
                          {shortfall > 0 ? formatINR(shortfall) : "On Track ✓"}
                        </div>
                      </div>
                      <div>
                        <div className="goal-stat-label">SIP Needed</div>
                        <div className="goal-stat-val green">
                          {sip > 0 ? `₹${Math.round(sip).toLocaleString("en-IN")}/mo` : "₹0"}
                        </div>
                      </div>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-label">
                        <span>Progress</span>
                        <span style={{ color: barColor, fontWeight: 500 }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="progress-bg">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                    <div className="goal-actions">
                      <button className="action-btn" onClick={() => handleEdit(goal)}>✏️ Edit</button>
                      <button className="action-btn danger" onClick={() => handleDelete(goal.id)}>🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <h2>{editGoal ? "Edit Goal" : "Add New Goal"}</h2>
            <div className="form-field">
              <label>Goal Type</label>
              <div className="goal-type-grid">
                {GOAL_TYPES.map(gt => (
                  <button key={gt.type} className={`goal-type-btn ${form.goal_type === gt.type ? "selected" : ""}`}
                    onClick={() => setForm(f => ({ ...f, goal_type: gt.type, goal_name: gt.label }))}>
                    <span className="type-icon">{gt.icon}</span>
                    <span className="type-label">{gt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>Goal Name</label>
              <input placeholder="e.g. Dhruv's Education" value={form.goal_name}
                onChange={e => setForm(f => ({ ...f, goal_name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Target Amount Today (₹)</label>
                <input type="number" placeholder="e.g. 5000000" value={form.target_amount}
                  onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Target Year</label>
                <input type="number" min={currentYear + 1} max={currentYear + 50} value={form.target_year}
                  onChange={e => setForm(f => ({ ...f, target_year: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Inflation Rate (%)</label>
                <input type="number" min={1} max={15} step={0.5} value={form.inflation_rate}
                  onChange={e => setForm(f => ({ ...f, inflation_rate: parseFloat(e.target.value) }))} />
              </div>
              <div className="form-field">
                <label>Expected Return (%)</label>
                <input type="number" min={1} max={30} step={0.5} value={form.expected_return}
                  onChange={e => setForm(f => ({ ...f, expected_return: parseFloat(e.target.value) }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowAdd(false); setEditGoal(null); }}>Cancel</button>
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editGoal ? "Update Goal →" : "Add Goal →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
