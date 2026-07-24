import { serperSearch } from "./serper.js";
import { chatWithFallback } from "./openrouter.js";
import { getDb } from "./db.js";
import { TIER_MODELS, computeCreditFromCost } from "../config/plans.js";
import { embedOne, chunkAndScore, clusterChunks } from "./embeddings.js";
import { llmRerank } from "./llmRerank.js";
import { scoreAllSources } from "./sourceScoring.js";
import { scoreAllClaims, reportConfidence } from "./claimScoring.js";
import { classifyContent } from "./contentClassifier.js";
import { detectTopicVelocity, weightsForTopic } from "./topicDetector.js";
import { pageCache, searchCache } from "./pageCache.js";

// ─── Modèles par étape ────────────────────────────────────────────────────────
// PLAN/CLUSTER : raisonnement structuré → MINI
// EXTRACT      : extraction parallèle massive → PICO/NANO (10x moins cher)
// SYNTH        : qualité finale → NORMAL
const MODEL_PLAN    = TIER_MODELS.MINI?.id    || "openai/gpt-5.4-mini";
const MODEL_EXTRACT = TIER_MODELS.PICO?.id    || TIER_MODELS.NANO?.id || "google/gemini-2.5-flash-lite";
// Synthèse : on évite les reasoning models (gpt-5.x) qui peuvent prendre plusieurs minutes.
// Claude Sonnet 5 = même tier NORMAL, qualité équivalente, latence ~5-15s.
const MODEL_SYNTH   = "anthropic/claude-sonnet-5";

const PAGE_CHAR_LIMIT = 12000;
const SCRAPE_CONCURRENCY = 8;
const EXTRACT_CONCURRENCY = 6;
const MAX_QUERIES = 10;
const MAX_PAGES_DEFAULT = 12;
const JINA_FALLBACK = "https://r.jina.ai/";

const STAGES = [
  "Décomposition de la question",
  "Recherche web",
  "Lecture des sources",
  "Sélection des passages clés",
  "Filtrage des doublons",
  "Tri par pertinence",
  "Extraction des faits",
  // ↓ étapes agentiques dynamiques insérées ici (Réflexion N / Recherche ciblée N)
  "Évaluation de fiabilité",
  "Synthèse finale"
];

// Petits utilitaires de domaine
const HIGH_TRUST_TLDS = /\.(gov|edu|gouv\.fr|europa\.eu)$/i;
// Domaines officiels d'éditeurs = source primaire de leur propre produit → fiabilité max.
const OFFICIAL_PRIMARY_HOSTS = /(openai\.com|anthropic\.com|deepmind\.google|blog\.google|googleblog\.com|ai\.google|cloud\.google\.com|mistral\.ai|x\.ai|meta\.ai|ai\.meta\.com|llama\.com|microsoft\.com|nvidia\.com|huggingface\.co|cohere\.com|stability\.ai|perplexity\.ai)/i;
const HIGH_TRUST_HOSTS = /(wikipedia\.org|nature\.com|sciencedirect\.com|arxiv\.org|reuters\.com|apnews\.com|afp\.com|insee\.fr|oecd\.org|who\.int|un\.org)/i;
// Grande presse établie : rédaction professionnelle → fiabilité haute par défaut.
const NEWS_TRUST_HOSTS = /(lemonde\.fr|lefigaro\.fr|liberation\.fr|lesechos\.fr|leparisien\.fr|francetvinfo\.fr|franceinfo\.fr|france24\.com|tf1info\.fr|lci\.fr|bfmtv\.com|radiofrance\.fr|ouest-france\.fr|mediapart\.fr|nytimes\.com|washingtonpost\.com|wsj\.com|theguardian\.com|economist\.com|bloomberg\.com|ft\.com|cnn\.com|nbcnews\.com|cbsnews\.com|abcnews\.go\.com|npr\.org|politico\.(com|eu)|spiegel\.de|elpais\.com|aljazeera\.com|theverge\.com|techcrunch\.com|arstechnica\.com|wired\.com)/i;
const SOCIAL_NOISE = /(google|bing|duckduckgo|facebook|instagram|tiktok|pinterest|x\.com|twitter\.com)\./i;

