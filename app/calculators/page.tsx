"use client";
import { useState } from "react";

// ─── MATH HELPERS ─────────────────────────────────────────────────────────────

function pvAnnuity(pmt: number, r: number, n: number): number {
  if (r === 0) return pmt * n;
  return pmt * ((1 - Math.pow(1 + r, -n)) / r);
}

function requiredSIP(fv: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return fv / months;
  const factor = ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  return fv / factor;
}

function formatINR(val: number): string {
  return val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function smart(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${formatINR(abs)}`;
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface LumpsumGoal {
  id: number;
  year: number;
  amount: number;   // today's value
  label: string;
}

interface PeriodicGoal {
  id: number;
  startYear: number;
  endYear: number;
  annualAmount: number; // today's value
  label: string;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

let nextId = 1;

export default function GoalPlanner() {
  const currentYear = new Date().getFullYear();

  // Goals
  const [lumpsumGoals, setLumpsumGoals] = useState<LumpsumGoal[]>([
    { id: nextId++, year: 2034, amount: 1000000, label: "Son's Marriage" },
  ]);
  const [periodicGoals, setPeriodicGoals] = useState<PeriodicGoal[]>([
    { id: nextId++, startYear: 2035, endYear: 2045, annualAmount: 100000, label: "Annual Income" },
  ]);

  // Final corpus
  const [finalYear, setFinalYear] = useState(2045);
  const [finalCorpus, setFinalCorpus] = useState(1000000); // today's value, left at the end

  // Assumptions
  const [preReturn, setPreReturn]     = useState(12);
  const [duringReturn, setDuringReturn] = useState(8);
  const [inflation, setInflation]     = useState(6);

  // Existing + SIP
  const [existingLumpsum, setExistingLumpsum] = useState(100000);
  const [sipYears, setSipYears]               = useState(5);

  // ── VALIDATION ───────────────────────────────────────────────────────────────

  const allEvents = [
    ...lumpsumGoals.map(g => g.year),
    ...periodicGoals.flatMap(g => [g.startYear, g.endYear]),
    finalYear,
  ];
  const lastEventYear = Math.max(...allEvents);
  const firstEventYear = Math.min(...allEvents.filter(y => y > currentYear));
  const isValid =
    lumpsumGoals.every(g => g.year > currentYear) &&
    periodicGoals.every(g => g.startYear > currentYear && g.endYear > g.startYear) &&
    finalYear >= lastEventYear - 1;

  // ── COMPUTE REQUIRED CORPUS AT THE EARLIEST FUTURE EVENT ─────────────────────
  //
  // Strategy: work BACKWARDS from the final year.
  // At the final year we need: inflated finalCorpus
  // Then for each event (sorted latest-first), compute PV at the year before it.

  const inf = inflation / 100;
  const dr  = duringReturn / 100;
  const pr  = preReturn / 100;

  // Build a timeline of all cash outflows keyed by year
  // value = amount needed TO BE IN HAND at that year (today's value → inflated)
  type Event = { year: number; type: "lumpsum" | "annuity_start"; amount: number; endYear?: number; label: string };
  const events: Event[] = [];

  lumpsumGoals.forEach(g => {
    events.push({ year: g.year, type: "lumpsum", amount: g.amount, label: g.label });
  });
  periodicGoals.forEach(g => {
    events.push({ year: g.startYear, type: "annuity_start", amount: g.annualAmount, endYear: g.endYear, label: g.label });
  });

  // Sort events by year ascending
  events.sort((a, b) => a.year - b.year);

  // ── YEAR-BY-YEAR SIMULATION ──────────────────────────────────────────────────
  // We'll compute the TOTAL corpus needed at the start (= firstEventYear or earlier).
  // Approach: for each goal, compute its PV at the accumulation-end year.

  // Accumulation ends at firstEventYear (the earliest withdrawal/event year)
  const accEndYear = firstEventYear; // corpus must be ready here

  // For each goal, find PV at accEndYear
  let totalCorpusAtAccEnd = 0;

  // 1. Lumpsum goals: inflate to their year, then discount back to accEndYear
  lumpsumGoals.forEach(g => {
    const yearsFromNow  = g.year - currentYear;
    const inflated      = g.amount * Math.pow(1 + inf, yearsFromNow);
    const yearsFromAcc  = g.year - accEndYear;
    // If the goal is AFTER accEndYear, discount it back; if at accEndYear, use as-is
    const pvAtAcc = yearsFromAcc >= 0
      ? inflated / Math.pow(1 + dr, yearsFromAcc)
      : inflated * Math.pow(1 + dr, -yearsFromAcc); // before acc end — shouldn't happen but safe
    totalCorpusAtAccEnd += pvAtAcc;
  });

  // 2. Periodic goals: PV of annuity at startYear, discounted back to accEndYear
  periodicGoals.forEach(g => {
    const yearsFromNow  = g.startYear - currentYear;
    const inflatedAmt   = g.annualAmount * Math.pow(1 + inf, yearsFromNow);
    const periods       = g.endYear - g.startYear;
    const pvAtStart     = pvAnnuity(inflatedAmt, dr, periods);
    const yearsFromAcc  = g.startYear - accEndYear;
    const pvAtAcc = yearsFromAcc >= 0
      ? pvAtStart / Math.pow(1 + dr, yearsFromAcc)
      : pvAtStart * Math.pow(1 + dr, -yearsFromAcc);
    totalCorpusAtAccEnd += pvAtAcc;
  });

  // 3. Final corpus: inflate to finalYear, discount back to accEndYear
  const inflatedFinal = finalCorpus * Math.pow(1 + inf, finalYear - currentYear);
  const yearsFromAccToFinal = finalYear - accEndYear;
  totalCorpusAtAccEnd += inflatedFinal / Math.pow(1 + dr, yearsFromAccToFinal);

  // ── REQUIRED INVESTMENTS ─────────────────────────────────────────────────────

  const yearsToAccEnd  = accEndYear - currentYear;
  const existingFV     = existingLumpsum * Math.pow(1 + pr, yearsToAccEnd);
  const shortfall      = Math.max(0, totalCorpusAtAccEnd - existingFV);

  // Option A: additional lumpsum today
  const additionalLumpsum = shortfall / Math.pow(1 + pr, yearsToAccEnd);

  // Option B: SIP for sipYears, then compounds remaining years to accEndYear
  const clampedSipYears  = Math.min(sipYears, yearsToAccEnd);
  const remainingYears   = Math.max(0, yearsToAccEnd - clampedSipYears);
  const shortfallAtSipEnd = shortfall / Math.pow(1 + pr, remainingYears);
  const sipMonths        = clampedSipYears * 12;
  const monthlyRate      = pr / 12;
  const monthlySIP       = requiredSIP(shortfallAtSipEnd, monthlyRate, sipMonths);
  const totalSIPInvested = monthlySIP * sipMonths;

  // ── YEAR-BY-YEAR TABLE (lumpsum scenario) ────────────────────────────────────

  interface Row {
    year: number;
    openingCorpus: number;
    withdrawal: number;
    closingCorpus: number;
    phase: "accumulate" | "distribute" | "final";
    notes: string[];
  }

  const tableRows: Row[] = [];
  let corpus = existingLumpsum + additionalLumpsum;

  for (let y = currentYear + 1; y <= Math.max(lastEventYear, finalYear); y++) {
    const isAccPhase = y <= accEndYear;
    const rate = isAccPhase ? pr : dr;

    // Grow first
    const opening = corpus;
    corpus = corpus * (1 + rate);

    // Withdrawals this year
    let withdrawal = 0;
    const notes: string[] = [];

    // Lumpsum goals
    lumpsumGoals.forEach(g => {
      if (g.year === y) {
        const inflated = g.amount * Math.pow(1 + inf, y - currentYear);
        withdrawal += inflated;
        notes.push(`🎯 ${g.label}: ${smart(inflated)}`);
      }
    });

    // Periodic goals
    periodicGoals.forEach(g => {
      if (y > g.startYear && y <= g.endYear) {
        const inflated = g.annualAmount * Math.pow(1 + inf, g.startYear - currentYear);
        withdrawal += inflated;
        notes.push(`💸 ${g.label}: ${smart(inflated)}/yr`);
      }
      if (y === g.startYear) {
        notes.push(`▶ ${g.label} withdrawals begin`);
      }
      if (y === g.endYear) {
        notes.push(`⏹ ${g.label} ends`);
      }
    });

    corpus -= withdrawal;

    tableRows.push({
      year: y,
      openingCorpus: opening,
      withdrawal,
      closingCorpus: corpus,
      phase: y <= accEndYear ? "accumulate" : y === Math.max(lastEventYear, finalYear) ? "final" : "distribute",
      notes,
    });
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────

  const addLumpsum = () => setLumpsumGoals(p => [...p, { id: nextId++, year: currentYear + 10, amount: 500000, label: "New Goal" }]);
  const removeLumpsum = (id: number) => setLumpsumGoals(p => p.filter(g => g.id !== id));
  const updateLumpsum = (id: number, key: keyof LumpsumGoal, val: any) =>
    setLumpsumGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));

  const addPeriodic = () => setPeriodicGoals(p => [...p, { id: nextId++, startYear: currentYear + 10, endYear: currentYear + 20, annualAmount: 100000, label: "New Income" }]);
  const removePeriodic = (id: number) => setPeriodicGoals(p => p.filter(g => g.id !== id));
  const updatePeriodic = (id: number, key: keyof PeriodicGoal, val: any) =>
    setPeriodicGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a;
          --white: #fff; --muted: #6b7280; --border: rgba(0,0,0,0.09);
          --green: #16a34a; --red: #dc2626; --bg: #f0ebe0;
        }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg); }

        .gp-wrap { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
        .gp-title { font-family: 'Cormorant Garamond', serif; font-size: 1.9rem; font-weight: 700; color: var(--navy); margin-bottom: 0.25rem; }
        .gp-sub { font-size: 0.85rem; color: var(--muted); margin-bottom: 2rem; }

        /* ── Sections ── */
        .gp-section { background: var(--white); border: 1px solid var(--border); border-radius: 10px; padding: 1.4rem; margin-bottom: 1.25rem; }
        .gp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .gp-section-title { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .gp-add-btn { font-size: 0.72rem; color: var(--gold); border: 1px solid rgba(201,168,76,0.35); background: rgba(201,168,76,0.06); border-radius: 4px; padding: 0.25rem 0.6rem; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .gp-add-btn:hover { background: rgba(201,168,76,0.12); }

        /* ── Goal row ── */
        .gp-goal-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 0.85rem; background: #faf9f6; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.65rem; position: relative; }
        .gp-goal-row:last-child { margin-bottom: 0; }
        .gp-field { display: flex; flex-direction: column; gap: 3px; }
        .gp-label { font-size: 0.72rem; color: var(--navy); font-weight: 500; }
        .gp-label-hint { font-size: 0.67rem; color: var(--muted); font-weight: 400; }
        .gp-input-row { display: flex; align-items: center; gap: 4px; }
        .gp-prefix { font-size: 0.8rem; color: var(--muted); }
        .gp-suffix { font-size: 0.75rem; color: var(--muted); }
        .gp-input { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.4rem 0.6rem; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 500; color: var(--navy); outline: none; transition: border-color 0.18s; }
        .gp-input:focus { border-color: var(--gold); }
        .gp-input-xs { width: 72px; }
        .gp-input-sm { width: 88px; }
        .gp-input-md { width: 120px; }
        .gp-input-label { width: 150px; }
        .gp-remove-btn { margin-left: auto; font-size: 0.7rem; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer; font-family: 'DM Sans', sans-serif; align-self: center; }
        .gp-remove-btn:hover { color: var(--red); border-color: var(--red); }

        /* ── Two-col layout for inputs ── */
        .gp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }

        /* ── Assumptions row ── */
        .gp-assume-row { display: flex; flex-wrap: wrap; gap: 1.25rem; }
        .gp-assume-field { display: flex; flex-direction: column; gap: 3px; }

        /* ── Results ── */
        .gp-results { background: var(--navy); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.25rem; }
        .gp-results-title { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.4); margin-bottom: 1.1rem; }
        .gp-corpus-banner { background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.25); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.1rem; }
        .gp-corpus-label { font-size: 0.68rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
        .gp-corpus-value { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 700; color: var(--gold2); line-height: 1; }
        .gp-corpus-sub { font-size: 0.72rem; color: rgba(255,255,255,0.3); margin-top: 0.25rem; line-height: 1.5; }
        .gp-options { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .gp-option { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem 1.1rem; }
        .gp-option-tag { font-size: 0.63rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.3); margin-bottom: 0.3rem; }
        .gp-option-value { font-family: 'Cormorant Garamond', serif; font-size: 1.55rem; font-weight: 700; color: var(--gold2); line-height: 1; }
        .gp-option-sub { font-size: 0.71rem; color: rgba(255,255,255,0.3); margin-top: 0.3rem; line-height: 1.55; }
        .gp-option-existing { font-size: 0.71rem; color: rgba(201,168,76,0.55); margin-top: 0.35rem; }

        /* ── Summary pills ── */
        .gp-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 1rem; }
        .gp-pill { font-size: 0.68rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 0.2rem 0.65rem; color: rgba(255,255,255,0.45); }

        /* ── Warn ── */
        .gp-warn { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.82rem; color: #dc2626; margin-bottom: 1.25rem; }

        /* ── Table ── */
        .gp-table-wrap { background: var(--white); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .gp-table-head { padding: 1rem 1.25rem 0.6rem; border-bottom: 1px solid var(--border); }
        .gp-table-head-title { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .gp-table { width: 100%; border-collapse: collapse; font-size: 0.81rem; }
        .gp-table th { padding: 0.5rem 1rem; text-align: left; font-size: 0.67rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); background: #faf9f6; border-bottom: 1px solid var(--border); }
        .gp-table td { padding: 0.5rem 1rem; border-bottom: 1px solid rgba(0,0,0,0.04); color: var(--navy); vertical-align: top; }
        .gp-table tr:last-child td { border-bottom: none; }
        .gp-table tr:hover td { background: #fafaf8; }
        .row-acc td { }
        .row-dist td { background: rgba(201,168,76,0.03); }
        .row-event td { background: rgba(201,168,76,0.07); }
        .row-final td { background: rgba(22,163,74,0.05); font-weight: 600; }
        .gp-gold { color: var(--gold); font-weight: 600; }
        .gp-green { color: var(--green); font-weight: 600; }
        .gp-red-text { color: var(--red); }
        .gp-note-list { display: flex; flex-direction: column; gap: 2px; }
        .gp-note { font-size: 0.69rem; color: var(--muted); }

        .gp-divider { display: flex; align-items: center; gap: 8px; margin: 0.8rem 0 0.6rem; }
        .gp-divider-line { flex: 1; height: 1px; background: var(--border); }
        .gp-divider-text { font-size: 0.68rem; color: var(--muted); }

        @media (max-width: 640px) {
          .gp-two-col { grid-template-columns: 1fr; }
          .gp-options { grid-template-columns: 1fr; }
          .gp-goal-row { gap: 8px; }
        }
      `}</style>

      <div className="gp-wrap">
        <h1 className="gp-title">Goal Planner</h1>
        <p className="gp-sub">
          Mix one-time withdrawals and annual income goals. Get the exact lumpsum or SIP your client needs today.
        </p>

        {/* ── ONE-TIME LUMPSUM GOALS ── */}
        <div className="gp-section">
          <div className="gp-section-header">
            <div className="gp-section-title">One-time withdrawals</div>
            <button className="gp-add-btn" onClick={addLumpsum}>+ Add goal</button>
          </div>

          {lumpsumGoals.map(g => (
            <div className="gp-goal-row" key={g.id}>
              <div className="gp-field">
                <span className="gp-label">Goal name</span>
                <input className="gp-input gp-input-label" value={g.label}
                  onChange={e => updateLumpsum(g.id, "label", e.target.value)} />
              </div>
              <div className="gp-field">
                <span className="gp-label">Amount <span className="gp-label-hint">(today's value)</span></span>
                <div className="gp-input-row">
                  <span className="gp-prefix">₹</span>
                  <input className="gp-input gp-input-md" type="number" value={g.amount}
                    onChange={e => updateLumpsum(g.id, "amount", Number(e.target.value))} />
                </div>
              </div>
              <div className="gp-field">
                <span className="gp-label">In year</span>
                <input className="gp-input gp-input-xs" type="number" value={g.year}
                  onChange={e => updateLumpsum(g.id, "year", Number(e.target.value))} />
              </div>
              {lumpsumGoals.length > 1 && (
                <button className="gp-remove-btn" onClick={() => removeLumpsum(g.id)}>Remove</button>
              )}
            </div>
          ))}
        </div>

        {/* ── PERIODIC INCOME GOALS ── */}
        <div className="gp-section">
          <div className="gp-section-header">
            <div className="gp-section-title">Periodic annual withdrawals</div>
            <button className="gp-add-btn" onClick={addPeriodic}>+ Add income goal</button>
          </div>

          {periodicGoals.map(g => (
            <div className="gp-goal-row" key={g.id}>
              <div className="gp-field">
                <span className="gp-label">Goal name</span>
                <input className="gp-input gp-input-label" value={g.label}
                  onChange={e => updatePeriodic(g.id, "label", e.target.value)} />
              </div>
              <div className="gp-field">
                <span className="gp-label">Annual amount <span className="gp-label-hint">(today's value)</span></span>
                <div className="gp-input-row">
                  <span className="gp-prefix">₹</span>
                  <input className="gp-input gp-input-md" type="number" value={g.annualAmount}
                    onChange={e => updatePeriodic(g.id, "annualAmount", Number(e.target.value))} />
                  <span className="gp-suffix">/yr</span>
                </div>
              </div>
              <div className="gp-field">
                <span className="gp-label">From year</span>
                <input className="gp-input gp-input-xs" type="number" value={g.startYear}
                  onChange={e => updatePeriodic(g.id, "startYear", Number(e.target.value))} />
              </div>
              <div className="gp-field">
                <span className="gp-label">To year</span>
                <input className="gp-input gp-input-xs" type="number" value={g.endYear}
                  onChange={e => updatePeriodic(g.id, "endYear", Number(e.target.value))} />
              </div>
              {periodicGoals.length > 1 && (
                <button className="gp-remove-btn" onClick={() => removePeriodic(g.id)}>Remove</button>
              )}
            </div>
          ))}
        </div>

        {/* ── FINAL CORPUS + EXISTING + ASSUMPTIONS ── */}
        <div className="gp-section">
          <div className="gp-two-col">
            {/* Left: Final corpus + existing */}
            <div>
              <div className="gp-section-title" style={{ marginBottom: "1rem" }}>Corpus & existing investment</div>
              <div className="gp-goal-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.85rem" }}>
                <div className="gp-field">
                  <span className="gp-label">Final corpus to leave behind <span className="gp-label-hint">(today's value)</span></span>
                  <div className="gp-input-row">
                    <span className="gp-prefix">₹</span>
                    <input className="gp-input gp-input-md" type="number" value={finalCorpus}
                      onChange={e => setFinalCorpus(Number(e.target.value))} />
                    <span className="gp-suffix">by year</span>
                    <input className="gp-input gp-input-xs" type="number" value={finalYear}
                      onChange={e => setFinalYear(Number(e.target.value))} />
                  </div>
                </div>
                <div className="gp-field">
                  <span className="gp-label">Existing investment today</span>
                  <div className="gp-input-row">
                    <span className="gp-prefix">₹</span>
                    <input className="gp-input gp-input-md" type="number" value={existingLumpsum}
                      onChange={e => setExistingLumpsum(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Assumptions + SIP */}
            <div>
              <div className="gp-section-title" style={{ marginBottom: "1rem" }}>Assumptions</div>
              <div className="gp-goal-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.85rem" }}>
                <div className="gp-assume-row">
                  <div className="gp-assume-field">
                    <span className="gp-label">Return — accumulation</span>
                    <div className="gp-input-row">
                      <input className="gp-input gp-input-xs" type="number" step="0.5" value={preReturn}
                        onChange={e => setPreReturn(Number(e.target.value))} />
                      <span className="gp-suffix">%/yr</span>
                    </div>
                  </div>
                  <div className="gp-assume-field">
                    <span className="gp-label">Return — distribution</span>
                    <div className="gp-input-row">
                      <input className="gp-input gp-input-xs" type="number" step="0.5" value={duringReturn}
                        onChange={e => setDuringReturn(Number(e.target.value))} />
                      <span className="gp-suffix">%/yr</span>
                    </div>
                  </div>
                  <div className="gp-assume-field">
                    <span className="gp-label">Inflation</span>
                    <div className="gp-input-row">
                      <input className="gp-input gp-input-xs" type="number" step="0.5" value={inflation}
                        onChange={e => setInflation(Number(e.target.value))} />
                      <span className="gp-suffix">%/yr</span>
                    </div>
                  </div>
                </div>
                <div className="gp-divider">
                  <div className="gp-divider-line" /><span className="gp-divider-text">SIP option</span><div className="gp-divider-line" />
                </div>
                <div className="gp-assume-field">
                  <span className="gp-label">Invest via SIP for</span>
                  <div className="gp-input-row">
                    <input className="gp-input gp-input-xs" type="number" value={sipYears}
                      onChange={e => setSipYears(Number(e.target.value))} />
                    <span className="gp-suffix">years from today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULTS ── */}
        {!isValid ? (
          <div className="gp-warn">⚠️ Check your years — all goal years must be in the future, and withdrawal end must be after start.</div>
        ) : (
          <div className="gp-results">
            <div className="gp-results-title">What your client needs to invest</div>

            <div className="gp-corpus-banner">
              <div className="gp-corpus-label">Total corpus required by {accEndYear}</div>
              <div className="gp-corpus-value">{smart(totalCorpusAtAccEnd)}</div>
              <div className="gp-corpus-sub">
                Covers all goals below, inflation-adjusted · Earliest event is in {accEndYear}
              </div>
            </div>

            <div className="gp-options">
              <div className="gp-option">
                <div className="gp-option-tag">Option A — Additional lumpsum today</div>
                <div className="gp-option-value">{smart(additionalLumpsum)}</div>
                <div className="gp-option-sub">
                  Invest now · grows at {preReturn}% for {yearsToAccEnd} years
                </div>
                {existingLumpsum > 0 && (
                  <div className="gp-option-existing">
                    + existing ₹{formatINR(existingLumpsum)} → grows to {smart(existingFV)} by {accEndYear}
                  </div>
                )}
              </div>

              <div className="gp-option">
                <div className="gp-option-tag">Option B — Monthly SIP for {clampedSipYears} yrs</div>
                <div className="gp-option-value">{smart(monthlySIP)}/mo</div>
                <div className="gp-option-sub">
                  Total invested: {smart(totalSIPInvested)}<br />
                  {remainingYears > 0
                    ? `SIP stops after ${clampedSipYears} yrs · compounds ${remainingYears} more yrs to ${accEndYear}`
                    : `SIP runs until ${accEndYear}`}
                </div>
                {existingLumpsum > 0 && (
                  <div className="gp-option-existing">
                    + existing ₹{formatINR(existingLumpsum)} → grows to {smart(existingFV)} by {accEndYear}
                  </div>
                )}
              </div>
            </div>

            {/* Summary pills */}
            <div className="gp-pills">
              {lumpsumGoals.map(g => (
                <span className="gp-pill" key={g.id}>
                  🎯 {g.label} {g.year}: {smart(g.amount * Math.pow(1 + inf, g.year - currentYear))}
                </span>
              ))}
              {periodicGoals.map(g => (
                <span className="gp-pill" key={g.id}>
                  💸 {g.label} {g.startYear}–{g.endYear}: {smart(g.annualAmount * Math.pow(1 + inf, g.startYear - currentYear))}/yr
                </span>
              ))}
              <span className="gp-pill">
                🏦 Final corpus {finalYear}: {smart(inflatedFinal)}
              </span>
            </div>
          </div>
        )}

        {/* ── YEAR-BY-YEAR TABLE ── */}
        {isValid && (
          <div className="gp-table-wrap">
            <div className="gp-table-head">
              <div className="gp-table-head-title">Year-by-year projection · lumpsum scenario</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="gp-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Opening Corpus</th>
                    <th>Withdrawal</th>
                    <th>Closing Corpus</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    const hasEvent = row.withdrawal > 0;
                    const isFinal = row.year === Math.max(lastEventYear, finalYear);
                    const rowClass = isFinal ? "row-final" : hasEvent ? "row-event" : row.phase === "distribute" ? "row-dist" : "row-acc";
                    return (
                      <tr key={i} className={rowClass}>
                        <td><strong>{row.year}</strong></td>
                        <td>{smart(row.openingCorpus)}</td>
                        <td className={row.withdrawal > 0 ? "gp-red-text" : ""}>{row.withdrawal > 0 ? `− ${smart(row.withdrawal)}` : "—"}</td>
                        <td className={isFinal ? "gp-green" : row.closingCorpus < 0 ? "gp-red-text" : "gp-gold"}>
                          {smart(row.closingCorpus)}
                        </td>
                        <td>
                          {row.notes.length > 0 && (
                            <div className="gp-note-list">
                              {row.notes.map((n, j) => <span className="gp-note" key={j}>{n}</span>)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
