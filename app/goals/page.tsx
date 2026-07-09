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

      // Fetch goals
      const { data: goalsData } = await supabase
        .from("goals").select("*").eq("can", inv.can).order("created_at");
      setGoals(goalsData || []);

      // Fetch unique funds for this investor
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
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      (doc as any).setCharSpace(0);
      const W = 210, H = 297;
      const NAVY = [10, 22, 40];
      const GOLD = [201, 168, 76];
      const CREAM = [245, 240, 232];
      const WHITE = [255, 255, 255];
      const MUTED = [107, 114, 128];
      const GREEN = [22, 163, 74];
      const RED = [220, 38, 38];

      // ── COVER PAGE ──
      // Full navy background
      doc.setFillColor(...NAVY as [number,number,number]);
      doc.rect(0, 0, W, H, "F");

      // ── TOP SECTION (0–58mm): Header bar ──
      // Slightly darker header band
      doc.setFillColor(8, 18, 34);
      doc.rect(0, 0, W, 58, "F");

      // Gold bottom border of header
      doc.setFillColor(...GOLD as [number,number,number]);
      doc.rect(0, 58, W, 1.5, "F");

      // Load logo from public folder
      try {
        const logoRes = await fetch("/icons/icon-512x512.png");
        const logoBlob = await logoRes.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoDataUrl, "PNG", 8, 6, 22, 22);
      } catch {
        doc.setFillColor(...GOLD as [number,number,number]);
        doc.circle(20, 20, 11, "F");
        doc.setFillColor(8, 18, 34);
        doc.circle(20, 20, 8.5, "F");
        doc.setTextColor(...GOLD as [number,number,number]);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("VK", 20, 23, { align: "center" });
      }

      // Advisor name & details
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Veera Karthik Subburaj", 36, 17);
      doc.setTextColor(180, 190, 200);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("AMFI Registered Mutual Fund Distributor  |  ARN: 355717", 36, 24);
      doc.text("8148582571  |  veerawealthadvisor@gmail.com", 36, 30);
      doc.text("investwithveera.vercel.app", 36, 36);

      // Report title (in header area)
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Comprehensive Goal Analysis & Wealth Planning Report", W / 2, 47, { align: "center" });
      doc.setTextColor(203, 213, 225);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.text("A Vision for a Happy & Prosperous Life", W / 2, 54, { align: "center" });

      // ── CLIENT INFO BAR (58–80mm) ──
      doc.setFillColor(15, 31, 61);
      doc.rect(0, 59.5, W, 22, "F");

      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Client Name:", 15, 67);
      doc.setTextColor(...WHITE as [number,number,number]);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(investor?.name || "Investor", 15, 74);

      // Client info pills on right
      const infoDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(`CAN: ${investor?.can}`, W - 15, 67, { align: "right" });
      doc.text(`Report Date: ${infoDate}  |  Initial Net Worth: ${formatINR(totalInvested)}`, W - 15, 74, { align: "right" });

      // ── SUMMARY STATS ROW (82–100mm) ──
      doc.setFillColor(...NAVY as [number,number,number]);
      const totalCorpusRequired = goals.reduce((s, g) => {
        const yrs = Math.max(1, g.target_year - currentYear);
        return s + calcFutureValue(g.target_amount, g.inflation_rate, yrs);
      }, 0);
      const totalNetShortfall = goals.reduce((s, g) => {
        const yrs = Math.max(1, g.target_year - currentYear);
        const fv = calcFutureValue(g.target_amount, g.inflation_rate, yrs);
        const corpus = totalInvested / Math.max(goals.length, 1);
        const fvCorpus = calcFutureValue(corpus, g.expected_return, yrs);
        return s + Math.max(0, fv - fvCorpus);
      }, 0);
      const totalMonthlySIP = goals.reduce((s, g) => {
        const yrs = Math.max(1, g.target_year - currentYear);
        const fv = calcFutureValue(g.target_amount, g.inflation_rate, yrs);
        const corpus = totalInvested / Math.max(goals.length, 1);
        return s + calcRequiredSIP(fv, corpus, g.expected_return, yrs);
      }, 0);

      const statCards = [
        { label: "Identified Goals", value: String(goals.length), color: GOLD },
        { label: "Projected Corpus Needed", value: formatINR(totalCorpusRequired), color: GOLD },
        { label: "Net Planning Shortfall", value: formatINR(totalNetShortfall), color: RED },
        { label: "Est. Monthly Contribution", value: `₹${Math.round(totalMonthlySIP).toLocaleString("en-IN")}`, color: GREEN },
      ];
      const scW = (W - 10) / 4;
      statCards.forEach((sc, i) => {
        const sx = 5 + i * scW;
        doc.setFillColor(15, 28, 54);
        doc.rect(sx, 82, scW - 2, 18, "F");
        doc.setFillColor(...sc.color as [number,number,number]);
        doc.rect(sx, 82, 2, 18, "F");
        doc.setTextColor(130, 140, 155);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.text(sc.label, sx + 5, 88);
        doc.setTextColor(...sc.color as [number,number,number]);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text(sc.value, sx + 5, 96);
      });

      // ── GOALS LIST SECTION (102–195mm) — ~28% of page ──
      // Each goal gets a row: icon + name + year + progress bar + SIP
      let gy = 106;
      const goalRowH = 18;
      const maxGoalsOnCover = 6; // up to 6 goals, ~20% buffer space remaining
      const displayGoals = goals.slice(0, maxGoalsOnCover);

      displayGoals.forEach((goal: any) => {
        const yrs = Math.max(1, goal.target_year - currentYear);
        const fv = calcFutureValue(goal.target_amount, goal.inflation_rate, yrs);
        const corpus = totalInvested / Math.max(goals.length, 1);
        const fvCorpus = calcFutureValue(corpus, goal.expected_return, yrs);
        const shortfall = Math.max(0, fv - fvCorpus);
        const sip = calcRequiredSIP(fv, corpus, goal.expected_return, yrs);
        const pct = Math.min(100, (fvCorpus / fv) * 100);
        const gInfo = GOAL_TYPES.find(gt => gt.type === goal.goal_type);
        const bColor = pct >= 75 ? GREEN : pct >= 40 ? GOLD : RED;

        // Row background alternating
        doc.setFillColor(14, 26, 50);
        doc.rect(5, gy, W - 10, goalRowH - 1, "F");

        // Goal name & year
        doc.setTextColor(...WHITE as [number,number,number]);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text(`${gInfo?.pdfLabel || ""} ${goal.goal_name}`, 10, gy + 6);
        doc.setTextColor(130, 140, 155);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.text(`${goal.target_year}  |  Target: ${formatINR(fv)}  |  SIP: ${formatINR(Math.round(sip))}/mo`, 10, gy + 12);

        // Progress bar (right side)
        const barX = 130;
        const barW = W - barX - 15;
        doc.setFillColor(30, 45, 75);
        doc.roundedRect(barX, gy + 4, barW, 5, 1, 1, "F");
        doc.setFillColor(...bColor as [number,number,number]);
        doc.roundedRect(barX, gy + 4, Math.max(2, barW * pct / 100), 5, 1, 1, "F");

        // % label
        doc.setTextColor(...bColor as [number,number,number]);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text(`${pct.toFixed(0)}%`, W - 12, gy + 8, { align: "right" });

        gy += goalRowH;
      });

      // If more goals than 6, show a note
      if (goals.length > maxGoalsOnCover) {
        doc.setTextColor(156, 163, 175);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text(`+ ${goals.length - maxGoalsOnCover} more goals — see detailed pages`, W / 2, gy + 5, { align: "center" });
        gy += 10;
      }

      // ── BOTTOM SECTION (210–270mm) — charts + assumptions ──
      const bottomY = 210;
      doc.setFillColor(...GOLD as [number,number,number]);
      doc.rect(0, bottomY - 2, W, 1, "F");

      // Section labels
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Current Asset Allocation", 15, bottomY + 6);
      doc.text("Summary of Assumptions", W / 2 + 10, bottomY + 6);

      // ── Asset Allocation Pie (drawn with arcs) ──
      // Compute debt vs equity split from fund names (rough heuristic)
      const equityKeywords = ["equity", "flexi", "large", "mid", "small", "multi", "value", "growth", "elss", "nifty", "sensex"];
      let equityAmt = 0, debtAmt = 0;
      funds.forEach((f: any) => {
        const name = (f.scheme + " " + f.fund).toLowerCase();
        if (equityKeywords.some(k => name.includes(k))) {
          equityAmt += f.invested;
        } else {
          debtAmt += f.invested;
        }
      });
      const totalForPie = equityAmt + debtAmt || 1;
      const equityPct = equityAmt / totalForPie;
      const debtPct = debtAmt / totalForPie;

      const pieX = 40, pieY = bottomY + 30, pieR = 22;

      // Draw pie segments using lines approximation
      // Equity arc
      const equityAngle = equityPct * 2 * Math.PI;
      // Draw filled pie using triangle fan
      const steps = 60;
      // Equity slice
      doc.setFillColor(201, 168, 76);
      for (let s = 0; s < steps; s++) {
        const a1 = (s / steps) * equityAngle - Math.PI / 2;
        const a2 = ((s + 1) / steps) * equityAngle - Math.PI / 2;
        // Draw thin triangle
        doc.triangle(
          pieX, pieY,
          pieX + pieR * Math.cos(a1), pieY + pieR * Math.sin(a1),
          pieX + pieR * Math.cos(a2), pieY + pieR * Math.sin(a2),
          "F"
        );
      }
      // Debt slice
      doc.setFillColor(59, 130, 246);
      for (let s = 0; s < steps; s++) {
        const a1 = equityAngle + (s / steps) * (2 * Math.PI - equityAngle) - Math.PI / 2;
        const a2 = equityAngle + ((s + 1) / steps) * (2 * Math.PI - equityAngle) - Math.PI / 2;
        doc.triangle(
          pieX, pieY,
          pieX + pieR * Math.cos(a1), pieY + pieR * Math.sin(a1),
          pieX + pieR * Math.cos(a2), pieY + pieR * Math.sin(a2),
          "F"
        );
      }

      // Center hole (donut)
      doc.setFillColor(...NAVY as [number,number,number]);
      doc.circle(pieX, pieY, pieR * 0.55, "F");
      // Center text
      doc.setTextColor(...WHITE as [number,number,number]);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`${Math.round(equityPct * 100)}%`, pieX, pieY - 2, { align: "center" });
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      doc.text("Equity", pieX, pieY + 3, { align: "center" });

      // Legend
      doc.setFillColor(201, 168, 76);
      doc.rect(pieX + pieR + 5, bottomY + 20, 6, 4, "F");
      doc.setTextColor(...WHITE as [number,number,number]);
      doc.setFontSize(7);
      doc.text(`Equity: ${Math.round(equityPct * 100)}%`, pieX + pieR + 13, bottomY + 24);

      doc.setFillColor(59, 130, 246);
      doc.rect(pieX + pieR + 5, bottomY + 27, 6, 4, "F");
      doc.text(`Debt: ${Math.round(debtPct * 100)}%`, pieX + pieR + 13, bottomY + 31);

      // ── Assumptions Summary Table (right side) ──
      const avgInflation = goals.length > 0 ? (goals.reduce((s: number, g: any) => s + g.inflation_rate, 0) / goals.length).toFixed(1) : "6.0";
      const avgReturn = goals.length > 0 ? (goals.reduce((s: number, g: any) => s + g.expected_return, 0) / goals.length).toFixed(1) : "12.0";
      const avgYears = goals.length > 0 ? Math.round(goals.reduce((s: number, g: any) => s + Math.max(1, g.target_year - currentYear), 0) / goals.length) : 0;
      const riskProfile = parseFloat(avgReturn) >= 14 ? "Aggressive" : parseFloat(avgReturn) >= 11 ? "Moderate" : "Conservative";

      const assumRows = [
        ["Avg. Inflation Rate", `${avgInflation}%`],
        ["Avg. Expected Return", `${avgReturn}%`],
        ["Risk Profile", riskProfile],
        ["Avg. Time Horizon", `${avgYears} yrs`],
        ["Initial Net Worth", formatINR(totalInvested)],
      ];

      const tX = W / 2 + 10;
      let tY = bottomY + 13;
      assumRows.forEach(([label, val]) => {
        doc.setFillColor(14, 26, 50);
        doc.rect(tX, tY, W - tX - 5, 8, "F");
        doc.setTextColor(130, 140, 155);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.text(label, tX + 3, tY + 5.5);
        doc.setTextColor(...GOLD as [number,number,number]);
        doc.setFont("helvetica", "bold");
        doc.text(val, W - 8, tY + 5.5, { align: "right" });
        tY += 9;
      });

      // ── FOOTER (last 15mm) ──
      doc.setFillColor(6, 14, 28);
      doc.rect(0, H - 15, W, 15, "F");
      doc.setFillColor(...GOLD as [number,number,number]);
      doc.rect(0, H - 15, W, 0.5, "F");
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully.", W / 2, H - 9, { align: "center" });
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("Veera Karthik Subburaj  |  ARN: 355717  |  8148582571", W / 2, H - 4, { align: "center" });

      // ── PAGE 2: GOALS SUMMARY ──
      doc.addPage();
      doc.setFillColor(...NAVY as [number,number,number]);
      doc.rect(0, 0, W, 22, "F");
      doc.setFillColor(...GOLD as [number,number,number]);
      doc.rect(0, 22, W, 1, "F");
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Goals Summary", 15, 15);
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(investor?.name || "", W - 15, 15, { align: "right" });

      let y = 32;
      const totalRequired = goals.reduce((s, g) => {
        const years = g.target_year - currentYear;
        return s + calcFutureValue(g.target_amount, g.inflation_rate, years);
      }, 0);
      const totalShortfall = goals.reduce((s, g) => {
        const years = g.target_year - currentYear;
        const fv = calcFutureValue(g.target_amount, g.inflation_rate, years);
        const corpus = totalInvested / Math.max(goals.length, 1);
        const fvCorpus = calcFutureValue(corpus, g.expected_return, years);
        return s + Math.max(0, fv - fvCorpus);
      }, 0);
      const totalSIP = goals.reduce((s, g) => {
        const years = g.target_year - currentYear;
        const fv = calcFutureValue(g.target_amount, g.inflation_rate, years);
        const corpus = totalInvested / Math.max(goals.length, 1);
        return s + calcRequiredSIP(fv, corpus, g.expected_return, years);
      }, 0);

      // Summary cards
      const cards = [
        { label: "Total Goals", value: String(goals.length), color: NAVY },
        { label: "Total Corpus Required", value: formatINR(totalRequired), color: NAVY },
        { label: "Total Shortfall", value: formatINR(totalShortfall), color: RED },
        { label: "Additional SIP Needed", value: `₹${Math.round(totalSIP).toLocaleString("en-IN")}/mo`, color: [201, 168, 76] },
      ];
      const cardW = (W - 30) / 4;
      cards.forEach((card, i) => {
        const cx = 15 + i * (cardW + 2);
        doc.setFillColor(...NAVY as [number,number,number]);
        doc.roundedRect(cx, y, cardW, 22, 2, 2, "F");
        doc.setFillColor(...card.color as [number,number,number]);
        doc.rect(cx, y, 2, 22, "F");
        doc.setTextColor(156, 163, 175);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(card.label, cx + 5, y + 8);
        doc.setTextColor(...WHITE as [number,number,number]);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(card.value, cx + 5, y + 17);
      });

      y += 30;

      // Goals table
      const tableRows = goals.map(g => {
        const years = Math.max(1, g.target_year - currentYear);
        const fv = calcFutureValue(g.target_amount, g.inflation_rate, years);
        const corpus = totalInvested / Math.max(goals.length, 1);
        const fvCorpus = calcFutureValue(corpus, g.expected_return, years);
        const shortfall = Math.max(0, fv - fvCorpus);
        const sip = calcRequiredSIP(fv, corpus, g.expected_return, years);
        const pct = Math.min(100, (fvCorpus / fv) * 100);
        const goalInfo = GOAL_TYPES.find(gt => gt.type === g.goal_type);
        return [
          `${goalInfo?.pdfLabel || ""} ${g.goal_name}`,
          String(g.target_year),
          String(years) + " yrs",
          formatINR(fv),
          formatINR(fvCorpus),
          formatINR(shortfall),
          `₹${Math.round(sip).toLocaleString("en-IN")}/mo`,
          `${pct.toFixed(0)}%`,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Goal", "Year", "Left", "Target Corpus", "Achieved", "Shortfall", "SIP Needed", "Progress"]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: NAVY as [number,number,number], textColor: GOLD as [number,number,number], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [248, 245, 240] },
        columnStyles: { 5: { textColor: RED as [number,number,number] }, 6: { textColor: GREEN as [number,number,number] } },
        margin: { left: 15, right: 15 },
      });

      // ── INDIVIDUAL GOAL PAGES ──
      for (const goal of goals) {
        doc.addPage();
        const years = Math.max(1, goal.target_year - currentYear);
        const fv = calcFutureValue(goal.target_amount, goal.inflation_rate, years);
        const corpus = totalInvested / Math.max(goals.length, 1);
        const fvCorpus = calcFutureValue(corpus, goal.expected_return, years);
        const shortfall = Math.max(0, fv - fvCorpus);
        const sip = calcRequiredSIP(fv, corpus, goal.expected_return, years);
        const pct = Math.min(100, (fvCorpus / fv) * 100);
        const goalInfo = GOAL_TYPES.find(gt => gt.type === goal.goal_type);

        // Header
        doc.setFillColor(...NAVY as [number,number,number]);
        doc.rect(0, 0, W, 22, "F");
        doc.setFillColor(...GOLD as [number,number,number]);
        doc.rect(0, 22, W, 1, "F");
        doc.setTextColor(...GOLD as [number,number,number]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`${goalInfo?.pdfLabel || ""} ${goal.goal_name}`, 15, 15);
        doc.setTextColor(156, 163, 175);
        doc.setFontSize(8);
        doc.text(investor?.name || "", W - 15, 15, { align: "right" });

        let gy = 30;

        // Stat cards
        const gCards = [
          { label: "Target Amount (Today)", value: formatINR(goal.target_amount) },
          { label: `Inflation Adjusted (${goal.target_year})`, value: formatINR(fv) },
          { label: "Current Corpus", value: formatINR(fvCorpus) },
          { label: "Shortfall", value: formatINR(shortfall) },
          { label: "Additional SIP Needed", value: `₹${Math.round(sip).toLocaleString("en-IN")}/mo` },
          { label: "Years Remaining", value: `${years} years` },
        ];
        const gcW = (W - 30) / 3;
        gCards.forEach((card, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const cx = 15 + col * (gcW + 2);
          const cy = gy + row * 24;
          doc.setFillColor(...NAVY as [number,number,number]);
          doc.roundedRect(cx, cy, gcW, 20, 2, 2, "F");
          doc.setTextColor(156, 163, 175);
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.text(card.label, cx + 5, cy + 7);
          doc.setTextColor(...(i === 3 ? RED : i === 4 ? GREEN : WHITE) as [number,number,number]);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(card.value, cx + 5, cy + 15);
        });

        gy += 55;

        // Progress bar
        doc.setFillColor(...NAVY as [number,number,number]);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY as [number,number,number]);
        doc.text(`Goal Progress: ${pct.toFixed(1)}%`, 15, gy);
        gy += 5;
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(15, gy, W - 30, 8, 2, 2, "F");
        const barColor = pct >= 75 ? GREEN : pct >= 40 ? GOLD : RED;
        doc.setFillColor(...barColor as [number,number,number]);
        doc.roundedRect(15, gy, Math.max(4, (W - 30) * pct / 100), 8, 2, 2, "F");
        gy += 15;

        // Funds table
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY as [number,number,number]);
        doc.text("Mapped Investments", 15, gy);
        gy += 5;

        const totalFundInvested = funds.reduce((s, f) => s + f.invested, 0) || 1;
        const fundRows = funds.map((f, idx) => [
          String(idx + 1),
          f.scheme.length > 40 ? f.scheme.slice(0, 40) + "…" : f.scheme,
          f.fund,
          formatINR(f.invested),
          `${((f.invested / totalFundInvested) * 100).toFixed(1)}%`,
        ]);

        autoTable(doc, {
          startY: gy,
          head: [["#", "Scheme Name", "Fund House", "Amount Invested", "Allocation"]],
          body: fundRows,
          theme: "grid",
          headStyles: { fillColor: NAVY as [number,number,number], textColor: GOLD as [number,number,number], fontSize: 7, fontStyle: "bold" },
          bodyStyles: { fontSize: 7, textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [248, 245, 240] },
          margin: { left: 15, right: 15 },
        });

        // Footer
        const finalY = (doc as any).lastAutoTable?.finalY || gy + 40;
        doc.setFillColor(...NAVY as [number,number,number]);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GOLD as [number,number,number]);
        doc.text("Recommendation", 15, finalY + 10);
        doc.setTextColor(...NAVY as [number,number,number]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        if (shortfall <= 0) {
          doc.setTextColor(...GREEN as [number,number,number]);
          doc.text(`✓ Your existing investments are on track to meet this goal! Keep investing consistently.`, 15, finalY + 18);
        } else {
          doc.text(`To achieve this goal, consider increasing your monthly SIP by ₹${Math.round(sip).toLocaleString("en-IN")}.`, 15, finalY + 18);
          doc.text(`Alternatively, a one-time investment of ${formatINR(shortfall / Math.pow(1 + goal.expected_return / 100, years))} today can bridge this gap.`, 15, finalY + 25);
        }
      }

      // ── LAST PAGE: STRATEGY SUMMARY ──
      doc.addPage();
      doc.setFillColor(...NAVY as [number,number,number]);
      doc.rect(0, 0, W, 22, "F");
      doc.setFillColor(...GOLD as [number,number,number]);
      doc.rect(0, 22, W, 1, "F");
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Investment Strategy Summary", 15, 15);

      let sy = 32;
      doc.setTextColor(...NAVY as [number,number,number]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Recommended Additional Monthly SIP to Meet All Goals:", 15, sy);
      sy += 8;

      const stratRows = goals.map(g => {
        const years = Math.max(1, g.target_year - currentYear);
        const fv = calcFutureValue(g.target_amount, g.inflation_rate, years);
        const corpus = totalInvested / Math.max(goals.length, 1);
        const sip = calcRequiredSIP(fv, corpus, g.expected_return, years);
        const goalInfo = GOAL_TYPES.find(gt => gt.type === g.goal_type);
        return [
          `${goalInfo?.pdfLabel || ""} ${g.goal_name}`,
          String(g.target_year),
          formatINR(fv),
          `₹${Math.round(sip).toLocaleString("en-IN")}`,
          "Monthly SIP",
        ];
      });

      autoTable(doc, {
        startY: sy,
        head: [["Goal", "Target Year", "Corpus Required", "Monthly SIP", "Type"]],
        body: [
          ...stratRows,
          ["", "", "TOTAL ADDITIONAL SIP", `₹${Math.round(totalSIP).toLocaleString("en-IN")}/month`, ""],
        ],
        theme: "grid",
        headStyles: { fillColor: NAVY as [number,number,number], textColor: GOLD as [number,number,number], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 245, 240] },
        margin: { left: 15, right: 15 },
      });

      const lastY = (doc as any).lastAutoTable?.finalY || 150;

      // Disclaimer
      doc.setFillColor(240, 235, 224);
      doc.roundedRect(15, lastY + 10, W - 30, 30, 3, 3, "F");
      doc.setTextColor(...MUTED as [number,number,number]);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("DISCLAIMER", 20, lastY + 17);
      doc.setFont("helvetica", "normal");
      const disclaimer = "Mutual fund investments are subject to market risks. Past performance is not indicative of future results. The projections shown are based on assumed rates of return and inflation and are for illustrative purposes only. Please consult with your financial advisor before making investment decisions.";
      const lines = doc.splitTextToSize(disclaimer, W - 40);
      doc.text(lines, 20, lastY + 23);

      // Signature block
      doc.setFillColor(...NAVY as [number,number,number]);
      doc.rect(0, H - 30, W, 30, "F");
      doc.setTextColor(...GOLD as [number,number,number]);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Veera Karthik Subburaj", 15, H - 18);
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("AMFI Registered Mutual Fund Distributor | ARN: 355717", 15, H - 11);
      doc.text("8148582571 | veerawealthadvisor@gmail.com | investwithveera.vercel.app", 15, H - 6);

      doc.save(`${investor?.name}_Goal_Report_${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
    }
    setPdfLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628", color: "#e8c97a", fontFamily: "DM Sans, sans-serif" }}>
      Loading your goals...
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

        /* MODAL */
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

      {/* NAV */}
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
            {goals.map((goal: any) => {
              const years = Math.max(1, goal.target_year - currentYear);
              const fv = calcFutureValue(goal.target_amount, goal.inflation_rate, years);
              const corpus = totalInvested / Math.max(goals.length, 1);
              const fvCorpus = calcFutureValue(corpus, goal.expected_return, years);
              const shortfall = Math.max(0, fv - fvCorpus);
              const sip = calcRequiredSIP(fv, corpus, goal.expected_return, years);
              const pct = Math.min(100, (fvCorpus / fv) * 100);
              const goalInfo = GOAL_TYPES.find(gt => gt.type === goal.goal_type);
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

      {/* ADD/EDIT MODAL */}
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
                {saving ? "Saving..." : editGoal ? "Update Goal" : "Add Goal →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