export async function runDeepSearch({ userId, prompt, maxSources = MAX_PAGES_DEFAULT, language = "fr", signal, onEvent }) {
  const question = String(prompt || "").trim().slice(0, 12000);
  if (!question) throw new Error("prompt requis");

  const emit = (event) => { try { onEvent?.(event); } catch { /* ignore */ } };

  const usage = [];
  const steps = STAGES.map((label) => ({ label, status: "pending" }));
  const start = (label) => {
    mark(steps, label, { status: "running" });
    emit({ type: "step", label, status: "running" });
  };
  const done = (label, data = {}) => {
    mark(steps, label, { status: "done", ...data });
    emit({ type: "step", label, status: "done", ...data });
  };

  emit({ type: "init", stages: STAGES });

  // ─── 1. PLAN ──────────────────────────────────────────────────────────────
  start("Décomposition de la question");
  const plan = await runPlan({ question, language, signal, usage });
  done("Décomposition de la question", { queries: plan.queries.length, subQuestions: plan.subQuestions.length });

  // ─── 2. SEARCH (parallèle) ────────────────────────────────────────────────
  start("Recherche web");
  const searchBatches = await Promise.all(
    plan.queries.slice(0, MAX_QUERIES).map((q) =>
      serperSearch(q.text, {
        num: 6,
        lang: q.lang || language,
        country: (q.lang || language) === "fr" ? "fr" : "us"
      }).catch(() => ({ results: [] }))
    )
  );
  const ranked = rankResults(
    searchBatches.flatMap((b) => b.results || []),
    Math.max(3, Math.min(20, Number(maxSources) || MAX_PAGES_DEFAULT))
  );
  done("Recherche web", { results: ranked.length });

  // ─── 3. SCRAPE (parallèle + fallback Jina) ────────────────────────────────
  start("Lecture des sources");
  const pages = (await mapLimit(ranked, SCRAPE_CONCURRENCY, async (r) => {
    const page = await scrapeWithFallback(r);
    return page;
  })).filter(Boolean);
  done("Lecture des sources", { pages: pages.length });

  // ─── 4. EMBEDDING & GLOBAL RANKING ────────────────────────────────────────
  // Au lieu de top-K par page (info-clé en position 6 perdue), on fait un
  // ranking GLOBAL : tous les chunks de toutes les pages → top 50 globaux.
  start("Sélection des passages clés");
  let questionEmbedding = null;
  try { questionEmbedding = await embedOne(question, signal); }
  catch (e) { console.warn("[deepsearch] question embedding fail:", e.message); }

  let allChunks = [];
  if (questionEmbedding) {
    const batches = await mapLimit(pages, EXTRACT_CONCURRENCY, (page, i) =>
      chunkAndScore({
        pageText: page.text || page.content || "",
        sourceId: i + 1,
        sourceUrl: page.url,
        sourceTitle: page.title,
        questionEmbedding,
        signal
      }).catch(() => [])
    );
    allChunks = batches.flat()
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // top 50 globaux
  }
  done("Sélection des passages clés", { totalChunks: allChunks.length, bestScore: allChunks[0]?.score?.toFixed(2) });

  // ─── 5. CLUSTERING (anti-duplication) ─────────────────────────────────────
  start("Filtrage des doublons");
  const clustered = clusterChunks(allChunks, 0.86);
  const dedupedCount = allChunks.length - clustered.length;
  done("Filtrage des doublons", { kept: clustered.length, duplicates: dedupedCount });

  // ─── 6. LLM RE-RANK (top 50 → top 15) ─────────────────────────────────────
  start("Tri par pertinence");
  const reranked = await llmRerank({
    question,
    chunks: clustered,
    signal,
    keepCount: 15,
    minScore: 5
  });
  done("Tri par pertinence", { kept: reranked.length, topScore: reranked[0]?.llmScore ?? null });

  // Regroupe les chunks survivants par source pour l'extraction
  const chunksBySource = new Map();
  for (const c of reranked) {
    if (!chunksBySource.has(c.sourceId)) chunksBySource.set(c.sourceId, []);
    chunksBySource.get(c.sourceId).push(c);
  }
  const focusedPages = [];
  for (const [sourceId, chunks] of chunksBySource.entries()) {
    const original = pages[sourceId - 1];
    if (!original) continue;
    const focused = chunks
      .map((c, i) => `[Extrait ${i + 1} · pertinence ${c.llmScore}/10]\n${c.text}`)
      .join("\n\n---\n\n");
    focusedPages.push({ ...original, text: focused, _chunks: chunks });
  }

  // ─── 7. EXTRACT CLAIMS ────────────────────────────────────────────────────
  start("Extraction des faits");
  const extracted = await mapLimit(focusedPages, EXTRACT_CONCURRENCY, (page) =>
    extractClaims({ question, page, language, signal, usage, subQuestions: plan.subQuestions })
      .catch(() => null)
  );
  let sources = extracted
    .filter((x) => x && (x.claims?.length || x.summary))
    .map((x, i) => ({ sourceId: i + 1, ...x }));
  done("Extraction des faits", { sources: sources.length, claims: sources.reduce((n, s) => n + (s.claims?.length || 0), 0) });
  emit({
    type: "sources",
    sources: sources.map((s) => ({ index: s.sourceId, title: s.title, url: s.url, reliability: s.reliability, summary: s.summary }))
  });

  // ─── 8. RECHERCHE AGENTIQUE (réflexion → recherche → réflexion → …) ───────
  // L'IA ne suit plus un pipeline figé. Elle examine ce qu'elle a déjà trouvé,
  // identifie ce qui manque vraiment, décide ELLE-MÊME les prochaines recherches,
  // les lance, ré-examine, et recommence — jusqu'à se juger satisfaite (ou
  // plafond d'itérations). Chaque réflexion est diffusée en SSE pour rendre le
  // raisonnement visible côté UI (étapes dynamiques "Réflexion N" / "Recherche N").
  const scrapedHosts = new Set(sources.map((s) => safeHost(s.url)).filter(Boolean));
  let sourceSeq = sources.length;

  // Pipeline réutilisable : queries → scrape → chunk/rank → extract → nouvelles sources
  const harvest = async (queries, tag) => {
    const clean = queries
      .map((q) => (typeof q === "string" ? q : q?.text || ""))
      .map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
    if (!clean.length) return [];
    const batches = await Promise.all(clean.map((q) =>
      serperSearch(q, { num: 4, lang: language, country: language === "fr" ? "fr" : "us" }).catch(() => ({ results: [] }))
    ));
    const newRanked = rankResults(batches.flatMap((b) => b.results || []), 8)
      .filter((r) => !scrapedHosts.has(safeHost(r.url))); // force du sang neuf
    if (!newRanked.length) return [];
    const newPages = (await mapLimit(newRanked, SCRAPE_CONCURRENCY, scrapeWithFallback)).filter(Boolean);
    if (!newPages.length || !questionEmbedding) return [];
    for (const p of newPages) { const h = safeHost(p.url); if (h) scrapedHosts.add(h); }
    const chunkBatches = await mapLimit(newPages, EXTRACT_CONCURRENCY, (page, i) =>
      chunkAndScore({ pageText: page.text || "", sourceId: 5000 + i, sourceUrl: page.url, sourceTitle: page.title, questionEmbedding, signal }).catch(() => [])
    );
    const topChunks = chunkBatches.flat().sort((a, b) => b.score - a.score).slice(0, 18);
    const reranked = await llmRerank({ question, chunks: topChunks, signal, keepCount: 8, minScore: 6 });
    const grouped = new Map();
    for (const c of reranked) { if (!grouped.has(c.sourceId)) grouped.set(c.sourceId, []); grouped.get(c.sourceId).push(c); }
    const added = [];
    for (const [sid, chunks] of grouped.entries()) {
      const original = newPages[sid - 5000];
      if (!original) continue;
      const focused = chunks.map((c) => `[${tag} · pertinence ${c.llmScore}/10]\n${c.text}`).join("\n\n");
      const ext = await extractClaims({ question, page: { ...original, text: focused }, language, signal, usage, subQuestions: plan.subQuestions }).catch(() => null);
      if (ext && (ext.claims?.length || ext.summary)) { sourceSeq += 1; added.push({ sourceId: sourceSeq, ...ext, _agentic: true }); }
    }
    return added;
  };

  // Graphe initial (vue de l'état avant la 1ʳᵉ réflexion).
  let graph = await crossReference({ question, subQuestions: plan.subQuestions, sources, language, signal, usage });

  const MAX_ITER = 4;
  for (let iteration = 1; iteration <= MAX_ITER; iteration++) {
    const conf = reportConfidence(sources, graph);

    // ── L'IA RÉFLÉCHIT : qu'a-t-on, que manque-t-il, faut-il continuer ? ──
    const reflLabel = `Réflexion ${iteration}`;
    start(reflLabel);
    const decision = await reflectNextStep({ question, plan, sources, graph, confidence: conf, iteration, maxIter: MAX_ITER, language, signal, usage });
    emit({ type: "reflection", iteration, confidence: conf, thought: decision.reasoning, queries: decision.queries, enough: decision.enough });
    done(reflLabel, { note: decision.reasoning?.slice(0, 160), confidence: conf.toFixed(2) });

    if (decision.enough || !decision.queries.length) {
      emit({ type: "reflection_stop", iteration, reason: decision.enough ? "assez d'éléments" : "plus de piste utile" });
      break;
    }

    // ── L'IA AGIT : les recherches qu'elle a elle-même décidées ──
    const searchLabel = `Recherche ciblée ${iteration}`;
    start(searchLabel);
    const added = await harvest(decision.queries, `Iter${iteration}`);
    for (const s of added) sources.push(s);
    done(searchLabel, { queries: decision.queries.length, newSources: added.length });

    if (!added.length) break; // rien de neuf → inutile de continuer à boucler
    graph = await crossReference({ question, subQuestions: plan.subQuestions, sources, language, signal, usage });
  }
  emit({ type: "sources", sources: sources.map((s) => ({ index: s.sourceId, title: s.title, url: s.url, reliability: s.reliability, summary: s.summary })) });

  // ─── 10. SCORING SOURCES + CLAIMS (temporal-aware) ───────────────────────
  start("Évaluation de fiabilité");
  const velocity = detectTopicVelocity(question);
  const weights = weightsForTopic(velocity);
  sources = scoreAllSources(sources, graph, weights);
  sources = scoreAllClaims(sources, graph);
  const finalConfidence = reportConfidence(sources, graph);
  done("Évaluation de fiabilité", {
    avg: Math.round(sources.reduce((n, s) => n + (s.scoring?.score || 0), 0) / Math.max(sources.length, 1)),
    high: sources.filter((s) => s.scoring?.tier === "high").length,
    low: sources.filter((s) => s.scoring?.tier === "low").length,
    confidence: finalConfidence.toFixed(2),
    agenticSources: sources.filter((s) => s._agentic).length,
    velocity,
    freshnessWeight: weights.freshness
  });

  // ─── 10b. REASONING GRAPH (visible) ──────────────────────────────────────
  // Construit une représentation explicite "claim → sources" pour l'UI.
  // Émis en SSE pour que le frontend puisse afficher comment ça pense.
  const reasoningGraph = buildReasoningGraph(sources, graph);
  emit({ type: "reasoning_graph", graph: reasoningGraph, confidence: finalConfidence, velocity });

  // ─── 11. SYNTHÈSE PONDÉRÉE (les claims des sources mieux scorées pèsent +) ─
  start("Synthèse finale");
  const synthesis = await synthesize({ question, plan, sources, graph, language, signal, usage, reasoningGraph, velocity, confidence: finalConfidence });
  done("Synthèse finale");

  // ─── Totals & report ──────────────────────────────────────────────────────
  const totals = usage.reduce((acc, u) => ({
    tokensIn:  acc.tokensIn  + (u.tokensIn  || 0),
    tokensOut: acc.tokensOut + (u.tokensOut || 0),
    costUsd:   acc.costUsd   + (u.costUsd   || 0)
  }), { tokensIn: 0, tokensOut: 0, costUsd: 0 });

  const creditCost = computeCreditFromCost({
    costUsd: totals.costUsd,
    modelId: MODEL_SYNTH,
    tokensIn: totals.tokensIn,
    tokensOut: totals.tokensOut
  });

  const exposedSources = sources.map((s) => ({
    index: s.sourceId,
    title: s.title,
    url: s.url,
    reliability: s.reliability,
    summary: s.summary
  }));

  const report = {
    answer: synthesis.answer,
    sources: exposedSources,
    steps,
    plan: { subQuestions: plan.subQuestions, queries: plan.queries.map((q) => q.text), comparisonCriteria: plan.comparisonCriteria, mustVerify: plan.mustVerify },
    graph: { clusters: graph.clusters, contradictions: graph.contradictions, gaps: graph.gaps },
    tokensIn:  totals.tokensIn,
    tokensOut: totals.tokensOut,
    costUsd:   totals.costUsd,
    creditCost
  };

  await saveDeepSearchReport(userId, question, report).catch((e) => {
    console.warn("[deep-search] report save skipped:", e.message);
  });

  return report;
}

