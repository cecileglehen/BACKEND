// Voice Chat GPT — barre d'appel intégrée au composer (pas de plein écran) :
// écoute en continu, détecte automatiquement la fin de ta phrase (silence
// après avoir parlé — pas besoin de taper pour arrêter), transcrit (Whisper
// large-v3-turbo, Groq), envoie à gpt-audio-mini et joue sa réponse en PCM16
// streamé via Web Audio API dès le premier chunk reçu (latence minimale).
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
// PCM16 : nécessite un nombre PAIR d'octets (2 par échantillon) — on tronque
// l'octet orphelin d'un chunk partiel plutôt que de lever une RangeError.
function b64ToInt16(b64) {
  const bytes = b64ToBytes(b64);
  const even = bytes.length - (bytes.length % 2);
  return new Int16Array(bytes.buffer, 0, even / 2);
}

const VAD_THRESHOLD = 14;   // amplitude RMS mini pour considérer que ça parle
const VAD_SILENCE_MS = 900; // silence après avoir parlé → fin de phrase

export default function VoiceChat({ onClose, mode = "gpt", onAgeGate }) {
  const [state, setState] = useState("listening"); // listening | thinking | speaking | muted | error
  const [caption, setCaption] = useState("");
  const [userText, setUserText] = useState("");
  const [error, setError] = useState(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const isGrok = mode === "grok";
  // Qualité du modèle vocal GPT : « mini » par défaut (rapide, économe),
  // « pro » = openai/gpt-audio, bien meilleur mais nettement plus coûteux.
  const [quality, setQuality] = useState("mini");
  const qualityRef = useRef("mini");
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  const historyRef = useRef([]);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const vadRef = useRef(null); // { stop }
  const mutedRef = useRef(false);
  const closedRef = useRef(false);

  // ── Lecture PCM16 streamée via Web Audio API (pas de fichier, pas d'attente) ──
  const audioCtxRef = useRef(null);
  const nextStartRef = useRef(0);
  const endTimerRef = useRef(null);
  const ensureAudioCtx = (sampleRate) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
      nextStartRef.current = audioCtxRef.current.currentTime;
    }
    return audioCtxRef.current;
  };
  const playPcmChunk = (b64, sampleRate) => {
    const ctx = ensureAudioCtx(sampleRate);
    const int16 = b64ToInt16(b64);
    if (!int16.length) return;
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextStartRef.current);
    src.start(startAt);
    nextStartRef.current = startAt + buffer.duration;
    // Fin de lecture = quand le dernier chunk programmé se termine réellement.
    clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(() => {
      if (!closedRef.current && stateRef.current === "speaking") startListening();
    }, Math.max(0, (nextStartRef.current - ctx.currentTime) * 1000) + 60);
  };

  // ── VAD (détection de silence) sur le flux micro brut ──────────────────────
  const setupVad = (stream, onSpeechEnd) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false, silenceStart = null, raf;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = data[i] - 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      if (rms > VAD_THRESHOLD) {
        speaking = true; silenceStart = null;
      } else if (speaking) {
        if (silenceStart == null) silenceStart = performance.now();
        else if (performance.now() - silenceStart > VAD_SILENCE_MS) {
          onSpeechEnd();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return { stop: () => { cancelAnimationFrame(raf); try { ctx.close(); } catch {} } };
  };

  // Le mode Grok renvoie des segments MP3 (une phrase = un segment), là où
  // gpt-audio-mini streame du PCM brut. On décode chaque MP3 et on l'enchaîne
  // sur la même horloge audio pour éviter les blancs entre les phrases.
  const playMp3Chunk = async (b64) => {
    const ctx = ensureAudioCtx(48000);
    // MP3 = octets bruts à décoder (surtout pas d'interprétation PCM ici).
    const bytes = b64ToBytes(b64);
    const buffer = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextStartRef.current);
    src.start(startAt);
    nextStartRef.current = startAt + buffer.duration;
    clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(() => {
      if (!closedRef.current && stateRef.current === "speaking") startListening();
    }, Math.max(0, (nextStartRef.current - ctx.currentTime) * 1000) + 60);
  };

  const speak = async (text) => {
    setState("thinking"); setCaption(""); setError(null);
    api.voiceChatStream({
      text, history: historyRef.current,
      voice: isGrok ? "rex" : "alloy",
      mode: isGrok ? "grok" : undefined,
      quality: isGrok ? undefined : qualityRef.current,
      onDelta: (t) => setCaption((c) => c + t),
      onAudio: (data, format, sampleRate) => {
        if (stateRef.current === "thinking") setState("speaking");
        if (format === "mp3") playMp3Chunk(data).catch(() => {});
        else playPcmChunk(data, sampleRate || 24000);
      },
      onDone: (msg) => {
        historyRef.current = [...historyRef.current, { role: "user", text }, { role: "assistant", text: msg.text || caption }];
        // Si aucun audio n'est jamais arrivé (edge case), on relance l'écoute direct.
        if (stateRef.current === "thinking") startListening();
      },
      onError: (e) => {
        if (String(e.message || "").includes("age_gate") || String(e.message || "").includes("+18")) {
          setError("Mode sans filtre réservé aux +18 ans.");
          setState("error");
          onAgeGate?.();
          return;
        }
        setError(e.message); setState("error"); setTimeout(startListening, 1500);
      }
    });
  };

  const stopRecorder = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    vadRef.current?.stop();
  };

  const startListening = async () => {
    if (closedRef.current || mutedRef.current) return;
    setUserText(""); setCaption(""); setError(null);
    try {
      const stream = streamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1000 || closedRef.current) { if (!closedRef.current) startListening(); return; }
        setState("thinking");
        try {
          const result = await api.transcribe(blob, isGrok ? "grok" : undefined);
          const text = (result.text || "").trim();
          if (!text) { startListening(); return; }
          setUserText(text);
          speak(text);
        } catch (e) { setError(e.message); setState("error"); setTimeout(startListening, 1500); }
      };
      mr.start();
      recorderRef.current = mr;
      vadRef.current = setupVad(stream, () => stopRecorder());
      setState("listening");
    } catch (e) {
      setError(e.message || "Microphone non disponible");
      setState("error");
    }
  };

  useEffect(() => {
    closedRef.current = false;
    startListening();
    return () => {
      closedRef.current = true;
      clearTimeout(endTimerRef.current);
      vadRef.current?.stop();
      try { recorderRef.current?.stream?.getTracks().forEach((t) => t.stop()); } catch {}
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    if (mutedRef.current) {
      stopRecorder();
      setState("muted");
    } else {
      startListening();
    }
  };

  const hangUp = () => {
    closedRef.current = true;
    stopRecorder();
    onClose?.();
  };

  const dot = {
    listening: "bg-indigo-500 animate-pulse",
    thinking: "bg-violet-500 animate-pulse",
    speaking: "bg-emerald-500 animate-pulse",
    muted: "bg-slate-400",
    error: "bg-red-500"
  }[state];
  const label = {
    listening: "Je t'écoute…", thinking: "Je réfléchis…", speaking: "…",
    muted: "Micro coupé", error: error || "Erreur"
  }[state];

  return (
    <div className="w-full rounded-2xl sm:rounded-3xl glass-strong border border-slate-900/85 px-4 py-3 flex items-center gap-3 animate-fadeIn">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-delt-muted">{label}</div>
        <div className="text-sm text-delt-text truncate">{caption || (userText && `« ${userText} »`) || "Voice chat — parle librement, DeltAI détecte quand tu as fini"}</div>
      </div>
      {!isGrok && (
        <button
          onClick={() => setQuality((q) => (q === "mini" ? "pro" : "mini"))}
          title={quality === "pro"
            ? "Meilleur modèle actif (gpt-audio) — qualité supérieure, consomme davantage"
            : "Passer au meilleur modèle (gpt-audio) — voix plus naturelle, plus coûteux"}
          className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold flex-shrink-0 border transition-colors ${
            quality === "pro"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "text-delt-muted border-delt-border hover:bg-delt-surface"
          }`}
        >
          {quality === "pro" ? "Meilleur modèle" : "Rapide"}
        </button>
      )}
      <button onClick={toggleMute} title={state === "muted" ? "Réactiver le micro" : "Couper le micro"}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          state === "muted" ? "bg-slate-200 text-slate-600" : "text-delt-muted hover:bg-delt-surface"}`}>
        {state === "muted" ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M19 11a7 7 0 0 1-14 0M12 19v3"/></svg>
        )}
      </button>
      <button onClick={hangUp} title="Raccrocher"
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500 text-white hover:bg-red-600 transition-colors">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" style={{ transform: "rotate(135deg)" }}><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.58 1 1 0 0 1-.25 1.01l-2.2 2.2z"/></svg>
      </button>
    </div>
  );
}
