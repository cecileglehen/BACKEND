// Voice Chat GPT — mode « appel vocal » : tu parles, Whisper transcrit
// (le plus rapide dispo, Groq large-v3-turbo), gpt-audio-mini répond en texte
// + audio streamés, lus progressivement dès le premier chunk (MediaSource) —
// latence minimale, pas d'attente de la fin de génération pour entendre.
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function VoiceChat({ onClose }) {
  const [state, setState] = useState("idle"); // idle | listening | thinking | speaking | error
  const [caption, setCaption] = useState("");
  const [userText, setUserText] = useState("");
  const [error, setError] = useState(null);
  const historyRef = useRef([]);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioElRef = useRef(null);
  const msRef = useRef(null);
  const sbRef = useRef(null);
  const pendingRef = useRef([]);
  const endPendingRef = useRef(false);

  useEffect(() => () => { try { recorderRef.current?.stream?.getTracks().forEach((t) => t.stop()); } catch {} }, []);

  const flushPending = () => {
    const sb = sbRef.current;
    if (!sb || sb.updating || !pendingRef.current.length) {
      if (sb && !sb.updating && endPendingRef.current) {
        try { msRef.current.endOfStream(); } catch {}
        endPendingRef.current = false;
      }
      return;
    }
    const chunk = pendingRef.current.shift();
    try { sb.appendBuffer(chunk); } catch { /* SourceBuffer déjà fermé */ }
  };

  const initAudioStream = (format) => {
    const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    pendingRef.current = []; endPendingRef.current = false;
    if (window.MediaSource && MediaSource.isTypeSupported?.(mime)) {
      const ms = new MediaSource();
      msRef.current = ms;
      audioElRef.current.src = URL.createObjectURL(ms);
      ms.addEventListener("sourceopen", () => {
        const sb = ms.addSourceBuffer(mime);
        sbRef.current = sb;
        sb.addEventListener("updateend", flushPending);
      }, { once: true });
      return true;
    }
    msRef.current = null; sbRef.current = null;
    return false; // fallback : on accumule et on joue tout à la fin
  };

  const appendAudioChunk = (b64) => {
    pendingRef.current.push(b64ToBytes(b64));
    flushPending();
  };

  const speak = async (text) => {
    setState("thinking"); setCaption(""); setError(null);
    let started = false;
    let allChunks = [];
    let fmt = "mp3";
    api.voiceChatStream({
      text, history: historyRef.current, voice: "alloy",
      onDelta: (t) => setCaption((c) => c + t),
      onAudio: (data, format) => {
        fmt = format || fmt;
        if (!started) {
          started = true;
          setState("speaking");
          const ok = initAudioStream(fmt);
          if (ok) { audioElRef.current.play().catch(() => {}); }
        }
        if (msRef.current) appendAudioChunk(data);
        else allChunks.push(data); // pas de MediaSource : on accumule
      },
      onDone: (msg) => {
        historyRef.current = [...historyRef.current, { role: "user", text }, { role: "assistant", text: msg.text || caption }];
        if (msRef.current) {
          endPendingRef.current = true;
          flushPending();
        } else if (allChunks.length) {
          // Fallback sans MediaSource : un seul blob joué d'un coup
          audioElRef.current.src = `data:audio/${fmt};base64,${allChunks.join("")}`;
          audioElRef.current.play().catch(() => {});
        } else {
          setState("idle");
        }
      },
      onError: (e) => { setError(e.message); setState("error"); }
    });
  };

  const startRecording = async () => {
    setError(null); setUserText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) { setState("idle"); return; }
        setState("thinking");
        try {
          const result = await api.transcribe(blob);
          const text = (result.text || "").trim();
          if (!text) { setState("idle"); return; }
          setUserText(text);
          speak(text);
        } catch (e) { setError(e.message); setState("error"); }
      };
      mr.start();
      recorderRef.current = mr;
      setState("listening");
    } catch (e) {
      setError(e.message || "Microphone non disponible");
      setState("error");
    }
  };

  const stopRecording = () => { if (recorderRef.current && state === "listening") recorderRef.current.stop(); };

  const onOrbClick = () => {
    if (state === "idle" || state === "error") startRecording();
    else if (state === "listening") stopRecording();
  };

  const stateLabel = {
    idle: "Touche pour parler", listening: "Je t'écoute…", thinking: "Je réfléchis…",
    speaking: "…", error: error || "Erreur — touche pour réessayer"
  }[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0f19]">
      <button onClick={onClose} className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <audio ref={audioElRef} className="hidden" onEnded={() => setState("idle")} />

      <button onClick={onOrbClick} disabled={state === "thinking" || state === "speaking"}
        className="relative w-40 h-40 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:cursor-default">
        <span className={`absolute inset-0 rounded-full transition-all duration-500 ${
          state === "listening" ? "bg-indigo-500 animate-pulse scale-110" :
          state === "thinking" ? "bg-violet-500 animate-pulse" :
          state === "speaking" ? "bg-emerald-500 animate-pulse" :
          state === "error" ? "bg-red-500/70" : "bg-white/10"
        }`} style={{ filter: "blur(20px)" }} />
        <span className={`relative w-28 h-28 rounded-full flex items-center justify-center border-2 transition-colors ${
          state === "listening" ? "border-indigo-400 bg-indigo-500/20" :
          state === "thinking" ? "border-violet-400 bg-violet-500/20" :
          state === "speaking" ? "border-emerald-400 bg-emerald-500/20" :
          state === "error" ? "border-red-400 bg-red-500/10" : "border-white/30 bg-white/5"
        }`}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="12" rx="3"/>
            <path d="M19 11a7 7 0 0 1-14 0M12 19v3"/>
          </svg>
        </span>
      </button>

      <div className="mt-8 text-center max-w-md px-6">
        <div className="text-white/60 text-sm font-medium mb-3">{stateLabel}</div>
        {userText && <div className="text-white/40 text-xs mb-1.5">« {userText} »</div>}
        {caption && <div className="text-white text-base leading-relaxed">{caption}</div>}
      </div>
    </div>
  );
}