// ─── 1. PLAN ────────────────────────────────────────────────────────────────
async function runPlan({ question, language, signal, usage }) {
  const result = await modelJson({
    modelId: MODEL_PLAN,
    signal,
    messages: [
      {
        role: "system",
        content: [
          "Tu es planificateur de recherche web pour DELT Deep Search.",
          "Décompose la question en 3-5 sous-questions distinctes et orthogonales.",
          "Pour chaque sous-question, propose 1 à 2 requêtes web précises et vérifiables.",
          "Inclus quelques requêtes en anglais si la question est technique/internationale.",
          "Réponds uniquement en JSON valide, sans Markdown."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question utilisateur: ${question}`,
          `Langue de réponse principale: ${language}`,
          "JSON attendu:",
          "{",
          '  "subQuestions": [{"id":"s1","text":"..."}, ...],',
          '  "queries": [{"text":"...", "lang":"fr|en", "subId":"s1"}, ...],',
          '  "comparisonCriteria": ["critères de comparaison utiles"],',
          '  "mustVerify": ["informations indispensables à vérifier"]',
          "}"
        ].join("\n")
      }
    ]
  });
  usage.push(result.usage);
  return sanitizePlan(result.json, question);
}

function sanitizePlan(plan, question) {
  const subQuestions = Array.isArray(plan?.subQuestions)
    ? plan.subQuestions.map((s, i) => ({
        id: String(s?.id || `s${i + 1}`).slice(0, 12),
        text: String(s?.text || "").trim()
      })).filter((s) => s.text).slice(0, 6)
    : [];

  const queries = Array.isArray(plan?.queries)
    ? plan.queries.map((q) => ({
        text: String(q?.text || q || "").trim(),
        lang: /^en$/i.test(String(q?.lang || "")) ? "en" : "fr",
        subId: String(q?.subId || "").slice(0, 12)
      })).filter((q) => q.text).slice(0, MAX_QUERIES)
    : [];

  return {
    subQuestions: subQuestions.length ? subQuestions : [{ id: "s1", text: question }],
    queries: queries.length ? queries : [{ text: question, lang: "fr", subId: "s1" }],
    comparisonCriteria: arrayOfStrings(plan?.comparisonCriteria),
    mustVerify: arrayOfStrings(plan?.mustVerify)
  };
}

// ─── RÉFLEXION AGENTIQUE ────────────────────────────────────────────────────
// Le « cerveau » de la boucle : reçoit l'état de la recherche et décide, comme
// un journaliste d'investigation, s'il faut continuer et QUOI chercher ensuite.
async function reflectNextStep({ question, plan, sources, graph, confidence, iteration, maxIter, language, signal, usage }) {
  const consensus = (graph?.clusters || []).filter((c) => c.confidence === "high")
    .slice(0, 8).map((c) => c.statement || c.repr).filter(Boolean);
  const contradictions = (graph?.contradictions || []).slice(0, 6)
    .map((c) => c.note || c.statement || c).filter(Boolean);
  const gaps = (graph?.gaps || []).slice(0, 6)
    .map((g) => (typeof g === "string" ? g : g.text || g.question || "")).filter(Boolean);
  const covered = new Set((graph?.clusters || []).flatMap((c) => c.subIds || []));
  const subQuestions = (plan?.subQuestions || []).map((s) => ({ id: s.id, text: s.text, covered: covered.has(s.id) }));
  const hosts = [...new Set(sources.map((s) => safeHost(s.url)).filter(Boolean))].slice(0, 20);

  let result;
  try {
    result = await modelJson({
      modelId: MODEL_PLAN,
      signal,
      messages: [
        { role: "system", content: [
          "Tu es le CERVEAU d'une recherche web agentique (DELT Deep Search).",
          "On te donne l'état de la recherche EN COURS. Ton job : décider, comme un journaliste d'investigation, s'il faut CONTINUER à chercher et QUOI chercher.",
          "Raisonne par manque RÉEL : quelle info précise manque pour répondre complètement, avec des faits vérifiés et chiffrés ?",
          "Règles :",
          "- Si les sous-questions clés sont couvertes par un consensus de sources crédibles → enough=true, queries=[].",
          "- Sinon propose 1 à 3 requêtes web NOUVELLES et précises (entités, dates, chiffres, angles non couverts) — PAS des reformulations de l'existant.",
          "- Priorise : trancher les contradictions, combler les gaps. Mixe FR/EN si utile.",
          `- Itération ${iteration}/${maxIter} : à la dernière, arrête-toi si l'essentiel est là.`,
          "- Ne sois pas obsessionnel : 2-3 sources crédibles convergentes suffisent pour établir un fait, n'exige pas 10 confirmations.",
          "Réponds en JSON strict, sans Markdown."
        ].join("\n") },
        { role: "user", content: [
          `Question: ${question}`,
          `Confiance actuelle: ${(confidence ?? 0).toFixed(2)} (0-1)`,
          `Sources déjà lues (${sources.length}) — hôtes: ${JSON.stringify(hosts)}`,
          `Sous-questions (covered=déjà répondue): ${JSON.stringify(subQuestions)}`,
          `Consensus établi: ${JSON.stringify(consensus)}`,
          `Contradictions à trancher: ${JSON.stringify(contradictions)}`,
          `Gaps non couverts: ${JSON.stringify(gaps)}`,
          "",
          "JSON attendu:",
          '{ "reasoning": "1-2 phrases: ce qui est solide, ce qui manque", "enough": true|false, "queries": ["requête précise 1", "requête 2"] }'
        ].join("\n") }
      ]
    });
    usage.push(result.usage);
  } catch (e) {
    console.warn("[deepsearch] reflect fail:", e.message);
    return { reasoning: "Réflexion indisponible, arrêt prudent.", enough: true, queries: [] };
  }

  const json = result.json || {};
  const queries = Array.isArray(json.queries)
    ? json.queries.map((q) => String(q || "").trim()).filter(Boolean).slice(0, 3)
    : [];
  const enough = json.enough === true || queries.length === 0;
  return {
    reasoning: String(json.reasoning || "").slice(0, 400),
    enough,
    queries: enough ? [] : queries
  };
}

