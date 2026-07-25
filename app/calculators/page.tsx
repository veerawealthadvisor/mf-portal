"use client";
import { useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  unit?: string;
  minWarn?: number;
}

function SliderInput({ label, value, min, max, step, onChange, format, unit = "", minWarn }: SliderInputProps) {
  const [inputVal, setInputVal] = useState(String(value));
  const [error, setError] = useState("");
  const pct = ((value - min) / (max - min)) * 100;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    onChange(v);
    setInputVal(String(v));
    setError("");
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, "");
    setInputVal(raw);
    const v = parseFloat(raw);
    if (isNaN(v))          { setError("Enter a valid number"); return; }
    if (v < 0)             { setError("Value cannot be negative"); onChange(min); return; }
    if (minWarn && v < minWarn) { setError(`Minimum value is ${minWarn}`); onChange(minWarn); return; }
    if (v < min)           { setError(`Minimum is ${min}`); onChange(min); return; }
    if (v > max)           { setError(`Maximum is ${max}`); onChange(max); return; }
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

interface LineChartProps {
  points: number[];
  invested: number[];
  labels: string[];
}

function LineChart({ points, invested, labels }: LineChartProps) {
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
  const [monthly, setMonthly]     = useState(5000);
  const [rate, setRate]           = useState(12);
  const [years, setYears]         = useState(10);
  const [stepUp, setStepUp]       = useState(false);
  const [stepRate, setStepRate]   = useState(10);
  const [timing, setTiming]       = useState<"begin" | "end">("begin");

  const isValid = monthly >= 500;

  const calculate = useCallback(() => {
    const months = years * 12;
    let fv = 0, totalInv = 0;
    const yearlyFV: number[] = [];
    const yearlyInv: number[] = [];
    const xlabels: string[] = [];
    const r = rate / 100 / 12;
    const timingMult = timing === "begin" ? (1 + r) : 1;

    if (!stepUp) {
      for (let yr = 1; yr <= years; yr++) {
        const m = yr * 12;
        const v = r === 0 ? monthly * m : monthly * ((Math.pow(1 + r, m) - 1) / r) * timingMult;
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
        for (let m = 0; m < 12; m++) {
          if (timing === "begin") {
            runningFV = (runningFV + currentSIP) * (1 + r);
          } else {
            runningFV = runningFV * (1 + r) + currentSIP;
          }
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
  }, [monthly, rate, years, stepUp, stepRate, timing]);

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

      <div className="timing-row">
        <span className="timing-label">SIP invested at:</span>
        <div className="timing-toggle">
          <button
            className={`timing-btn ${timing === "begin" ? "active" : ""}`}
            onClick={() => setTiming("begin")}
          >
            Beginning of month
          </button>
          <button
            className={`timing-btn ${timing === "end" ? "active" : ""}`}
            onClick={() => setTiming("end")}
          >
            End of month
          </button>
        </div>
        <span className="timing-hint">
          {timing === "begin"
            ? "Annuity due — matches Groww, Zerodha, most Indian MF portals"
            : "Ordinary annuity — standard financial math convention"}
        </span>
      </div>

      {isValid && (
        <>
          <div className="result-grid">
            <div className="result-stat">
              <div className="result-label">Total Invested</div>
              <div className="result-value navy">₹{formatINR(totalInv)}</div>
            </div>
            <div className="result-stat">
              <div className="result-label">Est. Returns</div>
              <div className="result-value green">+₹{formatINR(wealthGain)}</div>
              <div className="result-sub">{gainPct}% gain on invested amount</div>
            </div>
            <div className="result-stat highlight">
              <div className="result-label">Final Corpus</div>
              <div className="result-value gold">₹{formatINR(fv)}</div>
              <div className="result-sub">After {years} years · {timing === "begin" ? "beginning" : "end"} of month</div>
            </div>
          </div>
          <div className="calc-assumption-note">
            💡 Assumed: {rate}% annual return, SIP at <strong>{timing === "begin" ? "beginning" : "end"} of month</strong>,
            {stepUp ? ` ${stepRate}% step-up per year` : " no step-up"}.
            Returns are illustrative and not guaranteed.
          </div>
          <div className="chart-section">
            <div className="chart-title">Portfolio growth over time</div>
            <LineChart points={yearlyFV} invested={yearlyInv} labels={xlabels} />
            <div className="chart-legend">
              <span className="legend-line gold-line" />Final Corpus
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

// PV of a flat annuity (used for discounting checks)
function pvAnnuity(pmt: number, r: number, n: number): number {
  if (r === 0) return pmt * n;
  return pmt * ((1 - Math.pow(1 + r, -n)) / r);
}

// PV of a GROWING annuity — pmt grows at rate g each year, discounted at rate r
function pvGrowingAnnuity(pmt: number, r: number, g: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(r - g) < 1e-9) return pmt * n / (1 + r);
  return pmt * (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
}

interface LumpsumGoal { id: number; year: number; amount: number; label: string; }
interface PeriodicGoal { id: number; startYear: number; endYear: number; annualAmount: number; label: string; }

// ─── SIMULATION ENGINE ────────────────────────────────────────────────────────

/**
 * Month-by-month portfolio simulation.
 *
 * Each month:
 *  1. Grow corpus at accumulation rate (before firstEventYear) or distribution rate (after).
 *  2. Add monthlySIP if within the SIP window [delayMonths+1 .. delayMonths+sipMonths].
 *  3. At end of each year, deduct inflation-adjusted withdrawals for that year.
 *
 * Returns the corpus value at the end of endYear.
 */
function simulatePortfolio(
  monthlySIP: number,
  sipMonths: number,
  delayMonths: number,
  existingLumpsum: number,
  lumpsumGoals: LumpsumGoal[],
  periodicGoals: PeriodicGoal[],
  endYear: number,
  currentYear: number,
  preReturn: number,
  duringReturn: number,
  inflation: number,
  firstEventYear: number,
): number {
  const totalMonths = (endYear - currentYear) * 12;
  if (totalMonths <= 0) return existingLumpsum;

  let corpus = existingLumpsum;
  const preMR    = preReturn / 12;
  const durMR    = duringReturn / 12;
  const sipStart = delayMonths + 1;
  const sipEnd   = delayMonths + sipMonths;

  for (let m = 1; m <= totalMonths; m++) {
    // Calendar year this month belongs to
    const calYear  = currentYear + Math.ceil(m / 12);
    const mRate    = calYear <= firstEventYear ? preMR : durMR;

    // 1. Grow
    corpus *= (1 + mRate);

    // 2. SIP contribution
    if (m >= sipStart && m <= sipEnd) {
      corpus += monthlySIP;
    }

    // 3 & 4. Year-end withdrawals
    if (m % 12 === 0) {
      const yr = currentYear + m / 12;

      lumpsumGoals.forEach(g => {
        if (g.year === yr) {
          corpus -= g.amount * Math.pow(1 + inflation, yr - currentYear);
        }
      });

      periodicGoals.forEach(g => {
        if (yr >= g.startYear && yr <= g.endYear) {
          corpus -= g.annualAmount * Math.pow(1 + inflation, yr - currentYear);
        }
      });
    }
  }

  return corpus;
}

/**
 * Binary search for the minimum monthly SIP (₹1 accuracy) such that
 * simulatePortfolio() ends with corpus >= inflated final corpus target.
 *
 * SIP runs for the full sipYears chosen by the user — never capped.
 */
function findRequiredSIP(
  existingLumpsum: number,
  sipYears: number,
  delayMonths: number,
  lumpsumGoals: LumpsumGoal[],
  periodicGoals: PeriodicGoal[],
  finalCorpus: number,
  finalYear: number,
  currentYear: number,
  preReturn: number,
  duringReturn: number,
  inflation: number,
  firstEventYear: number,
  lastEventYear: number,
): number {
  if (sipYears <= 0) return 0;

  const sipMonths    = sipYears * 12;
  const endYear      = Math.max(lastEventYear, finalYear, currentYear + 1);
  const targetFinal  = finalCorpus * Math.pow(1 + inflation, finalYear - currentYear);

  const sim = (sip: number) =>
    simulatePortfolio(
      sip, sipMonths, delayMonths, existingLumpsum,
      lumpsumGoals, periodicGoals, endYear,
      currentYear, preReturn, duringReturn, inflation, firstEventYear,
    );

  // If existing investment alone covers target, no SIP required
  if (sim(0) >= targetFinal) return 0;

  // Expand upper bound until simulation exceeds target
  let hi = 100_000;
  while (sim(hi) < targetFinal) hi *= 2;

  let lo = 0;
  // Binary search: converge to ₹1 accuracy (≈ 60 iterations max)
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (sim(mid) < targetFinal) lo = mid; else hi = mid;
  }
  return Math.ceil(hi);
}

/**
 * Sensitivity helper — corpus/lumpsum via present-value method,
 * SIP via simulation-based binary search. Used for sensitivity tables.
 */
function computeCorpusNeeded(
  lumpsumGoals: LumpsumGoal[],
  periodicGoals: PeriodicGoal[],
  finalCorpus: number, finalYear: number,
  accEndYear: number, currentYear: number,
  inf: number, dr: number, altPr: number,
  existingLumpsum: number, sipYears: number,
  firstEventYear: number, lastEventYear: number,
): { corpus: number; lumpsum: number; sip: number } {
  let total = 0;
  lumpsumGoals.forEach(g => {
    const inflated = g.amount * Math.pow(1 + inf, g.year - currentYear);
    const gap = g.year - accEndYear;
    total += gap >= 0 ? inflated / Math.pow(1 + dr, gap) : inflated * Math.pow(1 + dr, -gap);
  });
  periodicGoals.forEach(g => {
    const firstW   = g.annualAmount * Math.pow(1 + inf, g.startYear + 1 - currentYear);
    const pvAtStart = pvGrowingAnnuity(firstW, dr, inf, g.endYear - g.startYear);
    const gap = g.startYear - accEndYear;
    total += gap >= 0 ? pvAtStart / Math.pow(1 + dr, gap) : pvAtStart * Math.pow(1 + dr, -gap);
  });
  const inflFinal = finalCorpus * Math.pow(1 + inf, finalYear - currentYear);
  total += inflFinal / Math.pow(1 + dr, Math.max(0, finalYear - accEndYear));

  const yearsToAcc = accEndYear - currentYear;
  const existFV   = existingLumpsum * Math.pow(1 + altPr, yearsToAcc);
  const shortfall = Math.max(0, total - existFV);
  const lumpsum   = shortfall / Math.pow(1 + altPr, yearsToAcc);

  const sip = findRequiredSIP(
    existingLumpsum, sipYears, 0,
    lumpsumGoals, periodicGoals,
    finalCorpus, finalYear,
    currentYear, altPr, dr, inf,
    firstEventYear, lastEventYear,
  );

  return { corpus: total, lumpsum: Math.max(0, lumpsum), sip: Math.max(0, sip) };
}

// Asset allocation recommendation based on years to goal
function recommendAllocation(years: number): { equity: number; hybrid: number; debt: number; category: string; rationale: string } {
  if (years >= 10) return { equity: 75, hybrid: 15, debt: 10, category: "Flexi-cap + Mid-cap blend", rationale: "Long horizon allows higher equity exposure for wealth creation" };
  if (years >= 7)  return { equity: 65, hybrid: 20, debt: 15, category: "Large & Mid-cap / Flexi-cap", rationale: "Moderate-high equity with some stability" };
  if (years >= 5)  return { equity: 50, hybrid: 30, debt: 20, category: "Hybrid / Balanced Advantage", rationale: "Balanced approach as goal approaches" };
  if (years >= 3)  return { equity: 30, hybrid: 30, debt: 40, category: "Conservative Hybrid / Short Duration Debt", rationale: "Capital preservation becomes priority" };
  return { equity: 10, hybrid: 15, debt: 75, category: "Liquid / Ultra Short Duration", rationale: "Goal is near — protect capital above all" };
}

let nextId = 1;

// ─── GOAL PLANNER INPUT COMPONENTS ───────────────────────────────────────────

// Validated number input for Goal Planner fields
interface GpInputProps {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  allowZero?: boolean;
  placeholder?: string;
}

function GpInput({
  value, onChange, prefix, suffix,
  min = 0, max = 1e9, step = 1,
  className = "gp-input gp-input-md",
  allowZero = false,
  placeholder,
}: GpInputProps) {
  // Start with empty display when value is 0 and a placeholder is provided
  const [raw, setRaw] = useState<string>(() =>
    value === 0 && placeholder ? "" : String(value)
  );
  const [err, setErr] = useState("");

  const validate = (str: string): string => {
    const n = parseFloat(str);
    if (str === "" || isNaN(n))  return "Enter a valid number";
    if (!allowZero && n < 0)     return "Cannot be negative";
    if (allowZero && n < 0)      return "Cannot be negative";
    if (n < min)                 return `Minimum is ${min}`;
    if (n > max)                 return `Maximum is ${max.toLocaleString("en-IN")}`;
    return "";
  };

  const commit = (str: string) => {
    // Keep placeholder state if field is left empty
    if (str === "" && placeholder) { setErr(""); return; }
    const n = parseFloat(str);
    const e = validate(str);
    setErr(e);
    if (!e) { onChange(n); setRaw(String(n)); }
    else    { setRaw(String(value)); setErr(""); }
  };

  return (
    <div>
      <div className="gp-input-row">
        {prefix && <span className="gp-prefix">{prefix}</span>}
        <input
          className={`${className} ${err ? "gp-input-error" : ""}`}
          value={raw}
          step={step}
          placeholder={placeholder}
          onChange={e => {
            const s = e.target.value;
            setRaw(s);
            if (s === "" || s === "-") { setErr(""); return; }
            const er = validate(s);
            setErr(er);
            if (!er) onChange(parseFloat(s));
          }}
          onBlur={e => commit(e.target.value)}
        />
        {suffix && <span className="gp-suffix">{suffix}</span>}
      </div>
      {err && <div style={{ fontSize: "0.67rem", color: "var(--red)", marginTop: "2px" }}>{err}</div>}
    </div>
  );
}

// Year input — validates year > minYear
function GpYearInput({
  value, onChange, minYear, placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  minYear: number;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState<string>(placeholder ? "" : String(value));
  const [err, setErr] = useState("");

  const validate = (s: string) => {
    const n = parseInt(s);
    if (isNaN(n))     return "Enter a valid year";
    if (n <= minYear) return `Must be after ${minYear}`;
    if (n > 2100)     return "Year seems too far";
    return "";
  };

  return (
    <div>
      <input
        className={`gp-input gp-input-xs ${err ? "gp-input-error" : ""}`}
        value={raw}
        placeholder={placeholder}
        onChange={e => {
          const s = e.target.value;
          setRaw(s);
          if (s === "") { setErr(""); return; }
          const er = validate(s);
          setErr(er);
          if (!er) onChange(parseInt(s));
        }}
        onBlur={e => {
          if (e.target.value === "" && placeholder) { setErr(""); return; }
          const er = validate(e.target.value);
          if (er) { setErr(""); setRaw(String(value)); }
        }}
      />
      {err && <div style={{ fontSize: "0.67rem", color: "var(--red)", marginTop: "2px" }}>{err}</div>}
    </div>
  );
}

// ─── GOAL PLANNER ─────────────────────────────────────────────────────────────

function GoalPlanner() {
  const currentYear = new Date().getFullYear();
  const searchParams = useSearchParams();
  const pdfRef = useRef<HTMLDivElement>(null);

  // ── Parse URL params (shareable link restore) ──────────────────────────────
  // Default state: EMPTY goals (no pre-populated demo data)
  const parsedLG: LumpsumGoal[] = (() => {
    try {
      const raw = searchParams.get("lg");
      if (!raw) return [];
      interface RawLG { y: number; a: number; l: string; }
      return (JSON.parse(raw) as RawLG[]).map(g => ({ id: nextId++, year: g.y, amount: g.a, label: g.l }));
    } catch { return []; }
  })();

  const parsedPG: PeriodicGoal[] = (() => {
    try {
      const raw = searchParams.get("pg");
      if (!raw) return [];
      interface RawPG { s: number; e: number; a: number; l: string; }
      return (JSON.parse(raw) as RawPG[]).map(g => ({ id: nextId++, startYear: g.s, endYear: g.e, annualAmount: g.a, label: g.l }));
    } catch { return []; }
  })();

  const [lumpsumGoals,  setLumpsumGoals]  = useState<LumpsumGoal[]>(parsedLG);
  const [periodicGoals, setPeriodicGoals] = useState<PeriodicGoal[]>(parsedPG);

  const [finalYear,        setFinalYear]        = useState(Number(searchParams.get("fy"))  || currentYear + 20);
  const [finalCorpus,      setFinalCorpus]      = useState(Number(searchParams.get("fc"))  || 1000000);
  const [preReturn,        setPreReturn]         = useState(Number(searchParams.get("pr"))  || 12);
  const [duringReturn,     setDuringReturn]      = useState(Number(searchParams.get("dr"))  || 8);
  const [inflation,        setInflation]         = useState(Number(searchParams.get("inf")) || 6);
  const [existingLumpsum,  setExistingLumpsum]   = useState(Number(searchParams.get("ex"))  || 100000);
  const [sipYears,         setSipYears]          = useState(Number(searchParams.get("sy"))  || 10);

  const [shareCopied, setShareCopied] = useState(false);

  // ── Derived rates ──────────────────────────────────────────────────────────
  const inf = inflation / 100;
  const dr  = duringReturn / 100;
  const pr  = preReturn / 100;

  // ── Event years ──────────────────────────────────────────────────────────
  const allEventYears = [
    ...lumpsumGoals.map(g => g.year),
    ...periodicGoals.reduce((acc: number[], g: PeriodicGoal) => acc.concat([g.startYear, g.endYear]), []),
    finalYear,
  ].filter(y => y > currentYear);

  // Validation: all goal years must be in the future; periodic end > start
  const isValid =
    allEventYears.length > 0 &&
    lumpsumGoals.every(g => g.year > currentYear) &&
    periodicGoals.every(g => g.startYear > currentYear && g.endYear > g.startYear);

  const lastEventYear  = isValid ? Math.max(...allEventYears) : currentYear + 20;
  const firstEventYear = isValid ? Math.min(...allEventYears) : currentYear + 20;
  const accEndYear     = firstEventYear;
  const yearsToAccEnd  = accEndYear - currentYear;
  const planEndYear    = Math.max(lastEventYear, finalYear);

  // ── Corpus needed at accEndYear (PV of all future obligations) ─────────────
  let totalCorpusAtAccEnd = 0;

  lumpsumGoals.forEach(g => {
    const inflated  = g.amount * Math.pow(1 + inf, g.year - currentYear);
    const yearsGap  = g.year - accEndYear;
    totalCorpusAtAccEnd += yearsGap >= 0
      ? inflated / Math.pow(1 + dr, yearsGap)
      : inflated * Math.pow(1 + dr, -yearsGap);
  });

  periodicGoals.forEach(g => {
    const firstWithdrawal = g.annualAmount * Math.pow(1 + inf, g.startYear + 1 - currentYear);
    const periods         = g.endYear - g.startYear;
    const pvAtStart       = pvGrowingAnnuity(firstWithdrawal, dr, inf, periods);
    const yearsGap        = g.startYear - accEndYear;
    totalCorpusAtAccEnd += yearsGap >= 0
      ? pvAtStart / Math.pow(1 + dr, yearsGap)
      : pvAtStart * Math.pow(1 + dr, -yearsGap);
  });

  const inflatedFinal = finalCorpus * Math.pow(1 + inf, finalYear - currentYear);
  totalCorpusAtAccEnd += inflatedFinal / Math.pow(1 + dr, Math.max(0, finalYear - accEndYear));

  // ── Option A: Required lumpsum (PV-based) ─────────────────────────────────
  const existingFV        = existingLumpsum * Math.pow(1 + pr, yearsToAccEnd);
  const shortfall         = Math.max(0, totalCorpusAtAccEnd - existingFV);
  const additionalLumpsum = shortfall / Math.pow(1 + pr, yearsToAccEnd);

  // ── Option B: Required monthly SIP (simulation-based binary search) ────────
  // SIP runs for the FULL sipYears the user chose — never capped at first goal.
  const monthlySIP       = isValid
    ? findRequiredSIP(
        existingLumpsum, sipYears, 0,
        lumpsumGoals, periodicGoals,
        finalCorpus, finalYear,
        currentYear, pr, dr, inf,
        firstEventYear, lastEventYear,
      )
    : 0;
  const sipMonths        = sipYears * 12;
  const totalSIPInvested = monthlySIP * sipMonths;

  // ── Sensitivity analysis ───────────────────────────────────────────────────
  const sensiReturns = [8, 10, 12, 14, 15];
  const sensiRows = sensiReturns.map(pct => {
    const r = computeCorpusNeeded(
      lumpsumGoals, periodicGoals, finalCorpus, finalYear,
      accEndYear, currentYear, inf, dr, pct / 100,
      existingLumpsum, sipYears, firstEventYear, lastEventYear,
    );
    return { rate: pct, corpus: r.corpus, lumpsum: r.lumpsum, sip: r.sip };
  });

  const inflationRates = [4, 5, 6, 7, 8];
  const inflationRows = inflationRates.map(ipct => {
    const r = computeCorpusNeeded(
      lumpsumGoals, periodicGoals, finalCorpus, finalYear,
      accEndYear, currentYear, ipct / 100, dr, pr,
      existingLumpsum, sipYears, firstEventYear, lastEventYear,
    );
    return { rate: ipct, corpus: r.corpus, lumpsum: r.lumpsum, sip: r.sip };
  });

  // ── Delay penalty: cost of starting SIP 1 year later ─────────────────────
  const delayedSIP = isValid
    ? findRequiredSIP(
        existingLumpsum, sipYears, 12,   // 12-month delay before SIP starts
        lumpsumGoals, periodicGoals,
        finalCorpus, finalYear,
        currentYear, pr, dr, inf,
        firstEventYear, lastEventYear,
      )
    : 0;

  // ── 1% lower return impact ─────────────────────────────────────────────────
  const lowerReturnRow = computeCorpusNeeded(
    lumpsumGoals, periodicGoals, finalCorpus, finalYear,
    accEndYear, currentYear, inf, dr, Math.max(0.01, pr - 0.01),
    existingLumpsum, sipYears, firstEventYear, lastEventYear,
  );

  // ── Asset allocation ───────────────────────────────────────────────────────
  const alloc = recommendAllocation(yearsToAccEnd);

  // ── Shareable URL ──────────────────────────────────────────────────────────
  const buildShareUrl = () => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams({
      lg:  JSON.stringify(lumpsumGoals.map(g => ({ y: g.year, a: g.amount, l: g.label }))),
      pg:  JSON.stringify(periodicGoals.map(g => ({ s: g.startYear, e: g.endYear, a: g.annualAmount, l: g.label }))),
      fc:  String(finalCorpus), fy: String(finalYear),
      pr:  String(preReturn),   dr: String(duringReturn),
      inf: String(inflation),   ex: String(existingLumpsum), sy: String(sipYears),
    });
    return `${window.location.origin}${window.location.pathname}?tab=goal&${params.toString()}`;
  };

  // ── Year-by-year table (lumpsum scenario) ─────────────────────────────────
  interface Row {
    year: number;
    openingCorpus: number;
    withdrawal: number;
    growth: number;
    closingCorpus: number;
    returnRate: number;
    isEvent: boolean;
    isFinal: boolean;
    notes: string[];
  }

  const tableRows: Row[] = [];
  let corpus = existingLumpsum + additionalLumpsum;

  for (let y = currentYear + 1; y <= planEndYear; y++) {
    const isAccPhase = y <= accEndYear;
    const rate = isAccPhase ? pr : dr;
    const opening = corpus;

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
      if (y >= g.startYear && y <= g.endYear) {
        const inflated = g.annualAmount * Math.pow(1 + inf, y - currentYear);
        withdrawal += inflated;
        const tag = y === g.startYear ? " ▶ first" : y === g.endYear ? " ⏹ last" : "";
        notes.push(`💸 ${g.label}: ${smart(inflated)}${tag}`);
      }
    });

    const afterWithdrawal = corpus - withdrawal;
    const growth = afterWithdrawal >= 0 ? afterWithdrawal * rate : 0;
    corpus = afterWithdrawal + growth;

    const isFinal = y === planEndYear;
    tableRows.push({
      year: y,
      openingCorpus: opening,
      withdrawal,
      growth,
      closingCorpus: corpus,
      returnRate: rate * 100,
      isEvent: withdrawal > 0,
      isFinal,
      notes,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addLumpsum = () => setLumpsumGoals(p => [
    ...p,
    { id: nextId++, year: currentYear + 8, amount: 0, label: "" },
  ]);
  const removeLumpsum = (id: number) => setLumpsumGoals(p => p.filter(g => g.id !== id));
  const updLStr = (id: number, key: Extract<keyof LumpsumGoal, "label">, val: string) =>
    setLumpsumGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));
  const updLNum = (id: number, key: Extract<keyof LumpsumGoal, "year" | "amount">, val: number) =>
    setLumpsumGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));

  const addPeriodic = () => setPeriodicGoals(p => [
    ...p,
    { id: nextId++, startYear: currentYear + 8, endYear: currentYear + 18, annualAmount: 0, label: "" },
  ]);
  const removePeriodic = (id: number) => setPeriodicGoals(p => p.filter(g => g.id !== id));
  const updPStr = (id: number, key: Extract<keyof PeriodicGoal, "label">, val: string) =>
    setPeriodicGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));
  const updPNum = (id: number, key: Extract<keyof PeriodicGoal, "startYear" | "endYear" | "annualAmount">, val: number) =>
    setPeriodicGoals(p => p.map(g => g.id === id ? { ...g, [key]: val } : g));

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <button className="gp-add-btn" onClick={addLumpsum}>+ Add One-time Goal</button>
        </div>

        {lumpsumGoals.length === 0 ? (
          <div className="gp-empty-state">
            <div className="gp-empty-title">No one-time goals added yet.</div>
            <div className="gp-empty-sub">Click &ldquo;Add One-time Goal&rdquo; to start planning.</div>
          </div>
        ) : (
          lumpsumGoals.map(g => (
            <div className="gp-goal-row" key={g.id}>
              <div className="gp-field">
                <span className="gp-label">Goal name</span>
                <input
                  className="gp-input gp-input-label"
                  value={g.label}
                  placeholder="e.g. Son&apos;s Marriage"
                  onChange={e => updLStr(g.id, "label", e.target.value)}
                />
              </div>
              <div className="gp-field">
                <span className="gp-label">Amount <span className="gp-label-hint">(today&apos;s value)</span></span>
                <GpInput
                  value={g.amount}
                  onChange={v => updLNum(g.id, "amount", v)}
                  prefix="₹"
                  min={1000}
                  max={100000000}
                  placeholder="e.g. 10,00,000"
                />
              </div>
              <div className="gp-field">
                <span className="gp-label">In year</span>
                <GpYearInput
                  value={g.year}
                  onChange={v => updLNum(g.id, "year", v)}
                  minYear={currentYear}
                  placeholder={String(currentYear + 8)}
                />
              </div>
              <button className="gp-remove-btn" onClick={() => removeLumpsum(g.id)}>Remove</button>
            </div>
          ))
        )}
      </div>

      {/* PERIODIC GOALS */}
      <div className="gp-section">
        <div className="gp-section-header">
          <div className="gp-section-title">Periodic annual withdrawals</div>
          <button className="gp-add-btn" onClick={addPeriodic}>+ Add Recurring Goal</button>
        </div>

        {periodicGoals.length === 0 ? (
          <div className="gp-empty-state">
            <div className="gp-empty-title">No recurring goals added yet.</div>
            <div className="gp-empty-sub">Click &ldquo;Add Recurring Goal&rdquo; to add annual income or expense goals.</div>
          </div>
        ) : (
          periodicGoals.map(g => (
            <div className="gp-goal-row" key={g.id}>
              <div className="gp-field">
                <span className="gp-label">Goal name</span>
                <input
                  className="gp-input gp-input-label"
                  value={g.label}
                  placeholder="e.g. Retirement Income"
                  onChange={e => updPStr(g.id, "label", e.target.value)}
                />
              </div>
              <div className="gp-field">
                <span className="gp-label">Annual amount <span className="gp-label-hint">(today&apos;s value)</span></span>
                <GpInput
                  value={g.annualAmount}
                  onChange={v => updPNum(g.id, "annualAmount", v)}
                  prefix="₹"
                  suffix="/yr"
                  min={1000}
                  max={10000000}
                  placeholder="e.g. 1,00,000"
                />
              </div>
              <div className="gp-field">
                <span className="gp-label">From</span>
                <GpYearInput
                  value={g.startYear}
                  onChange={v => updPNum(g.id, "startYear", v)}
                  minYear={currentYear}
                  placeholder={String(currentYear + 8)}
                />
              </div>
              <div className="gp-field">
                <span className="gp-label">To <span className="gp-label-hint">(after From)</span></span>
                <GpYearInput
                  value={g.endYear}
                  onChange={v => updPNum(g.id, "endYear", v)}
                  minYear={g.startYear}
                  placeholder={String(currentYear + 18)}
                />
              </div>
              <button className="gp-remove-btn" onClick={() => removePeriodic(g.id)}>Remove</button>
            </div>
          ))
        )}
      </div>

      {/* FINAL CORPUS + ASSUMPTIONS */}
      <div className="gp-section">
        <div className="gp-two-col">
          <div>
            <div className="gp-section-title" style={{ marginBottom: "0.85rem" }}>Corpus &amp; existing investment</div>
            <div className="gp-goal-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.85rem" }}>
              <div className="gp-field">
                <span className="gp-label">Final corpus to leave behind <span className="gp-label-hint">(today&apos;s value)</span></span>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", flexWrap: "wrap" }}>
                  <GpInput
                    value={finalCorpus}
                    onChange={setFinalCorpus}
                    prefix="₹"
                    min={0}
                    allowZero
                    className="gp-input gp-input-md"
                  />
                  <span className="gp-suffix" style={{ paddingTop: "10px" }}>by</span>
                  <GpYearInput value={finalYear} onChange={setFinalYear} minYear={currentYear} />
                </div>
              </div>
              <div className="gp-field">
                <span className="gp-label">
                  Existing investment today
                  <span className="gp-label-hint" style={{ display: "block", marginTop: "1px" }}>
                    Assumed invested today · grows at accumulation return
                  </span>
                </span>
                <GpInput
                  value={existingLumpsum}
                  onChange={setExistingLumpsum}
                  prefix="₹"
                  min={0}
                  allowZero
                  className="gp-input gp-input-md"
                />
              </div>
            </div>
          </div>
          <div>
            <div className="gp-section-title" style={{ marginBottom: "0.85rem" }}>Assumptions</div>
            <div className="gp-goal-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.85rem" }}>
              <div className="gp-assume-row">
                <div className="gp-assume-field">
                  <span className="gp-label">Return — accumulation</span>
                  {/* preReturn: min 1%, max 50% (reject returns above 50%) */}
                  <GpInput
                    value={preReturn}
                    onChange={v => {
                      if (v > 50) return;
                      setPreReturn(v);
                    }}
                    suffix="%/yr"
                    min={1}
                    max={50}
                    step={0.5}
                    className="gp-input gp-input-xs"
                  />
                </div>
                <div className="gp-assume-field">
                  <span className="gp-label">Return — distribution</span>
                  {/* duringReturn: min 0%, max 50%; reject below -100% */}
                  <GpInput
                    value={duringReturn}
                    onChange={v => {
                      if (v < -100 || v > 50) return;
                      setDuringReturn(v);
                    }}
                    suffix="%/yr"
                    min={0}
                    max={50}
                    step={0.5}
                    className="gp-input gp-input-xs"
                    allowZero
                  />
                </div>
                <div className="gp-assume-field">
                  <span className="gp-label">Inflation</span>
                  {/* inflation: min 0%, max 30%; reject below 0% */}
                  <GpInput
                    value={inflation}
                    onChange={v => {
                      if (v < 0 || v > 30) return;
                      setInflation(v);
                    }}
                    suffix="%/yr"
                    min={0}
                    max={30}
                    step={0.5}
                    className="gp-input gp-input-xs"
                    allowZero
                  />
                </div>
              </div>
              <div className="gp-divider">
                <div className="gp-divider-line" /><span className="gp-divider-text">SIP option</span><div className="gp-divider-line" />
              </div>
              <div className="gp-assume-field">
                <span className="gp-label">Invest via SIP for</span>
                <GpInput
                  value={sipYears}
                  onChange={v => setSipYears(v)}
                  suffix="years from today"
                  min={1}
                  max={40}
                  step={1}
                  className="gp-input gp-input-sm"
                />
                {/* SIP always runs for the full duration — no capping */}
                {isValid && (
                  <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "3px" }}>
                    SIP: {currentYear} → {currentYear + sipYears}
                    {sipYears < yearsToAccEnd
                      ? ` · corpus compounds ${yearsToAccEnd - sipYears} more yr${yearsToAccEnd - sipYears > 1 ? "s" : ""} to first event`
                      : " · runs through first event year"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      {!isValid ? (
        <div className="warn-box">
          ⚠️ Check your years — all goal years must be in the future, and withdrawal end must be after start.
        </div>
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
              <div className="gp-option-tag">Option B — Monthly SIP for {sipYears} yrs</div>
              <div className="gp-option-value">{smart(monthlySIP)}/mo</div>
              <div className="gp-option-sub">
                Total invested: {smart(totalSIPInvested)}<br />
                SIP ends {currentYear + sipYears}
                {sipYears < yearsToAccEnd
                  ? ` · ${yearsToAccEnd - sipYears} yr${yearsToAccEnd - sipYears > 1 ? "s" : ""} compound to first event`
                  : " · continues through withdrawals"}
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
                🎯 {g.label || "Goal"} {g.year}: {smart(g.amount * Math.pow(1 + inf, g.year - currentYear))}
              </span>
            ))}
            {periodicGoals.map(g => (
              <span className="gp-pill" key={g.id}>
                💸 {g.label || "Goal"} {g.startYear}–{g.endYear}:{" "}
                {smart(g.annualAmount * Math.pow(1 + inf, g.startYear + 1 - currentYear))} →{" "}
                {smart(g.annualAmount * Math.pow(1 + inf, g.endYear - currentYear))}/yr
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
          <div className="gp-table-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="gp-table-head-title">Year-by-year projection · lumpsum scenario</div>
            <div style={{ display: "flex", gap: "12px", fontSize: "0.68rem" }}>
              <span style={{ color: "var(--muted)" }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: "#f0ebe0", border: "1px solid #e5e7eb", borderRadius: 2, marginRight: 4 }} />
                Accumulation ({preReturn}%)
              </span>
              <span style={{ color: "var(--muted)" }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 2, marginRight: 4 }} />
                Distribution ({duringReturn}%)
              </span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Opening Corpus</th>
                  <th>Withdrawal</th>
                  <th>Growth Earned</th>
                  <th>Closing Corpus</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} className={row.isFinal ? "row-final" : row.isEvent ? "row-event" : row.year > accEndYear ? "row-dist" : "row-acc"}>
                    <td>
                      <strong>{row.year}</strong>
                      <span style={{ display: "block", fontSize: "0.65rem", color: "var(--muted)", fontWeight: 400 }}>
                        {row.returnRate.toFixed(0)}% return
                      </span>
                    </td>
                    <td>{smart(row.openingCorpus)}</td>
                    <td className={row.withdrawal > 0 ? "gp-red-text" : ""}>
                      {row.withdrawal > 0 ? `− ${smart(row.withdrawal)}` : "—"}
                    </td>
                    <td style={{ color: "var(--green)", fontSize: "0.8rem" }}>
                      +{smart(row.growth)}
                    </td>
                    <td className={row.isFinal ? "gp-green" : row.closingCorpus < 0 ? "gp-red-text" : "gp-gold"}>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSIGHTS PANEL */}
      {isValid && (
        <>
          {/* Asset Allocation */}
          <div className="gp-insight-card" style={{ marginTop: "1rem" }}>
            <div className="gp-insight-title">📊 Recommended Asset Allocation</div>
            <div className="gp-insight-sub">Based on {yearsToAccEnd}-year horizon to first goal</div>
            <div className="alloc-bar">
              <div className="alloc-seg eq"  style={{ width: `${alloc.equity}%` }}>Equity {alloc.equity}%</div>
              <div className="alloc-seg hy"  style={{ width: `${alloc.hybrid}%` }}>Hybrid {alloc.hybrid}%</div>
              <div className="alloc-seg dbt" style={{ width: `${alloc.debt}%` }}>Debt {alloc.debt}%</div>
            </div>
            <div className="alloc-detail">
              <strong>{alloc.category}</strong> · {alloc.rationale}
            </div>
          </div>

          {/* Return Sensitivity */}
          <div className="gp-insight-card" style={{ marginTop: "1rem" }}>
            <div className="gp-insight-title">📈 Goal Achievement at Different Returns</div>
            <div className="gp-insight-sub">How your required SIP changes with market performance</div>
            <div style={{ overflowX: "auto" }}>
              <table className="gp-table" style={{ marginTop: "0.5rem" }}>
                <thead>
                  <tr>
                    <th>Annual Return</th>
                    <th>Corpus at Goal</th>
                    <th>Required Lumpsum</th>
                    <th>Required SIP/mo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sensiRows.map(row => (
                    <tr key={row.rate} style={{ background: row.rate === preReturn ? "rgba(201,168,76,0.07)" : "" }}>
                      <td><strong>{row.rate}%</strong> {row.rate === preReturn && <span className="gp-badge">your assumption</span>}</td>
                      <td className="gp-gold">{smart(row.corpus)}</td>
                      <td>{smart(row.lumpsum)}</td>
                      <td>{smart(row.sip)}/mo</td>
                      <td>
                        {row.rate === preReturn ? "—" : (
                          <span style={{ fontSize: "0.7rem", color: row.sip > monthlySIP ? "var(--red)" : "var(--green)" }}>
                            {row.sip > monthlySIP ? "▲" : "▼"} {smart(Math.abs(row.sip - monthlySIP))}/mo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inflation Sensitivity */}
          <div className="gp-insight-card" style={{ marginTop: "1rem" }}>
            <div className="gp-insight-title">🌡️ Inflation Sensitivity</div>
            <div className="gp-insight-sub">How corpus requirement changes with different inflation assumptions</div>
            <div style={{ overflowX: "auto" }}>
              <table className="gp-table" style={{ marginTop: "0.5rem" }}>
                <thead>
                  <tr>
                    <th>Inflation</th>
                    <th>Corpus Required</th>
                    <th>Required Lumpsum</th>
                    <th>Required SIP/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {inflationRows.map(row => (
                    <tr key={row.rate} style={{ background: row.rate === inflation ? "rgba(201,168,76,0.07)" : "" }}>
                      <td><strong>{row.rate}%</strong> {row.rate === inflation && <span className="gp-badge">your assumption</span>}</td>
                      <td className="gp-gold">{smart(row.corpus)}</td>
                      <td>{smart(row.lumpsum)}</td>
                      <td>{smart(row.sip)}/mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delay + 1% lower return warnings */}
          <div className="gp-two-col" style={{ marginTop: "1rem", gap: "1rem" }}>
            <div className="gp-warn-insight">
              <div className="gp-warn-insight-title">⏰ Cost of Delaying by 1 Year</div>
              <div className="gp-warn-insight-value">{smart(Math.max(0, delayedSIP - monthlySIP))}/mo extra</div>
              <div className="gp-warn-insight-sub">
                SIP rises from {smart(monthlySIP)}/mo to {smart(delayedSIP)}/mo if you wait one more year to start.
              </div>
            </div>
            <div className="gp-warn-insight">
              <div className="gp-warn-insight-title">📉 Impact of 1% Lower Returns</div>
              <div className="gp-warn-insight-value">{smart(Math.max(0, lowerReturnRow.sip - monthlySIP))}/mo extra</div>
              <div className="gp-warn-insight-sub">
                If returns are {(preReturn - 1).toFixed(0)}% instead of {preReturn}%, SIP rises from {smart(monthlySIP)}/mo to {smart(lowerReturnRow.sip)}/mo.
              </div>
            </div>
          </div>

          {/* Actions: PDF + Share */}
          <div className="gp-actions-row" style={{ marginTop: "1rem" }}>
            <button
              className="gp-action-btn primary"
              onClick={async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { jsPDF } = await (import("jspdf") as Promise<any>);
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                const W = 210; const margin = 14;

                doc.setFillColor(10, 22, 40);
                doc.rect(0, 0, W, 28, "F");

                doc.setTextColor(232, 201, 122);
                doc.setFontSize(16);
                doc.setFont("helvetica", "bold");
                doc.text("Veera Wealth Advisor", margin, 11);

                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(180, 160, 100);
                doc.text("ARN: 355717  |  investwithveera.vercel.app", margin, 17);

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.text("Goal-Based Investment Plan", margin, 24);

                const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(180, 160, 100);
                doc.text(`Generated: ${today}`, W - margin, 24, { align: "right" });

                let y = 36;
                const lineH = 7;
                const colW  = (W - margin * 2) / 2;

                const sectionTitle = (title: string) => {
                  doc.setFillColor(240, 235, 224);
                  doc.rect(margin, y - 4, W - margin * 2, 8, "F");
                  doc.setTextColor(10, 22, 40);
                  doc.setFontSize(9);
                  doc.setFont("helvetica", "bold");
                  doc.text(title, margin + 2, y + 1);
                  y += lineH;
                };

                const row2 = (label: string, val: string, col: 0 | 1 = 0) => {
                  const x = margin + col * colW;
                  doc.setFontSize(8);
                  doc.setFont("helvetica", "normal");
                  doc.setTextColor(107, 114, 128);
                  doc.text(label, x, y);
                  doc.setTextColor(10, 22, 40);
                  doc.setFont("helvetica", "bold");
                  doc.text(val, x, y + 4);
                };

                const twoCol = (pairs: [string, string][]) => {
                  for (let i = 0; i < pairs.length; i += 2) {
                    row2(pairs[i][0], pairs[i][1], 0);
                    if (pairs[i + 1]) row2(pairs[i + 1][0], pairs[i + 1][1], 1);
                    y += lineH + 2;
                  }
                };

                sectionTitle("YOUR GOALS");
                if (lumpsumGoals.length === 0 && periodicGoals.length === 0) {
                  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
                  doc.text("No specific goals defined — planning for final corpus only.", margin + 2, y);
                  y += lineH;
                }
                lumpsumGoals.forEach(g => {
                  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
                  doc.text(`Goal  ${g.label || "Unnamed"} — ${smart(g.amount)} (today's value) in ${g.year}`, margin + 2, y);
                  y += lineH;
                });
                periodicGoals.forEach(g => {
                  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
                  doc.text(`Goal  ${g.label || "Unnamed"} — ${smart(g.annualAmount)}/yr from ${g.startYear} to ${g.endYear}`, margin + 2, y);
                  y += lineH;
                });
                doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
                doc.text(`Final corpus to leave behind — ${smart(finalCorpus)} by ${finalYear}`, margin + 2, y);
                y += lineH + 3;

                sectionTitle("KEY RESULTS");
                twoCol([
                  ["Corpus Required", smart(totalCorpusAtAccEnd)],
                  ["Required By Year", String(accEndYear)],
                  ["Required Monthly SIP", `${smart(monthlySIP)}/mo`],
                  ["SIP Duration", `${sipYears} years`],
                  ["Or: Lumpsum Today", smart(additionalLumpsum)],
                  ["Existing Investment", smart(existingLumpsum)],
                ]);

                sectionTitle("ASSUMPTIONS");
                twoCol([
                  ["Return (Accumulation)", `${preReturn}% p.a.`],
                  ["Return (Distribution)", `${duringReturn}% p.a.`],
                  ["Inflation Rate", `${inflation}% p.a.`],
                  ["Years to Goal", `${yearsToAccEnd} years`],
                ]);

                sectionTitle("RECOMMENDED ASSET ALLOCATION");
                doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
                doc.text(`Equity: ${alloc.equity}%  |  Hybrid: ${alloc.hybrid}%  |  Debt: ${alloc.debt}%`, margin + 2, y);
                y += lineH;
                doc.text(`Category: ${alloc.category}`, margin + 2, y);
                y += lineH + 3;

                sectionTitle("RETURN SENSITIVITY");
                const sColW = (W - margin * 2) / 4;
                ["Return", "Corpus", "Lumpsum", "SIP/mo"].forEach((h, i) => {
                  doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(107, 114, 128);
                  doc.text(h, margin + i * sColW, y);
                });
                y += 5;
                sensiRows.forEach(sr => {
                  const isActive = sr.rate === preReturn;
                  if (isActive) { doc.setFillColor(248, 243, 220); doc.rect(margin, y - 3.5, W - margin * 2, 5.5, "F"); }
                  doc.setFontSize(7.5); doc.setTextColor(10, 22, 40);
                  doc.setFont("helvetica", isActive ? "bold" : "normal");
                  doc.text(`${sr.rate}%${isActive ? " ◀" : ""}`, margin, y);
                  doc.text(smart(sr.corpus), margin + sColW, y);
                  doc.text(smart(sr.lumpsum), margin + sColW * 2, y);
                  doc.text(`${smart(sr.sip)}/mo`, margin + sColW * 3, y);
                  y += 5.5;
                });
                y += 3;

                sectionTitle("COST OF DELAY");
                doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
                doc.text(`Delaying by 1 year increases monthly SIP by ${smart(Math.max(0, delayedSIP - monthlySIP))}/mo`, margin + 2, y);
                y += lineH;
                doc.text(`1% lower returns increases monthly SIP by ${smart(Math.max(0, lowerReturnRow.sip - monthlySIP))}/mo`, margin + 2, y);
                y += lineH + 4;

                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFillColor(250, 249, 246);
                doc.rect(margin, y, W - margin * 2, 36, "F");
                doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(107, 114, 128);
                doc.text("IMPORTANT DISCLOSURES", margin + 2, y + 5);
                doc.setFont("helvetica", "normal");
                const disclaimerLines = [
                  "Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing.",
                  "Past performance is not indicative of future returns. Returns shown are assumed rates and not guaranteed.",
                  "This document is for illustrative purposes only and does not constitute investment advice.",
                  "Inflation assumptions are estimates. This tool does not account for taxes on capital gains or withdrawals.",
                ];
                disclaimerLines.forEach((line, i) => {
                  doc.text(line, margin + 2, y + 11 + i * 5, { maxWidth: W - margin * 2 - 4 });
                });
                y += 38;

                doc.setFillColor(10, 22, 40);
                doc.rect(0, 282, W, 15, "F");
                doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(232, 201, 122);
                doc.text("Veera Wealth Advisor  |  ARN: 355717  |  investwithveera.vercel.app", W / 2, 291, { align: "center" });

                doc.save(`VeeraWealthAdvisor_GoalPlan_${today.replace(/ /g, "_")}.pdf`);
              }}
            >
              🖨️ Download PDF Report
            </button>
            <button
              className={`gp-action-btn ${shareCopied ? "share-copied" : ""}`}
              onClick={() => {
                const url = buildShareUrl();
                navigator.clipboard?.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                });
              }}
            >
              {shareCopied ? "✅ Link Copied!" : "🔗 Copy Shareable Link"}
            </button>
          </div>

          {/* Disclaimer */}
          <div className="gp-disclaimer">
            <div className="gp-disclaimer-title">Important Disclosures</div>
            <p>Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing.</p>
            <p>Past performance is not indicative of future returns. Returns shown are assumed rates for illustration purposes only and are not guaranteed.</p>
            <p>This calculator is for educational and illustrative purposes only and does not constitute investment advice. Projections are based on constant assumed rates of return — actual returns will vary year to year.</p>
            <p>Inflation assumptions are estimates; actual inflation may differ. This tool does not account for taxes on capital gains or withdrawal amounts.</p>
            <p style={{ marginTop: "0.5rem" }}>
              <strong>Veera Karthik</strong> · AMFI Registered Mutual Fund Distributor · ARN: 355717 ·{" "}
              <a href="https://investwithveera.vercel.app" style={{ color: "var(--gold)", textDecoration: "none" }}>investwithveera.vercel.app</a>
            </p>
          </div>
        </>
      )}

      {/* Empty-state disclaimer (when no goals yet) */}
      {!isValid && (lumpsumGoals.length === 0 && periodicGoals.length === 0) && (
        <div className="gp-disclaimer" style={{ marginTop: "1rem" }}>
          <div className="gp-disclaimer-title">Important Disclosures</div>
          <p>Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing.</p>
          <p>This calculator is for educational and illustrative purposes only and does not constitute investment advice.</p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Veera Karthik</strong> · AMFI Registered Mutual Fund Distributor · ARN: 355717 ·{" "}
            <a href="https://investwithveera.vercel.app" style={{ color: "var(--gold)", textDecoration: "none" }}>investwithveera.vercel.app</a>
          </p>
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
        .gp-input::placeholder { color: #b0b7c3; font-weight: 400; }
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

        /* Empty state */
        .gp-empty-state { padding: 1.25rem 1rem; text-align: center; background: var(--white); border: 1px dashed var(--border); border-radius: 7px; }
        .gp-empty-title { font-size: 0.82rem; font-weight: 500; color: var(--navy); margin-bottom: 0.25rem; }
        .gp-empty-sub { font-size: 0.75rem; color: var(--muted); }

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

        /* ── Insights ── */
        .gp-insight-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 1.1rem 1.25rem; }
        .gp-insight-title { font-size: 0.82rem; font-weight: 600; color: var(--navy); margin-bottom: 0.2rem; }
        .gp-insight-sub { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.75rem; }
        .gp-badge { display: inline-block; font-size: 0.6rem; background: rgba(201,168,76,0.15); color: #92400e; border-radius: 10px; padding: 0.1rem 0.45rem; margin-left: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; vertical-align: middle; }

        /* Allocation bar */
        .alloc-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-bottom: 0.6rem; }
        .alloc-seg { display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 600; color: white; transition: width 0.4s ease; white-space: nowrap; overflow: hidden; }
        .alloc-seg.eq  { background: #1d4ed8; }
        .alloc-seg.hy  { background: #c9a84c; }
        .alloc-seg.dbt { background: #16a34a; }
        .alloc-detail { font-size: 0.75rem; color: var(--muted); line-height: 1.5; }

        /* Warn insights */
        .gp-warn-insight { background: #fff8f0; border: 1px solid rgba(239,68,68,0.15); border-radius: 8px; padding: 1rem 1.1rem; }
        .gp-warn-insight-title { font-size: 0.72rem; font-weight: 600; color: var(--navy); margin-bottom: 0.35rem; }
        .gp-warn-insight-value { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; font-weight: 700; color: #dc2626; line-height: 1; margin-bottom: 0.3rem; }
        .gp-warn-insight-sub { font-size: 0.71rem; color: var(--muted); line-height: 1.5; }

        /* Actions */
        .gp-actions-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .gp-action-btn { border-radius: 6px; padding: 0.6rem 1.25rem; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: opacity 0.2s; border: 1px solid var(--border); background: var(--white); color: var(--navy); }
        .gp-action-btn.primary { background: var(--navy); color: var(--gold2); border-color: transparent; }
        .gp-action-btn:hover { opacity: 0.82; }

        /* Disclaimer */
        .gp-disclaimer { margin-top: 1rem; background: #faf9f6; border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; }
        .gp-disclaimer-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.6rem; }
        .gp-disclaimer p { font-size: 0.71rem; color: var(--muted); line-height: 1.6; margin-bottom: 0.35rem; }
        .gp-disclaimer p:last-child { margin-bottom: 0; }

        .gp-action-btn.share-copied { background: #f0fdf4; border-color: #16a34a; color: #16a34a; }

        /* SIP timing toggle */
        .timing-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: #faf9f6; border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1.1rem; margin-bottom: 1.25rem; }
        .timing-label { font-size: 0.78rem; font-weight: 500; color: var(--navy); }
        .timing-toggle { display: flex; background: #fff; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .timing-btn { padding: 0.3rem 0.85rem; border: none; background: none; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; color: var(--muted); cursor: pointer; transition: all 0.18s; white-space: nowrap; }
        .timing-btn.active { background: var(--navy); color: var(--gold2); font-weight: 500; }
        .timing-hint { font-size: 0.72rem; color: var(--muted); }

        /* Assumption note */
        .calc-assumption-note { font-size: 0.75rem; color: var(--muted); background: rgba(201,168,76,0.07); border: 1px solid rgba(201,168,76,0.15); border-radius: 6px; padding: 0.6rem 0.9rem; margin-bottom: 1.25rem; line-height: 1.6; }

        /* GpInput error */
        .gp-input-error { border-color: var(--red) !important; color: var(--red); }

        @media print {
          .nav, .tabs, .gp-section, .gp-actions-row, .calc-header { display: none !important; }
          .calc-card { box-shadow: none; border: none; padding: 0; }
          .gp-disclaimer { page-break-inside: avoid; }
        }

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
        {tab === "goal"    && (
          <Suspense fallback={<div style={{ padding: "2rem", color: "var(--muted)", textAlign: "center" }}>Loading planner…</div>}>
            <GoalPlanner />
          </Suspense>
        )}
      </div>
    </>
  );
}
