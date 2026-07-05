"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

function formatINR(val: number) {
  return val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatY(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val.toFixed(0)}`;
}

function smart(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${formatINR(abs)}`;
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function SliderInput({ label, value, min, max, step, onChange, format, unit = "", minWarn }: any) {
  const [inputVal, setInputVal] = useState(String(value));
  const [error, setError] = useState("");
  const pct = ((value - min) / (max - min)) * 100;

  const handleSlider = (e: any) => {
    const v = parseFloat(e.target.value);
    onChange(v);
    setInputVal(String(v));
    setError("");
  };

  const handleInput = (e: any) => {
    const raw = e.target.value.replace(/,/g, "");
    setInputVal(raw);
    const v = parseFloat(raw);
    if (isNaN(v)) { setError("Enter a valid number"); return; }
    if (minWarn && v < minWarn) { setError(`Minimum value is ${minWarn}`); onChange(minWarn); return; }
    if (v < min) { setError(`Minimum is ${min}`); onChange(min); return; }
    if (v > max) { setError(`Maximum is ${max}`); onChange(max); return; }
    setError("");
    onChange(v);
  };

  const handleBlur = () => {
    const raw = inputVal.replace(/,/g, "");
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= min && v <= max) {
      setInputVal(String(v));
    } else {
      setInputVal(String(value));
      setError("");
    }
  };

  return (
    <div className="input-group">
      <div className="input-label-row">
        <label>{label}</label>
        <div className="input-box-wrap">
          {unit === "₹" && <span className="unit-prefix">₹</span>}
          <input
            className={`val-input ${error ? "val-input-error" : ""}`}
            value={inputVal}
            onChange={handleInput}
            onBlur={handleBlur}
          />
          {unit && unit !== "₹" && <span className="unit-suffix">{unit}</span>}
        </div>
      </div>
      <div className="slider-wrap">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={handleSlider} className="slider"
          style={{ background: `linear-gradient(to right, #c9a84c ${pct}%, #e5e7eb ${pct}%)` }}
        />
      </div>
      <div className="slider-bounds">
        <span>{format ? format(min) : min}{unit && unit !== "₹" ? unit : ""}</span>
        <span>{format ? format(max) : max}{unit && unit !== "₹" ? unit : ""}</span>
      </div>
      {error && <div className="input-error">{error}</div>}
    </div>
  );
}

function LineChart({ points, invested, labels }: any) {
  if (!points || points.length === 0) return null;
  const maxVal = Math.max(...points, ...invested);
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const W = 500, H = 180, padL = 60, padB = 28, padT = 16, padR = 16;
  const chartW = W - padL - padR;
  const chartH = H - padB - padT;

  const px = (i: number) => padL + (i / (points.length - 1)) * chartW;
  const py = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  const fvLine = points.map((v: number, i: number) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(v)}`).join(" ");
  const invLine = invested.map((v: number, i: number) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(v)}`).join(" ");
  const fvArea = [`M ${px(0)} ${py(points[0])}`, ...points.map((v: number, i: number) => `L ${px(i)} ${py(v)}`), `L ${px(points.length - 1)} ${py(minVal)}`, `L ${px(0)} ${py(minVal)} Z`].join(" ");
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (range / yTicks) * i);
  const xStep = Math.ceil(labels.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, overflow: "visible" }}>
      <defs>
        <linearGradient id="fvGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTickVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={py(v)} x2={W - padR} y2={py(v)} stroke="#e5e7eb" strokeWidth="0.8" strokeDasharray="3,3" />
          <text x={padL - 6} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{formatY(v)}</text>
        </g>
      ))}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />
      <path d={[`M ${px(0)} ${py(invested[0])}`, ...invested.map((v: number, i: number) => `L ${px(i)} ${py(v)}`), `L ${px(invested.length - 1)} ${py(minVal)}`, `L ${px(0)} ${py(minVal)} Z`].join(" ")} fill="rgba(10,22,40,0.06)" />
      <path d={fvArea} fill="url(#fvGrad)" />
      <path d={invLine} fill="none" stroke="#0a1628" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
      <path d={fvLine} fill="none" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {labels.map((l: string, i: number) => (i % xStep === 0 || i === labels.length - 1) ? (
        <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{l}</text>
      ) : null)}
      <circle cx={px(points.length - 1)} cy={py(points[points.length - 1])} r="4" fill="#c9a84c" />
      <circle cx={px(invested.length - 1)} cy={py(invested[invested.length - 1])} r="3" fill="#0a1628" opacity="0.5" />
    </svg>
  );
}

