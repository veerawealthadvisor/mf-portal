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

// Slider with dynamic colour fill and synced text input
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
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSlider}
          className="slider"
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

// Line chart with Y axis
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

  const fvArea = [
    `M ${px(0)} ${py(points[0])}`,
    ...points.map((v: number, i: number) => `L ${px(i)} ${py(v)}`),
    `L ${px(points.length - 1)} ${py(minVal)}`,
    `L ${px(0)} ${py(minVal)} Z`
  ].join(" ");

  // Y axis ticks
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (range / yTicks) * i);

  // X axis labels — show every nth
  const xStep = Math.ceil(labels.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, overflow: "visible" }}>
      <defs>
        <linearGradient id="fvGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTickVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={py(v)} x2={W - padR} y2={py(v)} stroke="#e5e7eb" strokeWidth="0.8" strokeDasharray="3,3" />
          <text x={padL - 6} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{formatY(v)}</text>
        </g>
      ))}

      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />

      {/* Invested area (subtle) */}
      <path d={[
        `M ${px(0)} ${py(invested[0])}`,
        ...invested.map((v: number, i: number) => `L ${px(i)} ${py(v)}`),
        `L ${px(invested.length - 1)} ${py(minVal)}`,
        `L ${px(0)} ${py(minVal)} Z`
      ].join(" ")} fill="rgba(10,22,40,0.06)" />

      {/* FV area */}
      <path d={fvArea} fill="url(#fvGrad)" />

      {/* Lines */}
      <path d={invLine} fill="none" stroke="#0a1628" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
      <path d={fvLine} fill="none" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* X labels */}
      {labels.map((l: string, i: number) => (
        i % xStep === 0 || i === labels.length - 1 ? (
          <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{l}</text>
        ) : null
      ))}

      {/* End dot */}
      <circle cx={px(points.length - 1)} cy={py(points[points.length - 1])} r="4" fill="#c9a84c" />
      <circle cx={px(invested.length - 1)} cy={py(invested[invested.length - 1])} r="3" fill="#0a1628" opacity="0.5" />
    </svg>
  );
}

function SIPCalculator() {
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const [stepUp, setStepUp] = useState(false);
  const [stepRate, setStepRate] = useState(10);

  const isValid = monthly >= 500;

  // Calculate with optional step-up
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
      // Step-up SIP
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

      {!isValid && (
        <div className="warn-box">⚠️ Monthly SIP must be at least ₹500 to see results</div>
      )}

      <div className="inputs-grid">
        <SliderInput label="Monthly SIP Amount" value={monthly} min={500} max={100000} step={500}
          onChange={setMonthly} format={(v: number) => `₹${formatINR(v)}`} unit="₹" minWarn={500} />
        <SliderInput label="Expected Annual Return" value={rate} min={1} max={30} step={0.5}
          onChange={setRate} unit="%" />
        <SliderInput label="Investment Period" value={years} min={1} max={40} step={1}
          onChange={setYears} unit=" yrs" />
      </div>

      {/* Step-up SIP */}
      <div className="stepup-row">
        <label className="stepup-label">
          <input type="checkbox" checked={stepUp} onChange={e => setStepUp(e.target.checked)} className="stepup-check" />
          <span>Step-up SIP</span>
          <span className="stepup-hint">Increase SIP by a fixed % every year</span>
        </label>
        {stepUp && (
          <SliderInput label="Annual Step-up Rate" value={stepRate} min={1} max={50} step={1}
            onChange={setStepRate} unit="%" />
        )}
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

      {!isValid && (
        <div className="warn-box">⚠️ Investment amount must be at least ₹1,000</div>
      )}

      <div className="inputs-grid">
        <SliderInput label="Investment Amount" value={principal} min={1000} max={10000000} step={1000}
          onChange={setPrincipal} format={(v: number) => `₹${formatINR(v)}`} unit="₹" minWarn={1000} />
        <SliderInput label="Expected CAGR" value={rate} min={1} max={30} step={0.5}
          onChange={setRate} unit="%" />
        <SliderInput label="Investment Period" value={years} min={1} max={40} step={1}
          onChange={setYears} unit=" yrs" />
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

export default function CalculatorsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"sip" | "lumpsum">("sip");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --navy: #0a1628; --gold: #c9a84c; --gold2: #e8c97a; --white: #fff; --muted: #6b7280; --border: rgba(0,0,0,0.08); --green: #16a34a; }
        body { font-family: 'DM Sans', sans-serif; background: #f0ebe0; }

        .nav { background: var(--navy); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(201,168,76,0.2); }
        .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 700; color: var(--gold2); }
        .nav-links { display: flex; gap: 1rem; }
        .nav-link { color: rgba(255,255,255,0.55); font-size: 0.82rem; text-decoration: none; padding: 0.35rem 0.75rem; border-radius: 2px; transition: all 0.2s; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; }
        .nav-link:hover { color: var(--gold2); }

        .main { max-width: 860px; margin: 0 auto; padding: 2.5rem 2rem; }
        .page-title { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 700; color: var(--navy); margin-bottom: 0.4rem; }
        .page-sub { font-size: 0.88rem; color: var(--muted); margin-bottom: 2rem; }

        .tabs { display: flex; background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 4px; margin-bottom: 2rem; width: fit-content; }
        .tab-btn { padding: 0.6rem 1.5rem; border-radius: 6px; border: none; background: none; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: var(--muted); cursor: pointer; transition: all 0.2s; }
        .tab-btn.active { background: var(--navy); color: var(--gold2); font-weight: 500; }

        .calc-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; }
        .calc-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
        .calc-icon { font-size: 2rem; }
        .calc-header h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 700; color: var(--navy); margin-bottom: 0.2rem; }
        .calc-header p { font-size: 0.82rem; color: var(--muted); }

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
        .stepup-label { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 0; }
        .stepup-check { width: 16px; height: 16px; accent-color: var(--navy); cursor: pointer; }
        .stepup-label span:first-of-type { font-size: 0.88rem; font-weight: 500; color: var(--navy); }
        .stepup-hint { font-size: 0.75rem; color: var(--muted); }
        .stepup-row .input-group { margin-top: 1rem; }

        .result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
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

        .chart-section { margin-top: 0.5rem; }
        .chart-title { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .chart-legend { display: flex; align-items: center; gap: 6px; margin-top: 0.5rem; font-size: 0.75rem; color: var(--muted); }
        .legend-line { display: inline-block; width: 20px; height: 2px; border-radius: 1px; }
        .gold-line { background: var(--gold); }
        .navy-line { background: var(--navy); opacity: 0.5; }

        .tip-box { margin-top: 1.25rem; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); border-radius: 8px; padding: 0.85rem 1.1rem; font-size: 0.82rem; color: #92400e; line-height: 1.6; }

        @media (max-width: 600px) {
          .result-grid { grid-template-columns: 1fr; }
          .main { padding: 1.25rem 1rem; }
          .tabs { width: 100%; }
          .tab-btn { flex: 1; }
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
        </div>

        {tab === "sip" ? <SIPCalculator /> : <LumpSumCalculator />}
      </div>
    </>
  );
}
