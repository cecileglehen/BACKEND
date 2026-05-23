// Wrapper embeddings via OpenRouter (model openai/text-embedding-3-small).
// Utilisé par le pipeline Deep Search pour ranker les chunks de pages
// scrapées par similarité cosinus avec la question utilisateur.
//
// Coût : $0.02 / 1M tokens → quasi-gratuit à l'échelle de Delt AI.

const OR_URL = "https://openrouter.ai/api/v1/embeddings";
const MODEL = "openai/text-embedding-3-small";
const BATCH = 96; // OpenAI accepte jusqu'à 2048 inputs, on reste prudent

function headers() {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://delt.ai",
    "X-Title": "DELT AI"
  };
}

// Embed un seul texte (question utilisateur typiquement).
export async function embedOne(text, signal) {
  const res = await fetch(OR_URL, {
    method: "POST",
    signal,
    headers: headers(),
    body: JSON.stringify({ model: MODEL, input: String(text || "").slice(0, 8000) })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`embeddings ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding || null;
}

// Embed plusieurs textes en parallèle (par batches).
// Retourne un tableau de vecteurs alignés avec l'ordre d'entrée.
export async function embedMany(texts, signal) {
  const inputs = texts.map((t) => String(t || "").slice(0, 8000));
  const results = new Array(inputs.length);

  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const res = await fetch(OR_URL, {
      method: "POST",
      signal,
      headers: headers(),
      body: JSON.stringify({ model: MODEL, input: slice })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`embeddings ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const items = data?.data || [];
    for (let j = 0; j < items.length; j += 1) {
      results[i + j] = items[j].embedding;
    }
  }

  return results;
}

// Découpe un texte en chunks d'environ `targetTokens` tokens (1 token ≈ 4 chars).
// Privilégie les coupures de paragraphe pour préserver le contexte.
export function chunkText(text, targetTokens = 350, overlap = 40) {
  const targetChars = targetTokens * 4;
  const overlapChars = overlap * 4;
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (clean.length <= targetChars) return clean ? [clean] : [];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= targetChars) {
      current += (current ? "\n\n" : "") + para;
    } else {
      if (current) chunks.push(current);
      // Si le paragraphe seul est trop gros, le découper en phrases
      if (para.length > targetChars) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let sub = "";
        for (const s of sentences) {
          if (sub.length + s.length + 1 <= targetChars) {
            sub += (sub ? " " : "") + s;
          } else {
            if (sub) chunks.push(sub);
            sub = s.length > targetChars ? s.slice(0, targetChars) : s;
          }
        }
        if (sub) chunks.push(sub);
        current = "";
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);

  // Overlap pour préserver le contexte aux frontières
  if (overlap > 0 && chunks.length > 1) {
    return chunks.map((c, i) => {
      if (i === 0) return c;
      const tail = chunks[i - 1].slice(-overlapChars);
      return tail + "\n\n" + c;
    });
  }
  return chunks;
}

// Cosine similarity entre 2 vecteurs.
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Pour un page (texte long), retourne les top-K chunks les plus pertinents
// pour la question. Évite d'envoyer toute la page au LLM d'extraction.
export async function rankPageChunks({ pageText, questionEmbedding, topK = 5, signal }) {
  const chunks = chunkText(pageText, 350, 40);
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) {
    // Pas assez de chunks pour mériter un embedding, on prend tout
    return chunks.map((text, i) => ({ text, score: 1, index: i }));
  }

  const chunkEmbeddings = await embedMany(chunks, signal);
  const scored = chunks.map((text, i) => ({
    text,
    score: cosine(questionEmbedding, chunkEmbeddings[i] || []),
    index: i
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
