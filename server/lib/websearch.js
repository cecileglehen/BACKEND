// Décide si une recherche web est nécessaire, formule la requête, exécute Serper.
import { serperSearch, formatSearchContext } from "./serper.js";

// Mots-clés explicites : déclenchent toujours une recherche
const EXPLICIT_TRIGGERS = [
  /\b(cherche|recherche|googl[ie])\s+(sur\s+(le\s+)?web|sur\s+internet|en\s+ligne)?/i,
  /\bfais\s+une\s+(recherche|search)/i,
  /\bweb\s*search\b/i,
  /\b(sur|via|avec)\s+(google|internet|le\s+web)/i,
  /\b(quoi\s+de\s+neuf|qu'est[- ]ce\s+qui\s+s'est\s+passé)/i,
  /\b(aujourd['']hui|maintenant|en\s+ce\s+moment|cette\s+semaine)\b/i,
];

// Indices forts : sujets potentiellement récents → search recommandée
const RECENT_TOPIC_HINTS = [
  /\b(actualité|news|info(rmation)?s?)\b/i,
  /\b(prix|cours|valeur|cotation)\b.{0,40}\b(action|bourse|crypto|btc|eth)\b/i,
  /\b(météo|temps qu['']il fait)\b/i,
  /\b(score|résultat|match)\b/i,
  /\b(sortie|date de sortie|release)\b/i,
  /\b(20(2[4-9]|[3-9]\d))\b/, // années 2024+
];

/**
 * Décision rapide via heuristiques (sans appel LLM).
 * Retourne { needsSearch: bool, reason: string }
 */
export function shouldSearchHeuristic(userMessage) {
  const text = String(userMessage || "");
  for (const r of EXPLICIT_TRIGGERS) {
    if (r.test(text)) return { needsSearch: true, reason: "explicit" };
  }
  for (const r of RECENT_TOPIC_HINTS) {
    if (r.test(text)) return { needsSearch: true, reason: "recent_topic" };
  }
  return { needsSearch: false, reason: "no_trigger" };
}

/**
 * Optimise la requête de recherche.
 * Heuristique simple : nettoyage + on garde les 12 mots les plus significatifs.
 */
export function optimizeQuery(userMessage) {
  let q = String(userMessage || "").trim();
  // Retire les déclencheurs explicites pour ne pas polluer la requête
  q = q.replace(/^\s*(cherche|recherche|googl[ie])\s+(sur\s+(le\s+)?web|sur\s+internet|en\s+ligne)?\s*:?\s*/i, "");
  q = q.replace(/^\s*(fais\s+une\s+(recherche|search)\s+(sur|pour)?)\s*:?\s*/i, "");
  q = q.replace(/^\s*(peux[- ]tu\s+|stp\s+|s['']il\s+te\s+plait\s+)/i, "");
  // Limite à 200 chars
  return q.slice(0, 200).trim();
}

/**
 * Exécute la recherche web et renvoie le contexte formaté + les résultats bruts.
 * @returns {Promise<{contextText, results, query} | null>}
 */
export async function performWebSearch(userMessage) {
  const query = optimizeQuery(userMessage);
  if (!query) return null;
  try {
    const data = await serperSearch(query, { num: 8 });
    return {
      query,
      results: data.results,
      contextText: formatSearchContext(data)
    };
  } catch (e) {
    console.warn("[websearch] échec :", e.message);
    return null;
  }
}

/**
 * System prompt à injecter quand une recherche web a été effectuée.
 * Demande au modèle d'utiliser les résultats, de citer, et de rester factuel.
 */
export function buildSearchSystemPrompt(contextText) {
  return [
    "Tu es un assistant qui répond avec des informations à jour issues d'une recherche web Google.",
    "",
    "RÈGLES STRICTES :",
    "1. Utilise UNIQUEMENT les résultats de recherche ci-dessous pour répondre aux faits récents, dates, chiffres, événements.",
    "2. Cite tes sources entre crochets : [1], [2], etc. correspondant aux résultats numérotés.",
    "3. Si l'info n'est pas dans les résultats, dis-le clairement plutôt que d'inventer.",
    "4. Sois concis, structuré (titres / listes si pertinent), factuel.",
    "5. À la fin, liste les sources utilisées sous la forme :",
    "   **Sources :**",
    "   - [1] Titre — URL",
    "   - [2] Titre — URL",
    "",
    contextText,
    "",
    "Réponds maintenant à la question de l'utilisateur en utilisant ces résultats."
  ].join("\n");
}
