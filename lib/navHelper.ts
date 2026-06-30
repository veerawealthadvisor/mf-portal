// Fetches live NAV from mfapi.in for a given scheme name
// Includes strict matching safeguards to prevent wrong-fund NAV mismatches

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
}

// Words that don't help identify a fund — strip these before comparing
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

// Calculate how many "identifying" words from the original scheme name
// actually appear in the candidate scheme name (Jaccard-style overlap)
function wordOverlapScore(original: string, candidate: string): number {
  const origWords = new Set(normalizeWords(original));
  const candWords = new Set(normalizeWords(candidate));
  if (origWords.size === 0) return 0;

  let matched = 0;
  origWords.forEach((w) => {
    if (candWords.has(w)) matched++;
  });

  return matched / origWords.size; // 0 to 1
}

export async function getLiveNAV(schemeName: string): Promise<NAVResult | null> {
  try {
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
      console.warn(`No NAV search results for: "${schemeName}"`);
      return null;
    }

    const lower = schemeName.toLowerCase();

    const wantsRegular = lower.includes("regular");
    const wantsDirect = lower.includes("direct");
    const wantsGrowth =
      lower.includes("growth") &&
      !lower.includes("idcw") &&
      !lower.includes("dividend");
    const wantsIDCW = lower.includes("idcw") || lower.includes("dividend");

    // Score each result: word overlap (most important) + plan/option match
    const scored = schemes.map((s) => {
      const n = s.schemeName.toLowerCase();
      const overlap = wordOverlapScore(schemeName, s.schemeName); // 0–1

      let planScore = 0;
      if (wantsRegular && n.includes("regular")) planScore += 1;
      if (wantsDirect && n.includes("direct")) planScore += 1;
      if (wantsGrowth && n.includes("growth") && !n.includes("idcw") && !n.includes("dividend")) planScore += 1;
      if (wantsIDCW && (n.includes("idcw") || n.includes("dividend"))) planScore += 1;

      if (wantsGrowth && (n.includes("idcw") || n.includes("dividend"))) planScore -= 2;
      if (wantsIDCW && n.includes("growth") && !n.includes("idcw")) planScore -= 2;
      if (wantsRegular && n.includes("direct")) planScore -= 1;
      if (wantsDirect && n.includes("regular")) planScore -= 1;

      // Combined score: word overlap dominates, plan match is a tiebreaker
      const totalScore = overlap * 10 + planScore;

      return { ...s, overlap, totalScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const best = scored[0];

    // SAFETY GATE: if the best match doesn't share enough words with the
    // original scheme name, refuse to return it rather than risk a wrong fund.
    // Require at least 60% of identifying words to overlap.
    if (best.overlap < 0.6) {
      console.warn(
        `Low-confidence NAV match rejected for "${schemeName}" — best candidate was "${best.schemeName}" (${(best.overlap * 100).toFixed(0)}% word overlap). Falling back to invested amount.`
      );
      return null;
    }

    const matchConfidence: "high" | "medium" | "low" =
      best.overlap >= 0.85 ? "high" : best.overlap >= 0.7 ? "medium" : "low";

    if (matchConfidence !== "high") {
      console.warn(
        `Medium/low-confidence NAV match for "${schemeName}" → matched "${best.schemeName}" (${(best.overlap * 100).toFixed(0)}% overlap). Please verify manually.`
      );
    }

    const navRes = await fetch(`https://api.mfapi.in/mf/${best.schemeCode}/latest`);
    const navData = await navRes.json();

    if (navData?.data?.[0]?.nav) {
      const nav = parseFloat(navData.data[0].nav);

      // SAFETY GATE 2: sanity-check the NAV value itself.
      // Reject clearly broken values (zero, negative, or absurdly large).
      if (!nav || nav <= 0 || nav > 100000) {
        console.warn(`Suspicious NAV value (${nav}) for "${schemeName}" — rejecting.`);
        return null;
      }

      return {
        nav,
        date: navData.data[0].date,
        schemeName: best.schemeName,
        schemeCode: best.schemeCode,
        matchConfidence,
      };
    }

    return null;
  } catch (err) {
    console.error("NAV fetch error for:", schemeName, err);
    return null;
  }
}
