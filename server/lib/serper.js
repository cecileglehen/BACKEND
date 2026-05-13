// Serper API — Google Search wrapper
// https://serper.dev — 2500 recherches gratuites/mois

const SERPER_URL = "https://google.serper.dev/search";

function key() {
  const k = (process.env.SERPER_API_KEY || "").trim();
  if (!k) throw new Error("SERPER_API_KEY manquante");
  return k;
}

/**
 * Effectue une recherche Google via Serper.
 * @param {string} query
 * @param {object} opts
 *   - num   (default 8) : nombre de résultats
 *   - lang  (default "fr")
 *   - country (default "fr")
 * @returns {Promise<{query, results: Array<{title,url,snippet,date?,source?}>, answerBox?, knowledgeGraph?}>}
 */
export async function serperSearch(query, opts = {}) {
  const body = {
    q: String(query || "").slice(0, 1000),
    num: opts.num ?? 8,
    hl:  opts.lang ?? "fr",
    gl:  opts.country ?? "fr"
  };

  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": key(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Serper ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();

  const organic = Array.isArray(data.organic) ? data.organic : [];
  const results = organic.map((r) => ({
    title:   r.title,
    url:     r.link,
    snippet: r.snippet || r.description || "",
    date:    r.date,
    source:  r.source
  }));

  return {
    query,
    results,
    answerBox: data.answerBox || null,
    knowledgeGraph: data.knowledgeGraph || null,
    relatedSearches: Array.isArray(data.relatedSearches) ? data.relatedSearches.map((x) => x.query) : []
  };
}

/**
 * Formate les résultats en contexte texte injectable dans un system prompt.
 */
export function formatSearchContext(searchData) {
  if (!searchData?.results?.length) return "";

  const lines = [];
  lines.push(`[RÉSULTATS DE RECHERCHE WEB — "${searchData.query}"]`);
  lines.push(`Date de la recherche : ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");

  if (searchData.answerBox) {
    const a = searchData.answerBox;
    lines.push(`▸ Réponse directe Google : ${a.answer || a.snippet || a.title || ""}`);
    if (a.source) lines.push(`  Source : ${a.source}`);
    lines.push("");
  }

  if (searchData.knowledgeGraph) {
    const kg = searchData.knowledgeGraph;
    lines.push(`▸ Fiche : ${kg.title || ""}${kg.type ? ` (${kg.type})` : ""}`);
    if (kg.description) lines.push(`  ${kg.description}`);
    lines.push("");
  }

  lines.push("Top résultats organiques :");
  searchData.results.slice(0, 8).forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}`);
    lines.push(`    URL : ${r.url}`);
    if (r.date) lines.push(`    Date : ${r.date}`);
    if (r.snippet) lines.push(`    ${r.snippet}`);
    lines.push("");
  });

  return lines.join("\n");
}