// ─── 2. RANKING ─────────────────────────────────────────────────────────────
function rankResults(results, limit) {
  const seen = new Map(); // url normalisée → meilleur résultat
  for (const r of results) {
    const url = normalizeUrl(r.url);
    if (!url || !looksUseful(url)) continue;
    const cur = seen.get(url);
    if (!cur || scoreResult(r) > scoreResult(cur)) seen.set(url, { ...r, url });
  }

  // Diversité par domaine : max 2 par host
  const byHost = new Map();
  const sorted = [...seen.values()].sort((a, b) => scoreResult(b) - scoreResult(a));
  const out = [];
  for (const r of sorted) {
    const host = safeHost(r.url);
    const count = byHost.get(host) || 0;
    if (count >= 2) continue;
    byHost.set(host, count + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

function scoreResult(r) {
  let s = 0;
  const host = safeHost(r.url);
  if (HIGH_TRUST_HOSTS.test(host)) s += 3;
  if (HIGH_TRUST_TLDS.test(host)) s += 2;
  if (r.date && /20(2[3-9]|[3-9]\d)/.test(String(r.date))) s += 1;
  if (r.position && r.position <= 5) s += 1;
  if ((r.snippet || "").length > 80) s += 0.5;
  return s;
}

function safeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function looksUseful(url) {
  const host = safeHost(url);
  if (!host) return false;
  return !SOCIAL_NOISE.test(host);
}

function normalizeUrl(url) {
  try {
    const u = new URL(String(url || ""));
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$)/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

// ─── 3. SCRAPE ──────────────────────────────────────────────────────────────
async function scrapeWithFallback(result) {
  const cacheKey = result.url;
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;

  const tagAndCache = (page) => {
    page.contentType = classifyContent({ url: page.url, text: page.text });
    pageCache.set(cacheKey, page);
    return page;
  };

  const page = await scrapePage(result).catch(() => null);
  if (page && (page.text || "").length >= 400) return tagAndCache(page);
  // Fallback Jina Reader pour pages JS/paywall
  const jina = await scrapeJina(result).catch(() => null);
  if (jina && (jina.text || "").length >= 400) return tagAndCache(jina);
  // Dernier recours : snippet uniquement
  if (result.snippet) {
    return tagAndCache({ url: result.url, title: result.title || result.url, text: result.snippet, snippet: result.snippet });
  }
  return null;
}

async function scrapePage(result) {
  const res = await fetch(result.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DELTDeepSearch/1.0; +https://delt.ai)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const title = decodeHtml(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || result.title || result.url);
  const text = htmlToText(body).slice(0, PAGE_CHAR_LIMIT);
  return { url: result.url, title: title.trim(), text, snippet: result.snippet || "" };
}

async function scrapeJina(result) {
  const res = await fetch(JINA_FALLBACK + result.url, {
    headers: { Accept: "text/plain", "User-Agent": "DELTDeepSearch/1.0" },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const text = (await res.text()).slice(0, PAGE_CHAR_LIMIT);
  return { url: result.url, title: result.title || result.url, text, snippet: result.snippet || "" };
}

function htmlToText(html) {
  return decodeHtml(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<(br|p|div|section|article|li|tr|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// ─── 4. EXTRACT CLAIMS ──────────────────────────────────────────────────────
async function extractClaims({ question, page, language, signal, usage, subQuestions }) {
  const result = await modelJson({
    modelId: MODEL_EXTRACT,
    signal,
    messages: [
      {
        role: "system",
        content: [
          "Tu extrais des faits atomiques d'une source web pour DELT Deep Search.",
          "Un 'claim' = UNE affirmation factuelle vérifiable, autonome, courte (≤ 25 mots).",
          "Ignore opinions vagues, marketing, navigation. Conserve chiffres, dates, noms exacts.",
          "N'invente rien. Si rien d'utile, renvoie claims = [].",
          "Réponds uniquement en JSON valide, sans Markdown."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question: ${question}`,
          `Sous-questions: ${subQuestions.map((s) => `[${s.id}] ${s.text}`).join(" | ")}`,
          `Langue: ${language}`,
          `URL: ${page.url}`,
          `Titre: ${page.title}`,
          "Texte:",
          page.text,
          "",
          "JSON attendu:",
          "{",
          '  "title": "Titre nettoyé",',
          '  "summary": "résumé en 1-2 phrases",',
          '  "reliability": "high|medium|low",',
          '  "claims": [',
          '    {"text":"fait atomique","quote":"citation courte de la source","type":"fact|stat|opinion","subId":"s1|s2|...","date":"YYYY ou null"}',
          "  ]",
          "}"
        ].join("\n")
      }
    ]
  });
  usage.push(result.usage);
  const json = result.json || {};
  return {
    url: page.url,
    title: String(json.title || page.title || page.url).slice(0, 300),
    summary: String(json.summary || "").slice(0, 800),
    reliability: normalizeReliability(json.reliability, page.url),
    contentType: page.contentType || null,
    claims: Array.isArray(json.claims) ? json.claims.slice(0, 15).map((c) => ({
      text: String(c?.text || "").slice(0, 400).trim(),
      quote: String(c?.quote || "").slice(0, 400).trim(),
      type: /stat|opinion/i.test(String(c?.type || "")) ? String(c.type).toLowerCase() : "fact",
      subId: String(c?.subId || "").slice(0, 12),
      date: String(c?.date || "").slice(0, 12) || null
    })).filter((c) => c.text) : []
  };
}

function normalizeReliability(value, url) {
  const host = safeHost(url);
  let base = String(value || "medium").toLowerCase();
  if (!/(high|medium|low)/.test(base)) base = "medium";
  // Boost si domaine officiel (source primaire) / de confiance / grande presse établie.
  if (OFFICIAL_PRIMARY_HOSTS.test(host) || HIGH_TRUST_HOSTS.test(host) || HIGH_TRUST_TLDS.test(host) || NEWS_TRUST_HOSTS.test(host)) return "high";
  // Sur un domaine inconnu, on ne PROMEUT pas un "high" auto-déclaré à high, mais on
  // ne le casse plus à "medium" non plus s'il est cohérent — on respecte le LLM
  // sauf survente flagrante. (Avant : tout "high" inconnu → medium = trop sévère.)
  return base;
}

// ─── 5. CROSS-REFERENCE ─────────────────────────────────────────────────────
async function crossReference({ question, subQuestions, sources, language, signal, usage }) {
  // Aplatit tous les claims avec un id global et l'origine
  const flat = [];
  for (const src of sources) {
    for (const c of src.claims || []) {
      flat.push({
        id: flat.length + 1,
        sourceId: src.sourceId,
        host: safeHost(src.url),
        reliability: src.reliability,
        ...c
      });
    }
  }

  if (flat.length === 0) {
    return { clusters: [], contradictions: [], gaps: subQuestions.map((s) => s.text) };
  }

  const result = await modelJson({
    modelId: MODEL_PLAN,
    signal,
    messages: [
      {
        role: "system",
        content: [
          "Tu croises des faits issus de plusieurs sources web pour DELT Deep Search.",
          "Regroupe les claims qui affirment la même chose (même fait, formulé différemment) en clusters.",
          "CONTRADICTION = définition STRICTE : deux claims qui, sur la MÊME grandeur mesurable et le MÊME objet, affirment des valeurs MUTUELLEMENT INCOMPATIBLES (ex. 'prix 5$/M' vs 'prix 8$/M' ; 'score 70%' vs 'score 55%' sur le MÊME benchmark).",
          "NE FLAGUE JAMAIS comme contradiction : des claims de supériorité concurrentes sur des benchmarks/métriques DIFFÉRENTS, des affirmations marketing de vendeurs rivaux, un simple 'manque de comparabilité', des angles différents, ou des chiffres non directement comparables. En cas de doute → PAS une contradiction.",
          "Chaque contradiction DOIT pointer 2 ids de claims réellement incompatibles via {\"a\":<claimId>,\"b\":<claimId>}. Si tu ne peux pas nommer 2 claims précis qui se contredisent factuellement, n'en crée pas.",
          "Identifie les sous-questions non couvertes (gaps).",
          "Ne fusionne JAMAIS deux faits différents. En cas de doute, garde-les séparés.",
          "Réponds uniquement en JSON valide, sans Markdown."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question: ${question}`,
          `Sous-questions: ${JSON.stringify(subQuestions)}`,
          `Langue: ${language}`,
          "Claims (id, sourceId, host, reliability, text, type, subId, date):",
          JSON.stringify(flat.map((c) => ({
            id: c.id, src: c.sourceId, host: c.host, rel: c.reliability,
            text: c.text, type: c.type, subId: c.subId, date: c.date
          }))),
          "",
          "JSON attendu:",
          "{",
          '  "clusters": [',
          '    {"statement":"affirmation consensuelle","claimIds":[1,4,7],"subId":"s1","confidence":"high|medium|low"}',
          "  ],",
          '  "contradictions": [',
          '    {"a":0,"b":2,"note":"explication"}',
          "  ],",
          '  "gaps": ["sous-question non couverte 1", "..."]',
          "}"
        ].join("\n")
      }
    ]
  });
  usage.push(result.usage);
  const json = result.json || {};

  const clusters = Array.isArray(json.clusters) ? json.clusters.map((cl) => {
    const claimIds = Array.isArray(cl?.claimIds) ? cl.claimIds.map(Number).filter((n) => Number.isFinite(n)) : [];
    const supporting = claimIds.map((id) => flat.find((c) => c.id === id)).filter(Boolean);
    const sourceIds = [...new Set(supporting.map((c) => c.sourceId))];
    const hosts = [...new Set(supporting.map((c) => c.host))];
    // Recalcule la confidence à partir de la diversité de sources (pas du LLM)
    let confidence = "low";
    if (sourceIds.length >= 3 && hosts.length >= 2) confidence = "high";
    else if (sourceIds.length >= 2) confidence = "medium";
    return {
      statement: String(cl?.statement || "").slice(0, 500),
      subId: String(cl?.subId || "").slice(0, 12),
      claimIds,
      sourceIds,
      confidence
    };
  }).filter((cl) => cl.statement && cl.claimIds.length) : [];

  // Résout chaque contradiction (ids de CLAIMS a/b) → ids de SOURCES de chaque côté,
  // et écarte les FAUSSES contradictions (le modèle qui se dédit lui-même, ou côtés
  // non résolus / identiques). Une vraie contradiction oppose 2 sources différentes.
  const NON_CONTRA = /(pas une contradiction|n'est pas une contradiction|aucune contradiction|manque de comparabilit|non comparable|pas comparable|ambigu|plutôt qu'une contradiction|divergence de (revendication|communication)|claims? de supériorité concurrentes|métriques? différ|benchmarks? différ)/i;
  const contradictions = (Array.isArray(json.contradictions) ? json.contradictions : []).map((c) => {
    const a = Number(c?.a), b = Number(c?.b);
    const note = String(c?.note || "").slice(0, 400);
    const claimA = flat.find((f) => f.id === a);
    const claimB = flat.find((f) => f.id === b);
    const sourcesA = claimA ? [claimA.sourceId] : [];
    const sourcesB = claimB ? [claimB.sourceId] : [];
    return { a, b, note, sourcesA, sourcesB };
  }).filter((c) =>
    Number.isFinite(c.a) && Number.isFinite(c.b) &&
    c.sourcesA.length && c.sourcesB.length &&            // les 2 côtés pointent une vraie source
    c.sourcesA[0] !== c.sourcesB[0] &&                   // 2 sources DIFFÉRENTES
    !NON_CONTRA.test(c.note)                              // pas une "non-contradiction" auto-déclarée
  );

  const gaps = arrayOfStrings(json.gaps).slice(0, 8);

  return { clusters, contradictions, gaps };
}

// ─── 6. SYNTHESIZE ──────────────────────────────────────────────────────────
async function synthesize({ question, plan, sources, graph, language, signal, usage, reasoningGraph, velocity, confidence }) {
  const sourceMap = sources.map((s) => ({
    id: s.sourceId,
    title: s.title,
    url: s.url,
    reliability: s.reliability,
    score: s.scoring?.score,
    tier: s.scoring?.tier,
    hop: s._agentic || false
  }));
  const result = await modelText({
    modelId: MODEL_SYNTH,
    signal,
    messages: [
      {
        role: "system",
        content: [
          "Tu es DELT Deep Search, synthèse finale pondérée.",
          "Tu reçois un GRAPHE de claims déjà croisés (clusters de consensus + contradictions + gaps), un scoring quantitatif par SOURCE (0-100) ET par CLAIM (0-100).",
          "Règles strictes :",
          "- Cite chaque affirmation avec les ids des sources entre crochets [3] ou [2,5,7].",
          "- PONDÈRE par les 2 scores : claims avec `claimScoring.score ≥75` ET `source.scoring.tier:high` = certitude. Si claim score <40 ou source tier:low = doute explicite.",
          "- Le `contentType` de chaque source compte : un `benchmark` ou `paper` est plus fiable qu'un `reddit` ou `blog`.",
          "- Hiérarchise par confiance : 'confidence: high' = consensus solide, 'low' = à prendre avec prudence.",
          "- Signale explicitement contradictions et gaps.",
          "- N'invente AUCUNE info hors du graphe.",
          "⏰ HUMILITÉ TEMPORELLE (CRUCIAL) — tes connaissances ont une DATE DE COUPURE, pas les sources web :",
          "- Les pages qu'on te donne sont PLUS RÉCENTES que ton entraînement. Si elles décrivent un produit, une version ou un événement que tu ne connais pas, c'est qu'il est SORTI APRÈS ta coupure — pas qu'il est faux.",
          "- Il est FORMELLEMENT INTERDIT de déclarer qu'un produit/modèle/fait 'n'existe pas', est 'fictif', 'hypothétique' ou 'non attesté' au seul motif que TU ne le connais pas. Ton ignorance n'est PAS une preuve d'inexistence.",
          "- Une annonce sur le site OFFICIEL de l'éditeur (openai.com, anthropic.com, blog.google, mistral.ai, x.ai…) est une source PRIMAIRE de 1ʳᵉ main : elle CONFIRME l'existence et les specs du produit. Traite-la comme hautement fiable, jamais comme 'non vérifiée'.",
          "- Réponds avec les sources fraîches comme vérité de terrain. N'oppose JAMAIS tes souvenirs périmés aux sources : si elles disent que GPT-5.5 / Opus 4.8 / Gemini 3 existent, ils existent.",
          "CALIBRATION DE FIABILITÉ (important) — ne sois PAS sceptique par réflexe :",
          "- Le site officiel d'un éditeur sur SON propre produit = fiabilité maximale (≈95%). Ne le qualifie jamais de 'non vérifié' ou 'blog non vérifié'.",
          "- Une grande rédaction (AFP, Reuters, Le Monde, TF1, France Info, BBC, Guardian, NYT…) qui rapporte un fait d'actualité est une source FIABLE (≈80-95%), pas douteuse. Ne sous-note jamais un média établi juste parce que c'est de la presse.",
          "- Quand 2+ sources indépendantes et crédibles convergent, traite l'info comme ÉTABLIE et affirme-la directement, sans hedging excessif ('il semblerait', 'peut-être').",
          "- Réserve le doute aux cas RÉELS : source unique non corroborée, blog/forum anonyme, contradiction effective entre sources, ou claim invérifiable. Pas à une couverture médiatique normale.",
          "- Pour un événement en cours largement couvert (guerre, élection, catastrophe), les faits de base (qui, quoi, où, quand) sont fiables même si les détails évoluent : distingue le fait établi de l'estimation provisoire (ex. bilans chiffrés).",
          "Structure OBLIGATOIRE en Markdown (dans cet ordre) :",
          "# Réponse courte",
          "(2-4 phrases qui répondent direct, avec citations [id])",
          "",
          "# Analyse détaillée",
          "(développement avec citations [id] partout)",
          "",
          "# Tableau comparatif",
          "(si critères de comparaison applicables — sinon supprime cette section)",
          "",
          "# 🟡 Zones incertaines",
          "(LISTE EXPLICITE — obligatoire si contradictions ou claims faiblement scorés.",
          "Format : `- **Sujet** : description du désaccord, sources [1] vs [2,5]`.",
          "Si TOUT est cohérent et confiance haute, écris : *Aucune zone d'incertitude majeure.*)",
          "",
          "# 🧠 Comment ça pense (reasoning graph)",
          "(MAPPING claim → sources qui supportent — montre le raisonnement.",
          "Format : `- Claim : ... → supportée par [1,3,7] · contredite par [2,5]`.",
          "Maximum 5-8 lignes, prioriser les claims-clés.)",
          "",
          "# Sources",
          "(liste numérotée avec fiabilité : `[1] Titre · fiabilité 88% · source vérifiée · benchmark · URL`)"
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question: ${question}`,
          `Langue: ${language}`,
          `Sous-questions: ${JSON.stringify(plan.subQuestions)}`,
          `Critères de comparaison: ${JSON.stringify(plan.comparisonCriteria)}`,
          `À vérifier: ${JSON.stringify(plan.mustVerify)}`,
          "",
          "SOURCES (id → url/titre/fiabilité) :",
          JSON.stringify(sourceMap, null, 2),
          "",
          "GRAPHE CONSENSUEL (clusters avec leurs sourceIds) :",
          JSON.stringify(graph.clusters, null, 2),
          "",
          "CONTRADICTIONS :",
          JSON.stringify(graph.contradictions, null, 2),
          "",
          "GAPS (sous-questions non couvertes) :",
          JSON.stringify(graph.gaps, null, 2),
          "",
          "REASONING GRAPH (claim → sources qui supportent) :",
          JSON.stringify(reasoningGraph?.supports?.slice(0, 12) || [], null, 2),
          "",
          `MÉTA : velocity=${velocity || "normal"} · confidence=${(confidence ?? 0).toFixed(2)}`
        ].join("\n")
      }
    ]
  });
  usage.push(result.usage);
  return { answer: result.text };
}

// ─── LLM helpers ────────────────────────────────────────────────────────────
async function modelJson({ modelId, messages, signal }) {
  const result = await chatWithFallback({ modelId, messages, signal, manual: false });
  return { json: parseJson(result.content), usage: usageFromResult(result, messages) };
}

async function modelText({ modelId, messages, signal }) {
  const result = await chatWithFallback({ modelId, messages, signal, manual: false });
  return { text: result.content || "", usage: usageFromResult(result, messages) };
}

function usageFromResult(result, messages) {
  const u = result.raw?.usage || {};
  const content = result.content || "";
  const reasoning = u.completion_tokens_details?.reasoning_tokens || 0;
  return {
    tokensIn:  u.prompt_tokens     ?? Math.ceil(JSON.stringify(messages).length / 4),
    tokensOut: (u.completion_tokens ?? Math.ceil(content.length / 4)) + reasoning,
    costUsd:   Number(u.cost) || 0
  };
}

function parseJson(content) {
  const raw = String(content || "").trim();
  try { return JSON.parse(raw); } catch { /* continue */ }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try { return JSON.parse(fenced.trim()); } catch { /* continue */ }
  }
  const obj = raw.match(/\{[\s\S]*\}/)?.[0];
  if (obj) {
    try { return JSON.parse(obj); } catch { /* continue */ }
  }
  return {};
}

// ─── Reasoning graph (rendu visible à l'utilisateur) ────────────────────────
// Transforme les clusters + contradictions en une représentation
//   { supports:    [{ claim, sources: [1,3,7], confidence, score }],
//     contradictions: [{ a, b, note, sources: { a: [1,5], b: [2] } }],
//     gaps:        [ "..." ] }
function buildReasoningGraph(sources, graph) {
  const hostOf = (id) => { try { return new URL(sources.find((s) => s.sourceId === id)?.url || "").hostname.replace(/^www\./, ""); } catch { return ""; } };

  // Confiance affichée = MÉLANGE corroboration (nb de sources/hôtes) ET fiabilité
  // moyenne. Évite l'incohérence "Incertaine · 85%" : une source primaire unique
  // très fiable est "Probable", pas "Incertaine" ; un fait bien corroboré ET fiable
  // est "Confirmée". (Le scoring est déjà calculé à ce stade.)
  const blendConfidence = (nSources, nHosts, avg) => {
    const a = Number.isFinite(avg) ? avg : 55;
    if ((nSources >= 3 && nHosts >= 2 && a >= 55) || (nSources >= 2 && a >= 72) || (nSources >= 1 && a >= 88)) return "high";
    if (a < 50 || (nSources === 1 && a < 62)) return "low";
    return "medium";
  };

  const supports = (graph?.clusters || [])
    .filter((c) => (c.sourceIds?.length || 0) >= 1)
    .map((c) => {
      const ids = c.sourceIds || [];
      const scores = ids.map((id) => sources.find((s) => s.sourceId === id)?.scoring?.score).filter((n) => Number.isFinite(n));
      const avgSourceScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const nHosts = new Set(ids.map(hostOf).filter(Boolean)).size;
      return {
        claim: String(c.statement || c.repr || c.text || "").slice(0, 300),
        sources: ids,
        confidence: blendConfidence(ids.length, nHosts, avgSourceScore),
        avgSourceScore
      };
    })
    .sort((a, b) => (b.sources.length || 0) - (a.sources.length || 0));

  // Les sources de chaque côté sont déjà résolues dans crossReference (sourcesA/sourcesB).
  const contradictions = (graph?.contradictions || []).map((c) => ({
    a: c.a,
    b: c.b,
    note: c.note,
    sourcesA: c.sourcesA || [],
    sourcesB: c.sourcesB || []
  }));

  return {
    supports,
    contradictions,
    gaps: graph?.gaps || []
  };
}

// ─── Concurrence bornée ─────────────────────────────────────────────────────
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try { results[idx] = await fn(items[idx], idx); }
      catch (e) { results[idx] = null; }
    }
  });
  await Promise.all(workers);
  return results;
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 12) : [];
}

function mark(steps, label, patch) {
  const idx = steps.findIndex((s) => s.label === label);
  if (idx >= 0) steps[idx] = { ...steps[idx], ...patch };
}

// ─── Persistence ────────────────────────────────────────────────────────────
async function saveDeepSearchReport(userId, prompt, report) {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  await db.query(
    `INSERT INTO deep_search_reports (user_id, prompt, answer, sources, steps)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [userId, prompt, report.answer, JSON.stringify(report.sources || []), JSON.stringify(report.steps || [])]
  );
}
