// Scoring quantitatif d'une source (0-100) basé sur 4 dimensions :
//   1. Autorité du domaine (TLD, host whitelisté)
//   2. Fraîcheur (date de publication détectée)
//   3. Cohérence avec les autres sources (présence dans clusters consensus)
//   4. Citations / liens externes dans le contenu (proxy de qualité éditoriale)

const HIGH_TRUST = /(wikipedia\.org|reuters\.com|apnews\.com|bbc\.co\.uk|nytimes\.com|lemonde\.fr|nature\.com|sciencedirect\.com|arxiv\.org|nih\.gov|who\.int|un\.org|oecd\.org|europa\.eu|insee\.fr|github\.com|stackexchange\.com)/i;
const MEDIUM_TRUST_TLD = /\.(gov|edu|gouv\.fr)$/i;
const LOW_TRUST = /(blogspot|wordpress\.com|medium\.com|substack|tumblr|reddit)/i;
const SOCIAL = /(facebook|instagram|tiktok|x\.com|twitter\.com|pinterest)/i;

function domainAuthority(url = "") {
  if (!url) return 30;
  if (HIGH_TRUST.test(url)) return 95;
  if (MEDIUM_TRUST_TLD.test(url)) return 85;
  if (SOCIAL.test(url)) return 15;
  if (LOW_TRUST.test(url)) return 45;
  // Heuristique : domaine .com/.fr classique = 60
  return 60;
}

// Détecte une date dans le texte ou un meta tag. Fraicheur en jours.
function freshnessScore(page) {
  const text = `${page?.text || ""} ${page?.publishedAt || ""}`;
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (!yearMatch) return 50; // inconnu : neutre
  const year = Number(yearMatch[1]);
  const currentYear = new Date().getFullYear();
  const ageYears = currentYear - year;
  if (ageYears <= 0) return 100;
  if (ageYears <= 1) return 90;
  if (ageYears <= 2) return 75;
  if (ageYears <= 5) return 55;
  if (ageYears <= 10) return 35;
  return 20;
}

// Combien de claims de cette source sont confirmés par d'autres sources ?
// Donné par le graph cross-reference (clusters.confidence === "high").
function coherenceScore(source, graph) {
  if (!graph?.clusters?.length) return 50;
  const sourceId = source.sourceId;
  let confirmed = 0;
  let total = 0;
  for (const cluster of graph.clusters) {
    if (cluster.sources?.includes(sourceId)) {
      total += 1;
      if (cluster.confidence === "high" || (cluster.sources?.length || 0) >= 2) {
        confirmed += 1;
      }
    }
  }
  if (total === 0) return 50;
  return Math.round((confirmed / total) * 100);
}

// Approximation : nombre de liens externes/citations dans le texte original
function citationScore(page) {
  const text = page?.rawText || page?.text || "";
  if (!text) return 30;
  const urls = text.match(/https?:\/\//g)?.length || 0;
  const brackets = text.match(/\[\d+\]/g)?.length || 0;
  const total = urls + brackets * 2;
  if (total >= 20) return 90;
  if (total >= 10) return 75;
  if (total >= 5) return 60;
  if (total >= 1) return 45;
  return 30;
}

// Score global pondéré [0-100]
export function scoreSource(source, graph) {
  const weights = { authority: 0.35, freshness: 0.15, coherence: 0.35, citations: 0.15 };
  const dims = {
    authority: domainAuthority(source.url),
    freshness: freshnessScore(source),
    coherence: coherenceScore(source, graph),
    citations: citationScore(source)
  };
  const total =
    weights.authority * dims.authority +
    weights.freshness * dims.freshness +
    weights.coherence * dims.coherence +
    weights.citations * dims.citations;

  return {
    score: Math.round(total),
    breakdown: dims,
    tier: total >= 75 ? "high" : total >= 50 ? "medium" : "low"
  };
}

// Applique scoreSource à toutes les sources et trie par score descendant.
export function scoreAllSources(sources, graph) {
  return sources.map((s) => ({ ...s, scoring: scoreSource(s, graph) }))
    .sort((a, b) => b.scoring.score - a.scoring.score);
}
