// Fetches live NAV from mfapi.in for a given scheme name
// Includes hardcoded scheme codes for known funds + fuzzy search fallback for new funds

interface MFApiSearchResult {
  schemeCode: number;
  schemeName: string;
}

interface NAVResult {
  nav: number;
  date: string;
  schemeName: string;
  schemeCode: number;
  matchConfidence: "high" | "medium" | "low";
  source: "hardcoded" | "search";
}

// ── HARDCODED SCHEME CODES ──────────────────────────────────────────────────
// Exact mfapi.in scheme codes for all currently recommended Regular plan funds.
// When a new fund appears in uploads that isn't here, the system falls back to
// fuzzy search and logs a warning so you know to add it here.
const SCHEME_CODE_OVERRIDES: Record<string, number> = {
  "axis nifty 100 index fund regular growth":                                          147665,
  "axis short duration fund - growth":                                                 112354,
  "axis small cap fund growth":                                                        125350,
  "axis treasury advantage fund - growth":                                             112214,
  "bandhan low duration fund-growth-(regular plan)":                                   108632,
  "bandhan money market fund--growth-(regular plan)":                                  108756,
  "bandhan small cap fund regular plan-growth":                                        147944,
  "edelweiss nifty midcap150 momentum 50 index fund- regular plan growth - growth":   150900,
  "hdfc large and mid cap fund- regular plan-growth":                                  130496,
  "icici prudential banking and financial services fund - regular plan - growth":      109445,
  "icici prudential nifty bank index fund - growth":                                   149859,
  "icici prudential ultra short term fund-regular-growth":                             115092,
  "kotak small cap fund - growth":                                                     102875,
  "motilal oswal digital india fund regular growth":                                   152966,
  "motilal oswal midcap fund - regular plan growth":                                   127039,
  "nippon india growth mid cap fund - growth plan growth option":                      100377,
  "parag parikh flexi cap fund-regular-growth":                                        122640,
  "invesco india ultra short duration fund - regular plan - growth": 114359,
"kotak midcap fund -growth":                                        104908,
"motilal oswal ultra short term fund regular growth":               124233,
"nippon india banking & financial services fund growth plan growth option": 101862,
"nippon india ultra short duration fund - growth option":           143493,
"parag parikh arbitrage fund - regular plan growth":                152110,
"invesco india low duration fund growth":                          104726,
"invesco india midcap fund - regular plan - growth":              105503,
"invesco india small cap fund regular growth":             145139,
"tata digital india fund regular plan growth":             135797,
"tata ethical fund regular plan - growth":                 100415,
"tata short term bond fund regular plan - growth":         101548,
"tata ultra short term fund - regular plan - growth":      146070,
};

// Words that don't help identify a fund — strip before comparing
const STOP_WORDS = new Set([
  "fund", "scheme", "plan", "the", "of", "a", "an", "and", "-", "–",
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[-–()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function wordOverlapScore(original: string, candidate: string): number {
  const origWords = new Set(normalizeWords(original));
  const candWords = new Set(normalizeWords(candidate));
  if (origWords.size === 0) return 0;
  let matched = 0;
  origWords.forEach((w) => { if (candWords.has(w)) matched++; });
  return matched / origWords.size;
}

export async function getLiveNAV(schemeName: string): Promise<NAVResult | null> {
  try {
    // ── Step 1: Check hardcoded overrides first (fast, accurate) ──
    const overrideCode = SCHEME_CODE_OVERRIDES[schemeName.toLowerCase().trim()];
    if (overrideCode) {
      const navRes = await fetch(`https://api.mfapi.in/mf/${overrideCode}/latest`);
      const navData = await navRes.json();
      if (navData?.data?.[0]?.nav) {
        const nav = parseFloat(navData.data[0].nav);
        if (nav > 0 && nav < 100000) {
          return {
            nav,
            date: navData.data[0].date,
            schemeName,
            schemeCode: overrideCode,
            matchConfidence: "high",
            source: "hardcoded",
          };
        }
      }
    }

    // ── Step 2: Fuzzy search fallback for NEW funds not yet hardcoded ──
    console.warn(
      `[NAV] "${schemeName}" not in hardcoded map — falling back to fuzzy search. ` +
      `If this fund is added permanently, add its scheme code to SCHEME_CODE_OVERRIDES in navHelper.ts.`
    );

    const query = schemeName
      .replace(/[-–]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 5)
      .join(" ");

    const searchRes = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`
    );
    const schemes: MFApiSearchResult[] = await searchRes.json();

    if (!schemes || schemes.length === 0) {
      console.warn(`[NAV] No search results for: "${schemeName}"`);
      return null;
    }

    const lower = schemeName.toLowerCase();
    const wantsRegular = lower.includes("regular");
    const wantsDirect  = lower.includes("direct");
    const wantsGrowth  = lower.includes("growth") && !lower.includes("idcw") && !lower.includes("dividend");
    const wantsIDCW    = lower.includes("idcw") || lower.includes("dividend");

    const scored = schemes.map((s) => {
      const n = s.schemeName.toLowerCase();
      const overlap = wordOverlapScore(schemeName, s.schemeName);
      let planScore = 0;
      if (wantsRegular && n.includes("regular")) planScore += 1;
      if (wantsDirect  && n.includes("direct"))  planScore += 1;
      if (wantsGrowth  && n.includes("growth") && !n.includes("idcw") && !n.includes("dividend")) planScore += 1;
      if (wantsIDCW    && (n.includes("idcw") || n.includes("dividend"))) planScore += 1;
      if (wantsGrowth  && (n.includes("idcw") || n.includes("dividend"))) planScore -= 2;
      if (wantsIDCW    && n.includes("growth") && !n.includes("idcw"))    planScore -= 2;
      if (wantsRegular && n.includes("direct"))  planScore -= 1;
      if (wantsDirect  && n.includes("regular")) planScore -= 1;
      return { ...s, overlap, totalScore: overlap * 10 + planScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const best = scored[0];

    // Reject low-confidence matches — better to show invested amount than wrong NAV
    if (best.overlap < 0.6) {
      console.warn(
        `[NAV] Low-confidence match rejected for "${schemeName}" — best was "${best.schemeName}" ` +
        `(${(best.overlap * 100).toFixed(0)}% overlap). Add scheme code to navHelper.ts to fix.`
      );
      return null;
    }

    const matchConfidence: "high" | "medium" | "low" =
      best.overlap >= 0.85 ? "high" : best.overlap >= 0.7 ? "medium" : "low";

    console.warn(
      `[NAV] Fuzzy match for "${schemeName}" → "${best.schemeName}" ` +
      `(${(best.overlap * 100).toFixed(0)}% overlap, ${matchConfidence} confidence). ` +
      `Scheme code: ${best.schemeCode}. Consider hardcoding this.`
    );

    const navRes = await fetch(`https://api.mfapi.in/mf/${best.schemeCode}/latest`);
    const navData = await navRes.json();

    if (navData?.data?.[0]?.nav) {
      const nav = parseFloat(navData.data[0].nav);
      if (!nav || nav <= 0 || nav > 100000) {
        console.warn(`[NAV] Suspicious NAV value (${nav}) for "${schemeName}" — rejecting.`);
        return null;
      }
      return {
        nav,
        date: navData.data[0].date,
        schemeName: best.schemeName,
        schemeCode: best.schemeCode,
        matchConfidence,
        source: "search",
      };
    }

    return null;
  } catch (err) {
    console.error("[NAV] Fetch error for:", schemeName, err);
    return null;
  }
}