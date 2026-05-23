// Détecte si un sujet est "fast-moving" (la fraîcheur est critique) :
//   LLM/IA récents · benchmarks · prix marché · actu · crypto · sport
// Permet d'augmenter le poids freshness de 15% → 35% dans le scoring.

const FAST_MOVING_KEYWORDS = [
  // IA / LLM
  /\b(gpt-?[0-9]|claude|gemini|llama|mistral|qwen|deepseek|grok|llm|modèle|model|benchmark|mmlu|humaneval|gsm8k|chatbot|génératif|generative|fine-?tun|prompt|rag|embedding)\b/i,
  // Tech / produits
  /\b(release|version|sortie|nouveau|nouvelle|dernier|dernière|récent|2026|2025|latest|update)\b/i,
  // Marché / finance
  /\b(prix|cours|bourse|crypto|bitcoin|btc|eth|ethereum|action|stock|nasdaq|s&?p)\b/i,
  // Actu
  /\b(actu|breaking|news|élection|guerre|crise|annonce|conférence)\b/i,
  // Sport / live
  /\b(match|score|résultat|championnat|coupe|finale|live)\b/i
];

const SLOW_MOVING_KEYWORDS = [
  // Histoire, philosophie, math pures
  /\b(histoire|historique|guerre mondiale|moyen âge|renaissance|antique|antiquité)\b/i,
  /\b(théorème|équation|démonstration|axiome|géométrie|algèbre)\b/i,
  /\b(philosophie|éthique|métaphysique|épistémologie)\b/i
];

export function detectTopicVelocity(question) {
  const q = String(question || "");
  let fastHits = 0;
  let slowHits = 0;
  for (const re of FAST_MOVING_KEYWORDS) if (re.test(q)) fastHits += 1;
  for (const re of SLOW_MOVING_KEYWORDS) if (re.test(q)) slowHits += 1;

  if (fastHits >= 2 && fastHits > slowHits) return "fast";
  if (slowHits >= 2 && slowHits > fastHits) return "slow";
  if (fastHits > 0) return "fast";
  return "normal";
}

// Retourne les pondérations à utiliser pour le scoring source selon la vélocité.
export function weightsForTopic(velocity) {
  if (velocity === "fast") {
    // La fraîcheur devient critique, on baisse les citations qui sont moins
    // déterminantes sur un sujet récent.
    return { authority: 0.30, freshness: 0.35, coherence: 0.30, citations: 0.05 };
  }
  if (velocity === "slow") {
    // Sujet stable : autorité + citations dominent, freshness peu utile.
    return { authority: 0.40, freshness: 0.05, coherence: 0.30, citations: 0.25 };
  }
  return { authority: 0.35, freshness: 0.15, coherence: 0.35, citations: 0.15 };
}
