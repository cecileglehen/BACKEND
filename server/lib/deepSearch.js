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
// Claude Sonnet 4.5 = même tier NORMAL, qualité équivalente, latence ~5-15s.
const MODEL_SYNTH   = "anthropic/claude-sonnet-4-5";

const PAGE_CHAR_LIMIT = 12000;
const SCRAPE_CONCURRENCY = 8;
const EXTRACT_CONCURRENCY = 6;
const MAX_QUERIES = 10;
const MAX_PAGES_DEFAULT = 12;
const JINA_FALLBACK = "https://r.jina.ai/";

const STAGES = [
  "Génération des requêtes",
  "Recherche web",
  "Lecture des sources",
  "Embedding & global ranking",
  "Dédoublonnage par clustering",
  "Re-ranking LLM",
  "Extraction des faits",
  "Multi-hop reasoning",
  "Croisement des sources",
  "Scoring des sources",
  "Synthèse pondérée"
];

// Petits utilitaires de domaine
const HIGH_TRUST_TLDS = /\.(gov|edu|gouv\.fr|europa\.eu)$/i;
const HIGH_TRUST_HOSTS = /(wikipedia\.org|nature\.com|sciencedirect\.com|arxiv\.org|reuters\.com|apnews\.com|lemonde\.fr|nytimes\.com|bbc\.co\.uk|insee\.fr|oecd\.org|who\.int|un\.org)/i;
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
  start("Génération des requêtes");
  const plan = await runPlan({ question, language, signal, usage });
  done("Génération des requêtes", { queries: plan.queries.length, subQuestions: plan.subQuestions.length });

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
  start("Embedding & global ranking");
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
  done("Embedding & global ranking", { totalChunks: allChunks.length, bestScore: allChunks[0]?.score?.toFixed(2) });

  // ─── 5. CLUSTERING (anti-duplication) ─────────────────────────────────────
  start("Dédoublonnage par clustering");
  const clustered = clusterChunks(allChunks, 0.86);
  const dedupedCount = allChunks.length - clustered.length;
  done("Dédoublonnage par clustering", { kept: clustered.length, duplicates: dedupedCount });

  // ─── 6. LLM RE-RANK (top 50 → top 15) ─────────────────────────────────────
  start("Re-ranking LLM");
  const reranked = await llmRerank({
    question,
    chunks: clustered,
    signal,
    keepCount: 15,
    minScore: 5
  });
  done("Re-ranking LLM", { kept: reranked.length, topScore: reranked[0]?.llmScore ?? null });

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

  // ─── 8. MULTI-HOP (1 itération de recherche ciblée sur les gaps) ──────────
  start("Multi-hop reasoning");
  let hopAdded = 0;
  try {
    const partialGraph = await crossReference({ question, subQuestions: plan.subQuestions, sources, language, signal, usage });
    const gaps = partialGraph.gaps || [];
    if (gaps.length > 0 && gaps.length <= 4) {
      // Pour chaque gap, lance 1 query Serper ciblée + scrape + extract
      const gapQueries = gaps.slice(0, 3).map((g) => typeof g === "string" ? g : g.text || g.question || "").filter(Boolean);
      const newBatches = await Promise.all(
        gapQueries.map((q) =>
          serperSearch(q, { num: 3, lang: language, country: language === "fr" ? "fr" : "us" }).catch(() => ({ results: [] }))
        )
      );
      const newRanked = rankResults(newBatches.flatMap((b) => b.results || []), 5);
      const newPages = (await mapLimit(newRanked, SCRAPE_CONCURRENCY, scrapeWithFallback)).filter(Boolean);
      if (newPages.length > 0 && questionEmbedding) {
        const newChunkBatches = await mapLimit(newPages, EXTRACT_CONCURRENCY, (page, i) =>
          chunkAndScore({
            pageText: page.text || "",
            sourceId: 1000 + i,
            sourceUrl: page.url,
            sourceTitle: page.title,
            questionEmbedding,
            signal
          }).catch(() => [])
        );
        const newChunks = newChunkBatches.flat().sort((a, b) => b.score - a.score).slice(0, 10);
        const newReranked = await llmRerank({ question, chunks: newChunks, signal, keepCount: 5, minScore: 6 });
        const newGrouped = new Map();
        for (const c of newReranked) {
          if (!newGrouped.has(c.sourceId)) newGrouped.set(c.sourceId, []);
          newGrouped.get(c.sourceId).push(c);
        }
        for (const [sourceId, chunks] of newGrouped.entries()) {
          const original = newPages[sourceId - 1000];
          if (!original) continue;
          const focused = chunks.map((c, i) => `[Hop · pertinence ${c.llmScore}/10]\n${c.text}`).join("\n\n");
          const ext = await extractClaims({ question, page: { ...original, text: focused }, language, signal, usage, subQuestions: plan.subQuestions }).catch(() => null);
          if (ext && (ext.claims?.length || ext.summary)) {
            sources.push({ sourceId: sources.length + 1, ...ext, _hop: true });
            hopAdded += 1;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[deepsearch] multi-hop fail:", e.message);
  }
  done("Multi-hop reasoning", { gapsAddressed: hopAdded });

  // ─── 9. CROSS-REFERENCE (1 appel LLM batch) ───────────────────────────────
  start("Croisement des sources");
  let graph = await crossReference({ question, subQuestions: plan.subQuestions, sources, language, signal, usage });
  done("Croisement des sources", {
    consensus: graph.clusters.filter((c) => c.confidence === "high").length,
    contradictions: graph.contradictions.length,
    gaps: graph.gaps.length
  });

  // ─── 9b. CONFIDENCE-DRIVEN AGGRESSIVE HOP ─────────────────────────────────
  // Si la confiance globale du rapport < 0.7, on relance une vague de recherche
  // ciblée sur les contradictions ET les sub-questions floues, avec des queries
  // PLUS spécifiques (ajout "benchmark", "specs", "données chiffrées"…) +
  // exclusion des domaines déjà scrapés pour forcer du sang neuf.
  const initialConfidence = reportConfidence(sources, graph);
  if (initialConfidence < 0.7) {
    try {
      const scrapedHosts = new Set(sources.map((s) => safeHost(s.url)).filter(Boolean));
      const contradictionQueries = (graph.contradictions || []).slice(0, 2).map((c) =>
        `${question} ${c.note || ""}`.trim().slice(0, 200)
      );
      const subQs = (plan.subQuestions || []).slice(0, 3).map((s) => s.text || s);
      const specifiers = language === "fr"
        ? ["benchmark chiffres", "spécifications détaillées", "comparatif récent"]
        : ["benchmark numbers", "detailed specifications", "recent comparison"];
      const aggressiveQueries = [
        ...contradictionQueries,
        ...subQs.map((q, i) => `${q} ${specifiers[i % specifiers.length]}`)
      ].filter(Boolean).slice(0, 5);

      if (aggressiveQueries.length > 0) {
        const newBatches = await Promise.all(
          aggressiveQueries.map((q) =>
            serperSearch(q, { num: 3, lang: language, country: language === "fr" ? "fr" : "us" }).catch(() => ({ results: [] }))
          )
        );
        const newRanked = rankResults(newBatches.flatMap((b) => b.results || []), 8)
          .filter((r) => !scrapedHosts.has(safeHost(r.url))); // force du sang neuf
        const newPages = (await mapLimit(newRanked, SCRAPE_CONCURRENCY, scrapeWithFallback)).filter(Boolean);
        if (newPages.length > 0 && questionEmbedding) {
          const newChunkBatches = await mapLimit(newPages, EXTRACT_CONCURRENCY, (page, i) =>
            chunkAndScore({
              pageText: page.text || "",
              sourceId: 2000 + i,
              sourceUrl: page.url,
              sourceTitle: page.title,
              questionEmbedding,
              signal
            }).catch(() => [])
          );
          const newChunks = newChunkBatches.flat().sort((a, b) => b.score - a.score).slice(0, 15);
          const newReranked = await llmRerank({ question, chunks: newChunks, signal, keepCount: 8, minScore: 6 });
          const newGrouped = new Map();
          for (const c of newReranked) {
            if (!newGrouped.has(c.sourceId)) newGrouped.set(c.sourceId, []);
            newGrouped.get(c.sourceId).push(c);
          }
          for (const [sourceId, chunks] of newGrouped.entries()) {
            const original = newPages[sourceId - 2000];
            if (!original) continue;
            const focused = chunks.map((c) => `[Hop+ · pertinence ${c.llmScore}/10]\n${c.text}`).join("\n\n");
            const ext = await extractClaims({
              question,
              page: { ...original, text: focused },
              language, signal, usage,
              subQuestions: plan.subQuestions
            }).catch(() => null);
            if (ext && (ext.claims?.length || ext.summary)) {
              sources.push({ sourceId: sources.length + 1, ...ext, _hopAggressive: true });
            }
          }
          // Re-cross-reference avec les nouvelles sources
          if (sources.some((s) => s._hopAggressive)) {
            graph = await crossReference({ question, subQuestions: plan.subQuestions, sources, language, signal, usage });
          }
        }
      }
    } catch (e) {
      console.warn("[deepsearch] aggressive hop fail:", e.message);
    }
  }

  // ─── 10. SCORING SOURCES + CLAIMS (temporal-aware) ───────────────────────
  start("Scoring des sources");
  const velocity = detectTopicVelocity(question);
  const weights = weightsForTopic(velocity);
  sources = scoreAllSources(sources, graph, weights);
  sources = scoreAllClaims(sources, graph);
  const finalConfidence = reportConfidence(sources, graph);
  done("Scoring des sources", {
    avg: Math.round(sources.reduce((n, s) => n + (s.scoring?.score || 0), 0) / Math.max(sources.length, 1)),
    high: sources.filter((s) => s.scoring?.tier === "high").length,
    low: sources.filter((s) => s.scoring?.tier === "low").length,
    confidence: finalConfidence.toFixed(2),
    aggressiveHopUsed: sources.some((s) => s._hopAggressive),
    velocity,
    freshnessWeight: weights.freshness
  });

  // ─── 10b. REASONING GRAPH (visible) ──────────────────────────────────────
  // Construit une représentation explicite "claim → sources" pour l'UI.
  // Émis en SSE pour que le frontend puisse afficher comment ça pense.
  const reasoningGraph = buildReasoningGraph(sources, graph);
  emit({ type: "reasoning_graph", graph: reasoningGraph, confidence: finalConfidence, velocity });

  // ─── 11. SYNTHÈSE PONDÉRÉE (les claims des sources mieux scorées pèsent +) ─
  start("Synthèse pondérée");
  const synthesis = await synthesize({ question, plan, sources, graph, language, signal, usage, reasoningGraph, velocity, confidence: finalConfidence });
  done("Synthèse pondérée");

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
  // Boost si domaine de confiance ; downgrade si self-déclaration "high" sur domaine inconnu
  if (HIGH_TRUST_HOSTS.test(host) || HIGH_TRUST_TLDS.test(host)) return "high";
  if (base === "high") return "medium"; // ne fais pas confiance au LLM qui s'auto-juge
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
          "Détecte les contradictions explicites entre clusters.",
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

  const contradictions = Array.isArray(json.contradictions) ? json.contradictions.map((c) => ({
    a: Number(c?.a),
    b: Number(c?.b),
    note: String(c?.note || "").slice(0, 400)
  })).filter((c) => Number.isFinite(c.a) && Number.isFinite(c.b)) : [];

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
    hop: s._hop || false
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
          "(liste numérotée avec scoring : `[1] Titre · score:88 · tier:high · type:benchmark · URL`)"
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
  const supports = (graph?.clusters || [])
    .filter((c) => (c.sources?.length || 0) >= 1)
    .map((c) => ({
      claim: String(c.repr || c.statement || c.text || "").slice(0, 300),
      sources: c.sources || [],
      confidence: c.confidence || "medium",
      // Score moyen des sources qui supportent
      avgSourceScore: (() => {
        const scores = (c.sources || [])
          .map((id) => sources.find((s) => s.sourceId === id)?.scoring?.score)
          .filter((n) => Number.isFinite(n));
        if (scores.length === 0) return null;
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      })()
    }))
    .sort((a, b) => (b.sources.length || 0) - (a.sources.length || 0));

  const contradictions = (graph?.contradictions || []).map((c) => ({
    a: c.a,
    b: c.b,
    note: c.note,
    // Tente de retrouver les sources de chaque côté via les clusters
    sourcesA: (graph?.clusters || []).find((cl) => Number(cl.id) === Number(c.a))?.sources || [],
    sourcesB: (graph?.clusters || []).find((cl) => Number(cl.id) === Number(c.b))?.sources || []
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
