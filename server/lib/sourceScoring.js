// Scoring quantitatif d'une source (0-100) basé sur 4 dimensions :
//   1. Autorité du domaine (TLD, host whitelisté)
//   2. Fraîcheur (date de publication détectée)
//   3. Cohérence avec les autres sources (présence dans clusters consensus)
//   4. Citations / liens externes dans le contenu (proxy de qualité éditoriale)

// Domaines OFFICIELS / sources PRIMAIRES (un éditeur sur son propre site est LA
// référence pour son propre produit). Une annonce sur openai.com, anthropic.com
// ou blog.google est de la 1ʳᵉ main → fiabilité maximale, jamais "non vérifiée".
const OFFICIAL_PRIMARY = /(openai\.com|anthropic\.com|deepmind\.google|blog\.google|developers\.googleblog\.com|ai\.google(\.dev)?|cloud\.google\.com|mistral\.ai|x\.ai|meta\.ai|ai\.meta\.com|llama\.com|microsoft\.com|azure\.com|apple\.com|nvidia\.com|huggingface\.co|cohere\.com|stability\.ai|databricks\.com|perplexity\.ai)/i;

// Sources de référence / agences de presse / institutionnel → autorité maximale.
const HIGH_TRUST = /(wikipedia\.org|reuters\.com|apnews\.com|afp\.com|bbc\.(co\.uk|com)|nature\.com|sciencedirect\.com|arxiv\.org|nih\.gov|who\.int|un\.org|oecd\.org|imf\.org|worldbank\.org|europa\.eu|insee\.fr|banque-france\.fr|github\.com|stackexchange\.com|stackoverflow\.com)/i;

// Grande presse établie (rédactions professionnelles, fact-checking, déontologie).
// Un média mainstream qui couvre un sujet d'actu N'EST PAS une source douteuse :
// il mérite une autorité élevée, pas un médiocre 60.
const NEWS_TRUST = /(lemonde\.fr|lefigaro\.fr|liberation\.fr|lesechos\.fr|leparisien\.fr|francetvinfo\.fr|france24\.com|tf1info\.fr|lci\.fr|bfmtv\.com|radiofrance\.fr|franceinfo\.fr|ouest-france\.fr|la-croix\.com|mediapart\.fr|courrierinternational\.com|nytimes\.com|washingtonpost\.com|wsj\.com|theguardian\.com|economist\.com|bloomberg\.com|ft\.com|cnn\.com|nbcnews\.com|cbsnews\.com|abcnews\.go\.com|npr\.org|politico\.(com|eu)|axios\.com|spiegel\.de|zeit\.de|elpais\.com|corriere\.it|aljazeera\.com|theverge\.com|techcrunch\.com|arstechnica\.com|wired\.com|nationalgeographic\.com|scientificamerican\.com)/i;

const MEDIUM_TRUST_TLD = /\.(gov|edu|gouv\.fr|gc\.ca|gov\.uk)$/i;
const LOW_TRUST = /(blogspot|wordpress\.com|tumblr|over-blog)/i;
const SOCIAL = /(facebook|instagram|tiktok|pinterest)\./i;
// Réseaux à contenu variable : ni whitelisté, ni blacklisté (souvent du primaire utile).
const MIXED = /(reddit\.com|medium\.com|substack\.com|x\.com|twitter\.com|youtube\.com)/i;

function domainAuthority(url = "") {
  if (!url) return 40;
  if (OFFICIAL_PRIMARY.test(url)) return 96; // source de 1ʳᵉ main sur son propre produit
  if (HIGH_TRUST.test(url)) return 95;
  if (NEWS_TRUST.test(url)) return 85;
  if (MEDIUM_TRUST_TLD.test(url)) return 88;
  if (SOCIAL.test(url)) return 25;
  if (MIXED.test(url)) return 55;
  if (LOW_TRUST.test(url)) return 50;
  // Domaine .com/.fr classique non identifié : neutre-positif, pas suspect.
  return 68;
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
    const cs = cluster.sourceIds || cluster.sources || [];
    if (cs.includes(sourceId)) {
      total += 1;
      if (cluster.confidence === "high" || cs.length >= 2) {
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

// Score global pondéré [0-100] + multiplicateur de type de contenu
export function scoreSource(source, graph, customWeights = null) {
  const weights = customWeights || { authority: 0.35, freshness: 0.15, coherence: 0.35, citations: 0.15 };
  const dims = {
    authority: domainAuthority(source.url),
    freshness: freshnessScore(source),
    coherence: coherenceScore(source, graph),
    citations: citationScore(source)
  };
  const base =
    weights.authority * dims.authority +
    weights.freshness * dims.freshness +
    weights.coherence * dims.coherence +
    weights.citations * dims.citations;

  // Multiplicateur de type (benchmark 1.3, paper 1.2, doc 1.0, blog 0.8, reddit 0.5…)
  const typeMult = source.contentType?.multiplier ?? 1.0;
  let total = Math.min(100, base * typeMult);

  // Plancher : une source PRIMAIRE officielle (l'éditeur sur son propre produit)
  // ne doit jamais passer pour douteuse, même sans citations externes ni date.
  if (OFFICIAL_PRIMARY.test(source.url || "")) total = Math.max(total, 85);

  return {
    score: Math.round(total),
    breakdown: { ...dims, typeMultiplier: typeMult, type: source.contentType?.type || "unknown" },
    tier: total >= 75 ? "high" : total >= 50 ? "medium" : "low"
  };
}

// Applique scoreSource à toutes les sources et trie par score descendant.
export function scoreAllSources(sources, graph, customWeights = null) {
  return sources.map((s) => ({ ...s, scoring: scoreSource(s, graph, customWeights) }))
    .sort((a, b) => b.scoring.score - a.scoring.score);
}
