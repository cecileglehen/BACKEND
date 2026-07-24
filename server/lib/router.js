// Pré-flight de routage via OpenRouter (Gemini 3.1 Flash Lite)
const ROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ROUTER_MODEL = "google/gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `You are an AI router for DELT AI. Analyze the user's request and return ONLY a JSON object with this exact shape:

{
  "intent": "text" | "image" | "video" | "music",
  "level": 1-10,            // complexity of the request
  "imageModel": "..."       // only if intent=="image", chosen from the list below
}

═══ INTENT DETECTION ═══
- "image" : user wants to GENERATE / CREATE an image, illustration, logo, photo, drawing, banner, etc.
  Triggers: "génère / crée / dessine / fais / fait moi / image / illustration / logo / photo / banner".
- "video" : explicit video generation request ("crée une vidéo", "vidéo de", "scène animée").
- "music" : explicit music generation ("compose", "crée une musique", "chanson", "instrumental").
- "text" : everything else (default).

═══ LEVEL (text complexity, only matters when intent=="text") ═══
- 1-2: greetings, trivial questions, single-fact lookups, weather, time, basic translations
- 3-4: basic coding (<50 lines), simple summaries, casual conversation, basic explanations
- 5-6: moderate coding (small features, APIs), concept explanations, structured analysis
- 7-8: complex architecture, large refactors, deep multi-step reasoning, sophisticated writing
- 9-10: formal proofs, cutting-edge research, extremely complex multi-domain problems

Default to 3-4 for standard tasks. Only go above 6 for genuinely hard problems.

═══ IMAGE MODEL SELECTION (when intent=="image") ═══
Pick the BEST model based on these rules :

0. "fal-ai/fast-sdxl" — CHEAPEST. Use for very quick drafts, throwaway sketches, ultra-simple
   subjects with no quality requirement. Pick it when the user wants "vite", "pas cher", "un brouillon".

1. "google/gemini-3.1-flash-lite-image" — Fast & cheap. Use for:
   - Simple subjects, generic illustrations, casual concepts
   - NO text needed in the image (or just 1-2 letters)
   - Quick tries, drafts, brainstorming
   Examples: "un chat mignon", "logo abstrait coloré", "paysage montagne", "icône simple"

2. "google/gemini-2.5-flash-image" (Nano Banana) — Balanced quality.
   Use when user asks for "qualité standard", "rendu correct" with a clear but simple subject.

3. "google/gemini-3.1-flash-image-preview" (Nano Banana 2) — High quality.
   Use for detailed scenes, character art, complex compositions with clear directives.

5. "openai/gpt-5-image-mini" — Decent OpenAI quality, mid budget.

6. "openai/gpt-5-image" — High quality OpenAI, complex scenes OR images with readable TEXT
   (affiches, posters, mockups, infographies). Best choice for text in chat.

⚠️ INTERDITS EN CHAT (réservés au Studio) : ne choisis JAMAIS "google/gemini-3-pro-image-preview"
(Nano Banana Pro) ni "openai/gpt-5.4-image-2" (GPT Image 2).

═══ DECISION RULES (priority order) ═══
- Image contains text/words/numbers → "openai/gpt-5-image"
- "haute qualité / pro / parfait" or detailed character / complex scene → "google/gemini-3.1-flash-image-preview"
- Standard quality request → "google/gemini-2.5-flash-image"
- Simple subject, no text → "google/gemini-3.1-flash-lite-image" (default for image)

Return ONLY the JSON, no other text.`;

export async function routeMessage(userMessage) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");

  const res = await fetch(ROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: ROUTER_MODEL,
      temperature: 0,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter router ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";

  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fallback : extrait un nombre pour level
    const m = raw.match(/(\d+)/);
    if (m) parsed = { level: parseInt(m[1], 10), intent: "text" };
  }

  const allowedIntents = new Set(["text", "image", "video", "music"]);
  // Modèles d'image autorisés EN CHAT — Nano Banana Pro et GPT Image 2 sont
  // volontairement exclus (réservés à l'Art Studio).
  const allowedImageModels = new Set([
    "fal-ai/fast-sdxl",
    "google/gemini-3.1-flash-lite-image",
    "google/gemini-2.5-flash-image",
    "openai/gpt-5-image-mini",
    "google/gemini-3.1-flash-image-preview",
    "openai/gpt-5-image"
  ]);

  const intent = allowedIntents.has(parsed.intent) ? parsed.intent : "text";
  let level = 5;
  const n = Number(parsed.level);
  if (Number.isFinite(n)) level = Math.max(1, Math.min(10, Math.round(n)));

  let imageModel = null;
  if (intent === "image" && typeof parsed.imageModel === "string" && allowedImageModels.has(parsed.imageModel)) {
    imageModel = parsed.imageModel;
  } else if (intent === "image") {
    imageModel = "google/gemini-3.1-flash-lite-image"; // défaut sûr
  }

  return { level, intent, imageModel };
}
