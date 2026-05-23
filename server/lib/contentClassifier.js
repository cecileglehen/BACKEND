// Classifie le type d'une page scrapée :
//   benchmark · paper · doc · news · blog · forum · reddit · social · unknown
// Pondération utilisée par le scoring source + l'éligibilité claim.

const TYPE_WEIGHTS = {
  benchmark: 1.3,  // résultats chiffrés, comparatifs vérifiables
  paper:     1.2,  // recherche académique
  doc:       1.0,  // documentation officielle
  news:      1.0,  // presse de qualité
  blog:      0.8,  // articles personnels
  forum:     0.6,  // Stack Overflow, GitHub issues
  reddit:    0.5,  // discussions communautaires
  social:    0.3,  // X / Twitter / Facebook
  unknown:   0.7
};

const URL_PATTERNS = [
  [/(reddit\.com|news\.ycombinator|hackernoon)/i,              "reddit"],
  [/(facebook|instagram|tiktok|x\.com|twitter\.com|pinterest)/i,"social"],
  [/(stackoverflow|stackexchange|github\.com\/[^/]+\/[^/]+\/issues)/i, "forum"],
  [/(arxiv\.org|nature\.com|sciencedirect|pubmed|ieeexplore|acm\.org|sciencemag|cell\.com|plos\.org|frontiersin)/i, "paper"],
  [/(docs?\.|documentation|api\.|developer\.|spec\.|readthedocs|wiki\.|wikipedia\.org)/i, "doc"],
  [/(reuters\.com|apnews|bbc\.co\.uk|nytimes|lemonde\.fr|theverge|techcrunch|wired|arstechnica|engadget|leparisien|liberation)/i, "news"],
  [/(benchmark|leaderboard|paperswithcode|huggingface\.co\/spaces|artificial-analysis|lmsys|openrouter\.ai\/rankings|chat\.lmsys\.org)/i, "benchmark"],
  [/(blog|medium\.com|substack|hashnode|dev\.to|wordpress|blogspot)/i, "blog"]
];

const CONTENT_HINTS = [
  // Benchmarks : tables de chiffres, scores
  { type: "benchmark", test: (text) => /(\bmmlu\b|\bhumaneval\b|\bgsm8k\b|\bbenchmark\b.*\d|\bppl\b|\btok\/s\b|leaderboard|elo\s*rating)/i.test(text) },
  { type: "paper",     test: (text) => /\babstract\b\s*[:\n]|doi:\s*10\.|arxiv:\s*\d/i.test(text) },
  { type: "doc",       test: (text) => /\bapi reference\b|\bcli reference\b|\bgetting started\b|\binstall\b.{0,40}\bnpm\b|usage:\s*\n/i.test(text) }
];

export function classifyContent({ url, text }) {
  const u = String(url || "");
  for (const [pattern, type] of URL_PATTERNS) {
    if (pattern.test(u)) return { type, multiplier: TYPE_WEIGHTS[type] };
  }
  const sample = String(text || "").slice(0, 4000);
  for (const hint of CONTENT_HINTS) {
    if (hint.test(sample)) return { type: hint.type, multiplier: TYPE_WEIGHTS[hint.type] };
  }
  return { type: "unknown", multiplier: TYPE_WEIGHTS.unknown };
}

export { TYPE_WEIGHTS };
