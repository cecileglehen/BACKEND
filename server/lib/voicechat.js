// Voice chat GPT (openai/gpt-audio-mini via OpenRouter) : envoie le texte déjà
// transcrit (Whisper large-v3-turbo, Groq — déjà le plus rapide dispo), reçoit
// texte + audio en streaming SSE, relaie chaque chunk audio dès qu'il arrive
// (lecture progressive côté client via MediaSource — latence minimale).
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
export const VOICECHAT_MODEL = "openai/gpt-audio-mini";
const DEFAULT_VOICE = "alloy";
// En streaming, l'API n'accepte QUE du PCM16 brut (mp3/autres formats encodés
// renvoient 400 "Unsupported value: audio.format does not support 'mp3' when
// stream=true"). 24kHz mono, comme l'API Realtime d'OpenAI.
export const PCM_SAMPLE_RATE = 24000;

// emit({ type: "delta"|"audio"|"done"|"error", ... })
export async function streamVoiceChat({ text, history = [], voice, emit }) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");

  const messages = [
    { role: "system", content: "Tu es DELT, un assistant vocal. Réponds de façon naturelle, orale, concise (2-4 phrases max sauf si on te demande plus de détails) — c'est parlé, pas écrit." },
    ...history.slice(-8).map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) })),
    { role: "user", content: text }
  ];

  const res = await fetch(OR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://delt.ai",
      "X-Title": "DELT AI Voice"
    },
    body: JSON.stringify({
      model: VOICECHAT_MODEL,
      messages,
      stream: true,
      modalities: ["text", "audio"],
      audio: { voice: voice || DEFAULT_VOICE, format: "pcm16" }
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", fullText = "", audioFormat = "pcm16", usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      let obj;
      try { obj = JSON.parse(payload); } catch { continue; }
      if (obj.usage) usage = obj.usage;
      const delta = obj.choices?.[0]?.delta || {};
      if (delta.content) { fullText += delta.content; emit?.({ type: "delta", text: delta.content }); }
      // Audio : selon le provider, arrive en un ou plusieurs chunks base64 —
      // on relaie CHAQUE fragment immédiatement, le client les assemble.
      const audio = delta.audio;
      if (audio?.data) {
        if (audio.format) audioFormat = audio.format;
        emit?.({ type: "audio", data: audio.data, format: audioFormat, sampleRate: PCM_SAMPLE_RATE });
      }
      // Certains providers ne streament pas l'audio et le livrent d'un bloc
      // dans le message final (non-delta) — filet de sécurité.
      const finalAudio = obj.choices?.[0]?.message?.audio;
      if (finalAudio?.data) {
        emit?.({ type: "audio", data: finalAudio.data, format: finalAudio.format || audioFormat, sampleRate: PCM_SAMPLE_RATE });
      }
    }
  }

  emit?.({ type: "done", text: fullText, usage });
  return { text: fullText, usage };
}
