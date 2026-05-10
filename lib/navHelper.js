// Fetches live NAV from mfapi.in for a given scheme name
export async function getLiveNAV(schemeName) {
  try {
    // Extract key words for search
    const query = schemeName
      .replace(/[-–]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 5)
      .join(" ");

    // Search for matching schemes
    const searchRes = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`
    );
    const schemes = await searchRes.json();

    if (!schemes || schemes.length === 0) return null;

    const lower = schemeName.toLowerCase();

    // Detect plan type and option from scheme name
    const wantsRegular = lower.includes("regular");
    const wantsDirect = lower.includes("direct");
    const wantsGrowth =
      lower.includes("growth") &&
      !lower.includes("idcw") &&
      !lower.includes("dividend");
    const wantsIDCW =
      lower.includes("idcw") || lower.includes("dividend");

    // Score each result
    const scored = schemes.map((s) => {
      const n = s.schemeName.toLowerCase();
      let score = 0;

      if (wantsRegular && n.includes("regular")) score += 3;
      if (wantsDirect && n.includes("direct")) score += 3;

      if (wantsGrowth && n.includes("growth") && !n.includes("idcw") && !n.includes("dividend")) score += 4;
      if (wantsIDCW && (n.includes("idcw") || n.includes("dividend"))) score += 4;

      if (wantsGrowth && (n.includes("idcw") || n.includes("dividend"))) score -= 5;
      if (wantsIDCW && n.includes("growth") && !n.includes("idcw")) score -= 5;

      if (wantsRegular && n.includes("direct")) score -= 3;
      if (wantsDirect && n.includes("regular")) score -= 3;

      return { ...s, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Fetch latest NAV for best match
    const navRes = await fetch(
      `https://api.mfapi.in/mf/${best.schemeCode}/latest`
    );
    const navData = await navRes.json();

    if (navData?.data?.[0]?.nav) {
      return {
        nav: parseFloat(navData.data[0].nav),
        date: navData.data[0].date,
        schemeName: best.schemeName,
        schemeCode: best.schemeCode,
      };
    }

    return null;
  } catch (err) {
    console.error("NAV fetch error for:", schemeName, err);
    return null;
  }
}