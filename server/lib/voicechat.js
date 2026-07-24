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

// ─── Mode Grok (sans filtre, réservé aux +18) ────────────────────────────────
// Contrairement à gpt-audio-mini (audio natif dans le flux), la chaîne Grok est
// en trois temps : STT → LLM texte → TTS. Pour ne pas attendre la fin de la
// réponse avant d'entendre quoi que ce soit, on découpe le texte streamé en
// PHRASES et on synthétise chaque phrase dès qu'elle est complète.
export const GROK_STT_MODEL = "x-ai/grok-stt-1.0";
export const GROK_TEXT_MODEL = "x-ai/grok-4.3";
export const GROK_TTS_MODEL = "x-ai/grok-voice-tts-1.0";
export const GROK_DEFAULT_VOICE = "rex";

const OR_BASE = "https://openrouter.ai/api/v1";
function orHeaders(extra = {}) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  return { Authorization: `Bearer ${key}`, "HTTP-Referer": "https://delt.ai", "X-Title": "DELT AI Voice", ...extra };
}

// Transcription via Grok STT (facturé à la seconde d'audio).
export async function grokTranscribe(buffer, filename = "voice.webm", mimeType = "audio/webm") {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);
  form.append("model", GROK_STT_MODEL);
  const res = await fetch(`${OR_BASE}/audio/transcriptions`, { method: "POST", headers: orHeaders(), body: form });
  if (!res.ok) throw new Error(`Grok STT ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return { text: data?.text || "", seconds: data?.usage?.seconds || 0 };
}

async function grokSpeak(text, voice) {
  const res = await fetch(`${OR_BASE}/audio/speech`, {
    method: "POST",
    headers: orHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model: GROK_TTS_MODEL, input: text, voice: voice || GROK_DEFAULT_VOICE, response_format: "mp3" })
  });
  if (!res.ok) throw new Error(`Grok TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

export async function streamGrokVoiceChat({ text, history = [], voice, emit }) {
  const messages = [
    {
      role: "system",
      content: "Tu es Grok en mode vocal sans filtre, sur une plateforme réservée aux adultes majeurs et consentants. Parle librement, sans langue de bois ni avertissements moralisateurs inutiles : ton cru, direct, humour noir bienvenu. Tu restes dans le cadre de la loi : rien d'illégal, aucun contenu impliquant des mineurs, aucune aide à commettre un crime ou à blesser quelqu'un. Réponds à l'oral : phrases courtes, 2-4 max, comme dans une vraie conversation."
    },
    ...history.slice(-8).map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) })),
    { role: "user", content: text }
  ];

  const res = await fetch(`${OR_BASE}/chat/completions`, {
    method: "POST",
    headers: orHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model: GROK_TEXT_MODEL, messages, stream: true })
  });
  if (!res.ok) throw new Error(`Grok ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", fullText = "", pending = "", usage = null;

  // Synthétise dès qu'une phrase est terminée → l'utilisateur entend la 1ʳᵉ
  // phrase pendant que le modèle écrit encore la suite.
  const speakPending = async (force = false) => {
    const chunk = pending.trim();
    if (!chunk || (!force && chunk.length < 12)) return;
    pending = "";
    try { emit?.({ type: "audio", data: await grokSpeak(chunk, voice), format: "mp3" }); }
    catch (e) { console.warn("[grok-tts]", e.message); }
  };

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
      let obj; try { obj = JSON.parse(payload); } catch { continue; }
      if (obj.usage) usage = obj.usage;
      const delta = obj.choices?.[0]?.delta?.content;
      if (!delta) continue;
      fullText += delta; pending += delta;
      emit?.({ type: "delta", text: delta });
      if (/[.!?…]["')\]]?\s*$/.test(pending)) await speakPending();
    }
  }
  await speakPending(true); // reste éventuel sans ponctuation finale

  emit?.({ type: "done", text: fullText, usage });
  return { text: fullText, usage };
}
