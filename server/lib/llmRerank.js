// LLM re-ranker : prend N chunks pré-rangés par cosine similarity,
// demande à un LLM cheap de scorer chacun 0-10 selon sa réelle capacité
// à répondre à la question. Filtre tout ce qui est < 5.

import { chatWithFallback } from "./openrouter.js";

const MODEL = "openai/gpt-5.4-mini";

const SYSTEM = `Tu es un évaluateur de pertinence. Pour chaque extrait, donne un score de 0 à 10 selon sa capacité à répondre PRÉCISÉMENT à la question.

Critères :
- 10 = répond directement avec faits précis chiffrés/dates
- 7-9 = info utile et factuelle, partiellement liée
- 4-6 = contexte général, lié mais pas précis
- 0-3 = hors-sujet, bruit, contenu vide

Réponds STRICTEMENT en JSON :
{ "scores": [{ "i": 0, "s": 8 }, { "i": 1, "s": 3 }, ...] }
Aucun texte avant ou après le JSON.`;

export async function llmRerank({ question, chunks, signal, keepCount = 15, minScore = 5 }) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  // Construction du prompt : on numérote les chunks
  const lines = chunks.map((c, i) => `### [${i}]\n${c.text.slice(0, 800)}`).join("\n\n");
  const user = `Question : ${question}\n\nÉvalue ces ${chunks.length} extraits :\n\n${lines}`;

  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: user }
  ];

  let response;
  try {
    response = await chatWithFallback({ modelId: MODEL, messages, signal, manual: true });
  } catch (e) {
    console.warn("[rerank] LLM call fail, keeping top-K cosine:", e.message);
    return chunks.slice(0, keepCount);
  }

  const raw = response?.content || "";
  let parsed;
  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  } catch (e) {
    console.warn("[rerank] JSON parse fail, keeping top-K cosine");
    return chunks.slice(0, keepCount);
  }

  const scoreMap = new Map();
  for (const s of parsed?.scores || []) {
    if (typeof s?.i === "number" && typeof s?.s === "number") {
      scoreMap.set(s.i, Math.max(0, Math.min(10, s.s)));
    }
  }

  return chunks
    .map((c, i) => ({ ...c, llmScore: scoreMap.get(i) ?? 0 }))
    .filter((c) => c.llmScore >= minScore)
    .sort((a, b) => b.llmScore - a.llmScore)
    .slice(0, keepCount);
}
