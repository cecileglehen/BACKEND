// Pré-flight de routage via Groq (Llama 4 Scout)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ROUTER_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT = `You are an AI router. Assess the complexity of the user's request and return ONLY a JSON object: {"level": integer} on a scale from 1 to 10.

Scoring guide — be conservative, most requests are simple:
- 1-2: greetings, trivial questions, single-fact lookups
- 3-4: basic coding (scripts <50 lines, simple functions, debug a short snippet), summaries, translations
- 5-6: moderate coding (small features, API integrations, data processing), explanations of concepts
- 7-8: complex architecture, large refactors, deep algorithmic problems, multi-step reasoning
- 9-10: formal proofs, cutting-edge research, extremely complex multi-domain problems

Default to level 3-4 for any standard coding task. Only go above 6 for genuinely hard problems.`;

export async function routeMessage(userMessage) {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) throw new Error("GROQ_API_KEY manquante");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: ROUTER_MODEL,
      temperature: 0,
      max_tokens: 20,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq router ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  let level = 5;
  try {
    const parsed = JSON.parse(raw);
    const n = Number(parsed.level);
    if (Number.isFinite(n)) level = Math.max(1, Math.min(10, Math.round(n)));
  } catch {
    const m = raw.match(/(\d+)/);
    if (m) level = Math.max(1, Math.min(10, parseInt(m[1], 10)));
  }
  return level;
}
