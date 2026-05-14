import { serperSearch } from "./serper.js";
import { chatWithFallback } from "./openrouter.js";
import { getDb } from "./db.js";
import { TIER_MODELS, computeCreditFromCost } from "../config/plans.js";

const DEFAULT_MODEL = TIER_MODELS.NORMAL?.id || TIER_MODELS.MINI?.id || "openai/gpt-5.4-mini";
const PAGE_CHAR_LIMIT = 12000;

const STAGES = [
  "Génération des requêtes",
  "Recherche web",
  "Lecture des sources",
  "Analyse source par source",
  "Comparaison",
  "Synthèse finale"
];

export async function runDeepSearch({ userId, prompt, maxSources = 10, language = "fr", signal }) {
  const question = String(prompt || "").trim().slice(0, 12000);
  if (!question) throw new Error("prompt requis");

  const usage = [];
  const steps = STAGES.map((label) => ({ label, status: "pending" }));
  const mark = (label, data = {}) => {
    const idx = steps.findIndex((s) => s.label === label);
    if (idx >= 0) steps[idx] = { ...steps[idx], status: "done", ...data };
  };

  mark("Génération des requêtes", { status: "running" });
  const planResult = await modelJson({
    messages: [
      {
        role: "system",
        content: [
          "Tu es un planificateur de recherche web pour DELT Deep Search.",
          "Génère des requêtes précises et vérifiables.",
          "Réponds uniquement en JSON valide, sans Markdown."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question utilisateur: ${question}`,
          `Langue de réponse: ${language}`,
          "JSON attendu:",
          "{",
          '  "queries": ["5 à 8 requêtes web précises"],',
          '  "sourceTypes": ["types de sources à privilégier"],',
          '  "comparisonCriteria": ["critères de comparaison"],',
          '  "risks": ["risques d hallucination ou points à vérifier"],',
          '  "mustVerify": ["informations indispensables à vérifier"]',
          "}"
        ].join("\n")
      }
    ],
    signal
  });
  usage.push(planResult.usage);
  const plan = sanitizePlan(planResult.json, question);
  mark("Génération des requêtes", { queries: plan.queries });

  mark("Recherche web", { status: "running" });
  const searchBatches = [];
  for (const query of plan.queries.slice(0, 8)) {
    const batch = await serperSearch(query, { num: 6, lang: language, country: language === "fr" ? "fr" : "us" });
    searchBatches.push(batch);
  }
  const results = dedupeResults(searchBatches.flatMap((b) => b.results || []))
    .filter((r) => looksUseful(r.url))
    .slice(0, Math.max(3, Math.min(12, Number(maxSources) || 10)));
  mark("Recherche web", { results: results.length });

  mark("Lecture des sources", { status: "running" });
  const pages = await scrapePages(results);
  mark("Lecture des sources", { pages: pages.length });

  mark("Analyse source par source", { status: "running" });
  const summaries = [];
  for (const page of pages) {
    const summary = await summarizeSource({ question, page, language, signal });
    usage.push(summary.usage);
    summaries.push(summary.data);
  }
  mark("Analyse source par source", { summaries: summaries.length });

  mark("Comparaison", { status: "running" });
  const usefulSummaries = summaries.filter((s) => s.summary || s.usefulFacts?.length);
  mark("Comparaison", {
    reliableSources: usefulSummaries.filter((s) => /high|medium|élevée|moyenne/i.test(String(s.reliability || ""))).length
  });

  mark("Synthèse finale", { status: "running" });
  const synthesis = await synthesizeAnswer({ question, plan, summaries: usefulSummaries, language, signal });
  usage.push(synthesis.usage);
  mark("Synthèse finale");

  const totals = usage.reduce((acc, u) => ({
    tokensIn: acc.tokensIn + (u.tokensIn || 0),
    tokensOut: acc.tokensOut + (u.tokensOut || 0),
    costUsd: acc.costUsd + (u.costUsd || 0)
  }), { tokensIn: 0, tokensOut: 0, costUsd: 0 });
  const creditCost = computeCreditFromCost({
    costUsd: totals.costUsd,
    modelId: DEFAULT_MODEL,
    tokensIn: totals.tokensIn,
    tokensOut: totals.tokensOut
  });

  const sources = usefulSummaries.map((s, index) => ({
    index: index + 1,
    title: s.title,
    url: s.url,
    reliability: s.reliability,
    summary: s.summary
  }));

  const report = {
    answer: synthesis.answer,
    sources,
    steps,
    plan,
    tokensIn: totals.tokensIn,
    tokensOut: totals.tokensOut,
    costUsd: totals.costUsd,
    creditCost
  };

  await saveDeepSearchReport(userId, question, report).catch((e) => {
    console.warn("[deep-search] report save skipped:", e.message);
  });

  return report;
}

async function modelJson({ messages, signal }) {
  const result = await chatWithFallback({ modelId: DEFAULT_MODEL, messages, signal, manual: false });
  const usage = usageFromResult(result, messages);
  return { json: parseJson(result.content), usage };
}

async function modelText({ messages, signal }) {
  const result = await chatWithFallback({ modelId: DEFAULT_MODEL, messages, signal, manual: false });
  return { text: result.content || "", usage: usageFromResult(result, messages) };
}

function usageFromResult(result, messages) {
  const usage = result.raw?.usage || {};
  const content = result.content || "";
  const reasoning = usage.completion_tokens_details?.reasoning_tokens || 0;
  return {
    tokensIn: usage.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4),
    tokensOut: (usage.completion_tokens ?? Math.ceil(content.length / 4)) + reasoning,
    costUsd: Number(usage.cost) || 0
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

function sanitizePlan(plan, question) {
  const queries = Array.isArray(plan?.queries)
    ? plan.queries.map((q) => String(q || "").trim()).filter(Boolean)
    : [];
  return {
    queries: queries.length ? queries.slice(0, 8) : [question],
    sourceTypes: arrayOfStrings(plan?.sourceTypes),
    comparisonCriteria: arrayOfStrings(plan?.comparisonCriteria),
    risks: arrayOfStrings(plan?.risks),
    mustVerify: arrayOfStrings(plan?.mustVerify)
  };
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 12) : [];
}

function dedupeResults(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const url = normalizeUrl(r.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ ...r, url });
  }
  return out;
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

function looksUseful(url) {
  try {
    const host = new URL(url).hostname;
    return !/(google|bing|duckduckgo|facebook|instagram|tiktok|pinterest)\./i.test(host);
  } catch {
    return false;
  }
}

async function scrapePages(results) {
  const pages = [];
  for (const result of results) {
    const page = await scrapePage(result).catch((e) => ({
      url: result.url,
      title: result.title || result.url,
      text: result.snippet || "",
      error: e.message
    }));
    if ((page.text || "").length >= 300 || result.snippet) pages.push(page);
  }
  return pages;
}

async function scrapePage(result) {
  const res = await fetch(result.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DELTDeepSearch/1.0; +https://delt.ai)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const body = await res.text();
  const html = contentType.includes("html") ? body : `<title>${escapeHtml(result.title || "")}</title><body>${escapeHtml(body)}</body>`;
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || result.title || result.url);
  const text = htmlToText(html).slice(0, PAGE_CHAR_LIMIT);
  return { url: result.url, title: title.trim(), text, snippet: result.snippet || "" };
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

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function summarizeSource({ question, page, language, signal }) {
  const result = await modelJson({
    signal,
    messages: [
      {
        role: "system",
        content: [
          "Tu analyses une source web pour un moteur Deep Search.",
          "Ignore le bruit, n'invente rien, conserve les chiffres importants.",
          "Réponds uniquement en JSON valide, sans Markdown."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question utilisateur: ${question}`,
          `Langue: ${language}`,
          `Titre: ${page.title}`,
          `URL: ${page.url}`,
          `Extrait/Snippet: ${page.snippet || ""}`,
          "Texte:",
          page.text,
          "",
          "JSON attendu:",
          "{",
          '  "url": "URL",',
          '  "title": "Titre",',
          '  "usefulFacts": ["faits utiles uniquement présents dans la source"],',
          '  "limitations": ["limites, biais ou infos manquantes"],',
          '  "reliability": "high|medium|low",',
          '  "summary": "résumé court",',
          '  "quotes": ["citations très courtes si utiles"]',
          "}"
        ].join("\n")
      }
    ]
  });
  const json = result.json || {};
  return {
    usage: result.usage,
    data: {
      url: page.url,
      title: String(json.title || page.title || page.url).slice(0, 300),
      usefulFacts: arrayOfStrings(json.usefulFacts),
      limitations: arrayOfStrings(json.limitations),
      reliability: String(json.reliability || "medium").slice(0, 30),
      summary: String(json.summary || "").slice(0, 1600),
      quotes: arrayOfStrings(json.quotes).slice(0, 4)
    }
  };
}

async function synthesizeAnswer({ question, plan, summaries, language, signal }) {
  const result = await modelText({
    signal,
    messages: [
      {
        role: "system",
        content: [
          "Tu es DELT Deep Search.",
          "Réponds uniquement avec des informations présentes dans les sources analysées.",
          "Cite les sources avec [1], [2], [3].",
          "Si une information manque, dis clairement qu'elle manque.",
          "Inclue obligatoirement: # Réponse courte, # Analyse détaillée, # Tableau comparatif, # Sources."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Question utilisateur: ${question}`,
          `Langue de réponse: ${language}`,
          `Critères de comparaison: ${JSON.stringify(plan.comparisonCriteria || [])}`,
          "Sources analysées:",
          JSON.stringify(summaries.map((s, i) => ({ index: i + 1, ...s })), null, 2)
        ].join("\n")
      }
    ]
  });
  return { answer: result.text, usage: result.usage };
}

async function saveDeepSearchReport(userId, prompt, report) {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  await db.query(
    `INSERT INTO deep_search_reports (user_id, prompt, answer, sources, steps)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [userId, prompt, report.answer, JSON.stringify(report.sources || []), JSON.stringify(report.steps || [])]
  );
}