// ─── SIP CALCULATOR ───────────────────────────────────────────────────────────

function SIPCalculator() {
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const [stepUp, setStepUp] = useState(false);
  const [stepRate, setStepRate] = useState(10);

  const isValid = monthly >= 500;

  const calculate = useCallback(() => {
    const months = years * 12;
    let fv = 0, totalInv = 0;
    const yearlyFV: number[] = [];
    const yearlyInv: number[] = [];
    const xlabels: string[] = [];

    if (!stepUp) {
      const r = rate / 100 / 12;
      for (let yr = 1; yr <= years; yr++) {
        const m = yr * 12;
        const v = r === 0 ? monthly * m : monthly * ((Math.pow(1 + r, m) - 1) / r) * (1 + r);
        yearlyFV.push(v);
        yearlyInv.push(monthly * m);
        xlabels.push(`Yr ${yr}`);
      }
      fv = yearlyFV[years - 1];
      totalInv = monthly * months;
    } else {
      let runningFV = 0;
      let currentSIP = monthly;
      totalInv = 0;
      for (let yr = 1; yr <= years; yr++) {
        const r = rate / 100 / 12;
        for (let m = 0; m < 12; m++) {
          runningFV = (runningFV + currentSIP) * (1 + r);
          totalInv += currentSIP;
        }
        yearlyFV.push(runningFV);
        yearlyInv.push(totalInv);
        xlabels.push(`Yr ${yr}`);
        currentSIP = currentSIP * (1 + stepRate / 100);
      }
      fv = runningFV;
    }
    return { fv, totalInv, yearlyFV, yearlyInv, xlabels };
  }, [monthly, rate, years, stepUp, stepRate]);

  const { fv, totalInv, yearlyFV, yearlyInv, xlabels } = calculate();
  const wealthGain = fv - totalInv;
  const gainPct = totalInv > 0 ? ((wealthGain / totalInv) * 100).toFixed(1) : "0";

  return (
    <div className="calc-card">
      <div className="calc-header">
        <div className="calc-icon">📈</div>
        <div>
          <h2>SIP Calculator</h2>
          <p>Systematic Investment Plan — invest monthly and watch it grow</p>
        </div>
      </div>
      {!isValid && <div className="warn-box">⚠️ Monthly SIP must be at least ₹500 to see results</div>}
      <div className="inputs-grid">
        <SliderInput label="Monthly SIP Amount" value={monthly} min={500} max={100000} step={500} onChange={setMonthly} format={(v: number) => `₹${formatINR(v)}`} unit="₹" minWarn={500} />
        <SliderInput label="Expected Annual Return" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" />
        <SliderInput label="Investment Period" value={years} min={1} max={40} step={1} onChange={setYears} unit=" yrs" />
      </div>
      <div className="stepup-row">
        <label className="stepup-label">
          <input type="checkbox" checked={stepUp} onChange={e => setStepUp(e.target.checked)} className="stepup-check" />
          <span>Step-up SIP</span>
          <span className="stepup-hint">Increase SIP by a fixed % every year</span>
        </label>
        {stepUp && <SliderInput label="Annual Step-up Rate" value={stepRate} min={1} max={50} step={1} onChange={setStepRate} unit="%" />}
      </div>
      {isValid && (
        <>
          <div className="result-grid">
            <div className="result-stat">
              <div className="result-label">Total Invested</div>
              <div className="result-value navy">₹{formatINR(totalInv)}</div>
            </div>
            <div className="result-stat">
              <div className="result-label">Wealth Gained</div>
              <div className="result-value green">+₹{formatINR(wealthGain)}</div>
              <div className="result-sub">{gainPct}% gain</div>
            </div>
            <div className="result-stat highlight">
              <div className="result-label">Future Value</div>
              <div className="result-value gold">₹{formatINR(fv)}</div>
              <div className="result-sub">After {years} years</div>
            </div>
          </div>
          <div className="chart-section">
            <div className="chart-title">Portfolio growth over time</div>
            <LineChart points={yearlyFV} invested={yearlyInv} labels={xlabels} />
            <div className="chart-legend">
              <span className="legend-line gold-line" />Future Value
              <span className="legend-line navy-line" style={{ marginLeft: 16 }} />Amount Invested
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── LUMPSUM CALCULATOR ───────────────────────────────────────────────────────

function LumpSumCalculator() {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);

  const isValid = principal >= 1000;
  const yearlyFV = Array.from({ length: years }, (_, i) => principal * Math.pow(1 + rate / 100, i + 1));
  const yearlyInv = Array.from({ length: years }, () => principal);
  const xlabels = Array.from({ length: years }, (_, i) => `Yr ${i + 1}`);
  const fv = yearlyFV[years - 1] || principal;
  const wealthGain = fv - principal;
  const gainPct = ((wealthGain / principal) * 100).toFixed(1);
  const doublingYears = (Math.log(2) / Math.log(1 + rate / 100)).toFixed(1);

  return (
    <div className="calc-card">
      <div className="calc-header">
        <div className="calc-icon">💰</div>
        <div>
          <h2>Lump Sum / CAGR Calculator</h2>
          <p>One-time investment — see how your money compounds over time</p>
        </div>
      </div>
      {!isValid && <div className="warn-box">⚠️ Investment amount must be at least ₹1,000</div>}
      <div className="inputs-grid">
        <SliderInput label="Investment Amount" value={principal} min={1000} max={10000000} step={1000} onChange={setPrincipal} format={(v: number) => `₹${formatINR(v)}`} unit="₹" minWarn={1000} />
        <SliderInput label="Expected CAGR" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" />
        <SliderInput label="Investment Period" value={years} min={1} max={40} step={1} onChange={setYears} unit=" yrs" />
      </div>
      {isValid && (
        <>
          <div className="result-grid">
            <div className="result-stat">
              <div className="result-label">Amount Invested</div>
              <div className="result-value navy">₹{formatINR(principal)}</div>
            </div>
            <div className="result-stat">
              <div className="result-label">Wealth Gained</div>
              <div className="result-value green">+₹{formatINR(wealthGain)}</div>
              <div className="result-sub">{gainPct}% total gain</div>
            </div>
            <div className="result-stat highlight">
              <div className="result-label">Future Value</div>
              <div className="result-value gold">₹{formatINR(fv)}</div>
              <div className="result-sub">At {rate}% CAGR · {years} yrs</div>
            </div>
          </div>
          <div className="chart-section">
            <div className="chart-title">Compounding growth curve</div>
            <LineChart points={yearlyFV} invested={yearlyInv} labels={xlabels} />
            <div className="chart-legend">
              <span className="legend-line gold-line" />Portfolio Value
              <span className="legend-line navy-line" style={{ marginLeft: 16 }} />Amount Invested
            </div>
          </div>
          <div className="tip-box">
            💡 <strong>Rule of 72:</strong> At {rate}% CAGR, your money doubles every <strong>{doublingYears} years</strong>
          </div>
        </>
      )}
    </div>
  );
}

// ─── GOAL PLANNER MATH ────────────────────────────────────────────────────────

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

interface LumpsumGoal { id: number; year: number; amount: number; label: string; }
interface PeriodicGoal { id: number; startYear: number; endYear: number; annualAmount: number; label: string; }

let nextId = 1;

// ─── GOAL PLANNER ─────────────────────────────────────────────────────────────

function GoalPlanner() {
  const currentYear = new Date().getFullYear();

  const [lumpsumGoals, setLumpsumGoals] = useState<LumpsumGoal[]>([
    { id: nextId++, year: 2034, amount: 1000000, label: "Son's Marriage" },
  ]);
  const [periodicGoals, setPeriodicGoals] = useState<PeriodicGoal[]>([
    { id: nextId++, startYear: 2035, endYear: 2045, annualAmount: 100000, label: "Annual Income" },
  ]);

  const [finalYear, setFinalYear]         = useState(2045);
  const [finalCorpus, setFinalCorpus]     = useState(1000000);
  const [preReturn, setPreReturn]         = useState(12);
  const [duringReturn, setDuringReturn]   = useState(8);
  const [inflation, setInflation]         = useState(6);
  const [existingLumpsum, setExistingLumpsum] = useState(100000);
  const [sipYears, setSipYears]           = useState(5);

  const inf = inflation / 100;
  const dr  = duringReturn / 100;
  const pr  = preReturn / 100;

  const allEventYears = [
    ...lumpsumGoals.map(g => g.year),
    ...periodicGoals.flatMap(g => [g.startYear, g.endYear]),
    finalYear,
  ].filter(y => y > currentYear);

  const isValid =
    allEventYears.length > 0 &&
    lumpsumGoals.every(g => g.year > currentYear) &&
    periodicGoals.every(g => g.startYear > currentYear && g.endYear > g.startYear);

  const lastEventYear  = isValid ? Math.max(...allEventYears) : currentYear + 20;
  const firstEventYear = isValid ? Math.min(...allEventYears) : currentYear + 10;
  const accEndYear     = firstEventYear;
  const yearsToAccEnd  = accEndYear - currentYear;

  // Corpus needed at accEndYear: PV of every future obligation
  let totalCorpusAtAccEnd = 0;

  lumpsumGoals.forEach(g => {
    const inflated    = g.amount * Math.pow(1 + inf, g.year - currentYear);
    const yearsGap    = g.year - accEndYear;
    totalCorpusAtAccEnd += yearsGap >= 0
      ? inflated / Math.pow(1 + dr, yearsGap)
      : inflated * Math.pow(1 + dr, -yearsGap);
  });

  periodicGoals.forEach(g => {
    const inflatedAmt = g.annualAmount * Math.pow(1 + inf, g.startYear - currentYear);
    const periods     = g.endYear - g.startYear;
    const pvAtStart   = pvAnnuity(inflatedAmt, dr, periods);
    const yearsGap    = g.startYear - accEndYear;
    totalCorpusAtAccEnd += yearsGap >= 0
      ? pvAtStart / Math.pow(1 + dr, yearsGap)
      : pvAtStart * Math.pow(1 + dr, -yearsGap);
  });

  const inflatedFinal = finalCorpus * Math.pow(1 + inf, finalYear - currentYear);
  totalCorpusAtAccEnd += inflatedFinal / Math.pow(1 + dr, Math.max(0, finalYear - accEndYear));

  // Required investments
  const existingFV        = existingLumpsum * Math.pow(1 + pr, yearsToAccEnd);
  const shortfall         = Math.max(0, totalCorpusAtAccEnd - existingFV);
  const additionalLumpsum = shortfall / Math.pow(1 + pr, yearsToAccEnd);

  const clampedSipYears    = Math.min(sipYears, yearsToAccEnd);
  const remainingYears     = Math.max(0, yearsToAccEnd - clampedSipYears);
  const shortfallAtSipEnd  = shortfall / Math.pow(1 + pr, remainingYears);
  const sipMonths          = clampedSipYears * 12;
  const monthlyRate        = pr / 12;
  const monthlySIP         = requiredSIP(shortfallAtSipEnd, monthlyRate, sipMonths);
  const totalSIPInvested   = monthlySIP * sipMonths;

  // Year-by-year table
  interface Row { year: number; openingCorpus: number; withdrawal: number; closingCorpus: number; isEvent: boolean; isFinal: boolean; notes: string[]; }
  const tableRows: Row[] = [];
  let corpus = existingLumpsum + additionalLumpsum;

  for (let y = currentYear + 1; y <= Math.max(lastEventYear, finalYear); y++) {
    const isAccPhase = y <= accEndYear;
    const rate = isAccPhase ? pr : dr;
    const opening = corpus;
    corpus = corpus * (1 + rate);

    let withdrawal = 0;
    const notes: string[] = [];

    lumpsumGoals.forEach(g => {
      if (g.year === y) {
        const inflated = g.amount * Math.pow(1 + inf, y - currentYear);
        withdrawal += inflated;
        notes.push(`🎯 ${g.label}: ${smart(inflated)}`);
      }
    });

    periodicGoals.forEach(g => {
      if (y > g.startYear && y <= g.endYear) {
        const inflated = g.annualAmount * Math.pow(1 + inf, g.startYear - currentYear);
        withdrawal += inflated;
        notes.push(`💸 ${g.label}: ${smart(inflated)}/yr`);
      }
      if (y === g.startYear) notes.push(`▶ ${g.label} begins`);
      if (y === g.endYear)   notes.push(`⏹ ${g.label} ends`);
    });

    corpus -= withdrawal;
    const isFinal = y === Math.max(lastEventYear, finalYear);
    tableRows.push({ year: y, openingCorpus: opening, withdrawal, closingCorpus: corpus, isEvent: withdrawal > 0, isFinal, notes });
  }

  // Helpers
  const addLumpsum    = () => setLumpsumGoals(p => [...p, { id: nextId++, year: currentYear + 10, amount: 500000, label: "New Goal" }]);
  const removeLumpsum = (id: number) => setLumpsumGoals(p => p.filter(g => g.id !== id));
  const updL          = (id: number, key: keyof LumpsumGoal, val: any) => setLumpsumGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));

  const addPeriodic    = () => setPeriodicGoals(p => [...p, { id: nextId++, startYear: currentYear + 10, endYear: currentYear + 20, annualAmount: 100000, label: "New Income" }]);
  const removePeriodic = (id: number) => setPeriodicGoals(p => p.filter(g => g.id !== id));
  const updP           = (id: number, key: keyof PeriodicGoal, val: any) => setPeriodicGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));

  return (
    <div className="calc-card">
      <div className="calc-header">
        <div className="calc-icon">🎯</div>
        <div>
          <h2>Goal-Based Investment Planner</h2>
          <p>Mix one-time withdrawals and annual income goals — get the exact amount to invest today</p>
        </div>
      </div>

      {/* ONE-TIME GOALS */}
      <div className="gp-section">
        <div className="gp-section-header">
          <div className="gp-section-title">One-time withdrawals</div>
          <button className="gp-add-btn" onClick={addLumpsum}>+ Add goal</button>
        </div>
        {lumpsumGoals.map(g => (
          <div className="gp-goal-row" key={g.id}>
            <div className="gp-field">
              <span className="gp-label">Goal name</span>
              <input className="gp-input gp-input-label" value={g.label} onChange={e => updL(g.id, "label", e.target.value)} />
            </div>
            <div className="gp-field">
              <span className="gp-label">Amount <span className="gp-label-hint">(today&apos;s value)</span></span>
              <div className="gp-input-row">
                <span className="gp-prefix">₹</span>
                <input className="gp-input gp-input-md" type="number" value={g.amount} onChange={e => updL(g.id, "amount", Number(e.target.value))} />
              </div>
            </div>
            <div className="gp-field">
              <span className="gp-label">In year</span>
              <input className="gp-input gp-input-xs" type="number" value={g.year} onChange={e => updL(g.id, "year", Number(e.target.value))} />
            </div>
            {lumpsumGoals.length > 1 && (
              <button className="gp-remove-btn" onClick={() => removeLumpsum(g.id)}>Remove</button>
            )}
          </div>
        ))}
      </div>

      {/* PERIODIC GOALS */}
      <div className="gp-section">
        <div className="gp-section-header">
          <div className="gp-section-title">Periodic annual withdrawals</div>
          <button className="gp-add-btn" onClick={addPeriodic}>+ Add income goal</button>
        </div>
        {periodicGoals.map(g => (
          <div className="gp-goal-row" key={g.id}>
            <div className="gp-field">
              <span className="gp-label">Goal name</span>
              <input className="gp-input gp-input-label" value={g.label} onChange={e => updP(g.id, "label", e.target.value)} />
            </div>
            <div className="gp-field">
              <span className="gp-label">Annual amount <span className="gp-label-hint">(today&apos;s value)</span></span>
              <div className="gp-input-row">
                <span className="gp-prefix">₹</span>
                <input className="gp-input gp-input-md" type="number" value={g.annualAmount} onChange={e => updP(g.id, "annualAmount", Number(e.target.value))} />
                <span className="gp-suffix">/yr</span>
              </div>
            </div>
            <div className="gp-field">
              <span className="gp-label">From</span>
              <input className="gp-input gp-input-xs" type="number" value={g.startYear} onChange={e => updP(g.id, "startYear", Number(e.target.value))} />
            </div>
            <div className="gp-field">
              <span className="gp-label">To</span>
              <input className="gp-input gp-input-xs" type="number" value={g.endYear} onChange={e => updP(g.id, "endYear", Number(e.target.value))} />
            </div>
            {periodicGoals.length > 1 && (
              <button className="gp-remove-btn" onClick={() => removePeriodic(g.id)}>Remove</button>
            )}
          </div>
        ))}
      </div>

      {/* FINAL CORPUS + ASSUMPTIONS */}
      <div className="gp-section">
        <div className="gp-two-col">
          <div>
            <div className="gp-section-title" style={{ marginBottom: "0.85rem" }}>Corpus &amp; existing investment</div>
            <div className="gp-goal-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.85rem" }}>
              <div className="gp-field">
                <span className="gp-label">Final corpus to leave behind <span className="gp-label-hint">(today&apos;s value)</span></span>
                <div className="gp-input-row">
                  <span className="gp-prefix">₹</span>
                  <input className="gp-input gp-input-md" type="number" value={finalCorpus} onChange={e => setFinalCorpus(Number(e.target.value))} />
                  <span className="gp-suffix">by</span>
                  <input className="gp-input gp-input-xs" type="number" value={finalYear} onChange={e => setFinalYear(Number(e.target.value))} />
                </div>
              </div>
              <div className="gp-field">
                <span className="gp-label">Existing investment today</span>
                <div className="gp-input-row">
                  <span className="gp-prefix">₹</span>
                  <input className="gp-input gp-input-md" type="number" value={existingLumpsum} onChange={e => setExistingLumpsum(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="gp-section-title" style={{ marginBottom: "0.85rem" }}>Assumptions</div>
            <div className="gp-goal-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.85rem" }}>
              <div className="gp-assume-row">
                <div className="gp-assume-field">
                  <span className="gp-label">Return — accumulation</span>
                  <div className="gp-input-row">
                    <input className="gp-input gp-input-xs" type="number" step="0.5" value={preReturn} onChange={e => setPreReturn(Number(e.target.value))} />
                    <span className="gp-suffix">%/yr</span>
                  </div>
                </div>
                <div className="gp-assume-field">
                  <span className="gp-label">Return — distribution</span>
                  <div className="gp-input-row">
                    <input className="gp-input gp-input-xs" type="number" step="0.5" value={duringReturn} onChange={e => setDuringReturn(Number(e.target.value))} />
                    <span className="gp-suffix">%/yr</span>
                  </div>
                </div>
                <div className="gp-assume-field">
                  <span className="gp-label">Inflation</span>
                  <div className="gp-input-row">
                    <input className="gp-input gp-input-xs" type="number" step="0.5" value={inflation} onChange={e => setInflation(Number(e.target.value))} />
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
                  <input className="gp-input gp-input-xs" type="number" value={sipYears} onChange={e => setSipYears(Number(e.target.value))} />
                  <span className="gp-suffix">years from today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      {!isValid ? (
        <div className="warn-box">⚠️ Check your years — all goal years must be in the future, and withdrawal end must be after start.</div>
      ) : (
        <div className="gp-results">
          <div className="gp-results-title">What your client needs to invest</div>
          <div className="gp-corpus-banner">
            <div className="gp-corpus-label">Total corpus required by {accEndYear}</div>
            <div className="gp-corpus-value">{smart(totalCorpusAtAccEnd)}</div>
            <div className="gp-corpus-sub">
              Covers all goals · inflation-adjusted · earliest event is {accEndYear}
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

      {/* TABLE */}
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
                {tableRows.map((row, i) => (
                  <tr key={i} className={row.isFinal ? "row-final" : row.isEvent ? "row-event" : row.year > accEndYear ? "row-dist" : "row-acc"}>
                    <td><strong>{row.year}</strong></td>
                    <td>{smart(row.openingCorpus)}</td>
                    <td className={row.withdrawal > 0 ? "gp-red-text" : ""}>{row.withdrawal > 0 ? `− ${smart(row.withdrawal)}` : "—"}</td>
                    <td className={row.isFinal ? "gp-green" : row.closingCorpus < 0 ? "gp-red-text" : "gp-gold"}>{smart(row.closingCorpus)}</td>
                    <td>
                      {row.notes.length > 0 && (
                        <div className="gp-note-list">{row.notes.map((n, j) => <span className="gp-note" key={j}>{n}</span>)}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function CalculatorsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"sip" | "lumpsum" | "goal">("sip");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a;
          --white: #fff; --muted: #6b7280; --border: rgba(0,0,0,0.08);
          --green: #16a34a; --red: #dc2626; --bg: #f0ebe0;
        }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg); }

        /* ── Nav ── */
        .nav { background: var(--navy); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(201,168,76,0.2); }
        .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 700; color: var(--gold2); }
        .nav-links { display: flex; gap: 1rem; }
        .nav-link { color: rgba(255,255,255,0.55); font-size: 0.82rem; text-decoration: none; padding: 0.35rem 0.75rem; border-radius: 2px; transition: all 0.2s; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; }
        .nav-link:hover { color: var(--gold2); }

        /* ── Layout ── */
        .main { max-width: 860px; margin: 0 auto; padding: 2.5rem 2rem; }
        .page-title { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 700; color: var(--navy); margin-bottom: 0.4rem; }
        .page-sub { font-size: 0.88rem; color: var(--muted); margin-bottom: 2rem; }

        /* ── Tabs ── */
        .tabs { display: flex; background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 4px; margin-bottom: 2rem; width: fit-content; }
        .tab-btn { padding: 0.6rem 1.5rem; border-radius: 6px; border: none; background: none; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: var(--muted); cursor: pointer; transition: all 0.2s; }
        .tab-btn.active { background: var(--navy); color: var(--gold2); font-weight: 500; }

        /* ── Card ── */
        .calc-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; }
        .calc-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
        .calc-icon { font-size: 2rem; }
        .calc-header h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 700; color: var(--navy); margin-bottom: 0.2rem; }
        .calc-header p { font-size: 0.82rem; color: var(--muted); }

        /* ── Slider inputs ── */
        .warn-box { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #dc2626; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.82rem; margin-bottom: 1.25rem; }
        .inputs-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
        .input-group {}
        .input-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
        .input-label-row label { font-size: 0.82rem; color: var(--navy); font-weight: 500; }
        .input-box-wrap { display: flex; align-items: center; gap: 2px; }
        .unit-prefix { font-size: 0.85rem; color: var(--muted); }
        .unit-suffix { font-size: 0.78rem; color: var(--muted); }
        .val-input { width: 90px; text-align: right; border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.3rem 0.5rem; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 500; color: var(--navy); outline: none; transition: border-color 0.2s; }
        .val-input:focus { border-color: var(--gold); }
        .val-input-error { border-color: #dc2626 !important; color: #dc2626; }
        .input-error { font-size: 0.72rem; color: #dc2626; margin-top: 4px; }
        .slider-wrap { margin-bottom: 4px; }
        .slider { width: 100%; height: 4px; -webkit-appearance: none; appearance: none; border-radius: 2px; outline: none; cursor: pointer; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--navy); border: 2px solid var(--gold); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
        .slider-bounds { display: flex; justify-content: space-between; font-size: 0.7rem; color: #9ca3af; }
        .stepup-row { background: #faf9f6; border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
        .stepup-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .stepup-check { width: 16px; height: 16px; accent-color: var(--navy); cursor: pointer; }
        .stepup-label span:first-of-type { font-size: 0.88rem; font-weight: 500; color: var(--navy); }
        .stepup-hint { font-size: 0.75rem; color: var(--muted); }
        .stepup-row .input-group { margin-top: 1rem; }

        /* ── Result cards ── */
        .result-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-bottom: 2rem; }
        .result-stat { background: #faf9f6; border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; text-align: center; }
        .result-stat.highlight { background: var(--navy); border-color: transparent; }
        .result-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .result-stat.highlight .result-label { color: rgba(255,255,255,0.45); }
        .result-value { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 700; line-height: 1; }
        .result-value.navy { color: var(--navy); }
        .result-value.green { color: var(--green); }
        .result-value.gold { color: var(--gold2); }
        .result-sub { font-size: 0.72rem; color: var(--muted); margin-top: 0.3rem; }
        .result-stat.highlight .result-sub { color: rgba(255,255,255,0.4); }

        /* ── Chart ── */
        .chart-section { margin-top: 0.5rem; }
        .chart-title { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .chart-legend { display: flex; align-items: center; gap: 6px; margin-top: 0.5rem; font-size: 0.75rem; color: var(--muted); }
        .legend-line { display: inline-block; width: 20px; height: 2px; border-radius: 1px; }
        .gold-line { background: var(--gold); }
        .navy-line { background: var(--navy); opacity: 0.5; }
        .tip-box { margin-top: 1.25rem; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); border-radius: 8px; padding: 0.85rem 1.1rem; font-size: 0.82rem; color: #92400e; line-height: 1.6; }

        /* ── Goal Planner ── */
        .gp-section { background: #faf9f6; border: 1px solid var(--border); border-radius: 8px; padding: 1.1rem 1.25rem; margin-bottom: 1rem; }
        .gp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
        .gp-section-title { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .gp-add-btn { font-size: 0.72rem; color: var(--gold); border: 1px solid rgba(201,168,76,0.35); background: rgba(201,168,76,0.06); border-radius: 4px; padding: 0.25rem 0.6rem; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .gp-add-btn:hover { background: rgba(201,168,76,0.14); }
        .gp-goal-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; background: var(--white); border: 1px solid var(--border); border-radius: 7px; padding: 0.85rem; margin-bottom: 0.6rem; }
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
        .gp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        .gp-assume-row { display: flex; flex-wrap: wrap; gap: 1rem; }
        .gp-assume-field { display: flex; flex-direction: column; gap: 3px; }
        .gp-divider { display: flex; align-items: center; gap: 8px; margin: 0.5rem 0; }
        .gp-divider-line { flex: 1; height: 1px; background: var(--border); }
        .gp-divider-text { font-size: 0.68rem; color: var(--muted); }

        /* Goal results */
        .gp-results { background: var(--navy); border-radius: 8px; padding: 1.4rem; margin-bottom: 1rem; }
        .gp-results-title { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.4); margin-bottom: 1rem; }
        .gp-corpus-banner { background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.25); border-radius: 7px; padding: 0.9rem 1.1rem; margin-bottom: 1rem; }
        .gp-corpus-label { font-size: 0.67rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
        .gp-corpus-value { font-family: 'Cormorant Garamond', serif; font-size: 1.9rem; font-weight: 700; color: var(--gold2); line-height: 1; }
        .gp-corpus-sub { font-size: 0.71rem; color: rgba(255,255,255,0.3); margin-top: 0.2rem; }
        .gp-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
        .gp-option { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 0.9rem 1rem; }
        .gp-option-tag { font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.3); margin-bottom: 0.3rem; }
        .gp-option-value { font-family: 'Cormorant Garamond', serif; font-size: 1.45rem; font-weight: 700; color: var(--gold2); line-height: 1; }
        .gp-option-sub { font-size: 0.7rem; color: rgba(255,255,255,0.3); margin-top: 0.3rem; line-height: 1.5; }
        .gp-option-existing { font-size: 0.7rem; color: rgba(201,168,76,0.55); margin-top: 0.3rem; }
        .gp-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.85rem; }
        .gp-pill { font-size: 0.67rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 0.2rem 0.65rem; color: rgba(255,255,255,0.4); }

        /* Goal table */
        .gp-table-wrap { background: var(--white); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .gp-table-head { padding: 0.85rem 1.25rem 0.55rem; border-bottom: 1px solid var(--border); }
        .gp-table-head-title { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .gp-table { width: 100%; border-collapse: collapse; font-size: 0.81rem; }
        .gp-table th { padding: 0.5rem 1rem; text-align: left; font-size: 0.67rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); background: #faf9f6; border-bottom: 1px solid var(--border); }
        .gp-table td { padding: 0.5rem 1rem; border-bottom: 1px solid rgba(0,0,0,0.04); color: var(--navy); vertical-align: top; }
        .gp-table tr:last-child td { border-bottom: none; }
        .gp-table tr:hover td { background: #fafaf8; }
        .row-dist td { background: rgba(201,168,76,0.03); }
        .row-event td { background: rgba(201,168,76,0.07); }
        .row-final td { background: rgba(22,163,74,0.05); font-weight: 600; }
        .gp-gold { color: var(--gold); font-weight: 600; }
        .gp-green { color: var(--green); font-weight: 600; }
        .gp-red-text { color: var(--red); }
        .gp-note-list { display: flex; flex-direction: column; gap: 2px; }
        .gp-note { font-size: 0.69rem; color: var(--muted); }

        @media (max-width: 600px) {
          .result-grid { grid-template-columns: 1fr; }
          .main { padding: 1.25rem 1rem; }
          .tabs { width: 100%; overflow-x: auto; }
          .tab-btn { flex-shrink: 0; padding: 0.6rem 1rem; }
          .gp-two-col { grid-template-columns: 1fr; }
          .gp-options { grid-template-columns: 1fr; }
        }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">Veera Karthik · Investor Portal</div>
        <div className="nav-links">
          <button className="nav-link" onClick={() => router.push("/dashboard")}>← Dashboard</button>
        </div>
      </nav>

      <div className="main">
        <h1 className="page-title">Investment Calculators</h1>
        <p className="page-sub">Plan your financial future with these simple tools</p>

        <div className="tabs">
          <button className={`tab-btn ${tab === "sip" ? "active" : ""}`} onClick={() => setTab("sip")}>📈 SIP Calculator</button>
          <button className={`tab-btn ${tab === "lumpsum" ? "active" : ""}`} onClick={() => setTab("lumpsum")}>💰 Lump Sum Calculator</button>
          <button className={`tab-btn ${tab === "goal" ? "active" : ""}`} onClick={() => setTab("goal")}>🎯 Goal Planner</button>
        </div>

        {tab === "sip"     && <SIPCalculator />}
        {tab === "lumpsum" && <LumpSumCalculator />}
        {tab === "goal"    && <GoalPlanner />}
      </div>
    </>
  );
}
