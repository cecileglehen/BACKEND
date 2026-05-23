import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

const BRAND_LOGOS = {
  OpenAI:     "/brands/openai.svg",
  Anthropic:  "/brands/claude-color.svg",
  Google:     "/brands/gemini-color.svg",
  Mistral:    "/brands/mistral-color.svg",
  xAI:        "/brands/grok.svg",
  Perplexity: "/brands/perplexity-color.svg",
  Meta:       "/brands/meta-color.svg",
  Venice:     "/brands/venice-color.svg",
  InclusionAI:"/brands/antgroup-color.svg",
  DeepSeek:   "/brands/deepseek-color.svg",
  Arcee:      "/brands/arcee-color.png",
  Moonshot:   "/brands/moonshot-color.svg",
  Nova:       "/brands/nova-color.svg",
  Qwen:       "/brands/qwen-color.svg",
  DELT:       "/logo-delt.svg"
};

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  autoMode,
  onToggleAuto,
  onOpenModels,
  manualLabel,
  manualModel,
  showAuto = true,
  attachments = [],
  onAttachmentsChange,
  parallelModels = [],
  onOpenParallel,
  debateActive = false,
  onOpenDebate,
  deepActive = false,
  onToggleDeep
}) {
  const ref = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);
  const attachMenuRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recError, setRecError] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);

  useEffect(() => {
    if (!attachOpen) return;
    const onClick = (e) => {
      if (!attachMenuRef.current?.contains(e.target)) setAttachOpen(false);
    };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, [attachOpen]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }, [value]);

  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0);

  const startRecording = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) { setRecording(false); return; }
        setTranscribing(true);
        try {
          const result = await api.transcribe(blob);
          if (result.text) onChange((value ? value + " " : "") + result.text.trim());
        } catch (e) {
          setRecError(e.message || "Erreur transcription");
        } finally {
          setTranscribing(false);
          setRecording(false);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setRecError(e.message || "Microphone non disponible");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recording) recorderRef.current.stop();
  };

  const toggleMic = () => recording ? stopRecording() : startRecording();

  const handleFiles = async (fileList, ref) => {
    if (!onAttachmentsChange) return;
    setUploadError(null);
    setUploading(true);
    const newAttachments = [...attachments];
    try {
      for (const file of fileList) {
        const parsed = await api.uploadFile(file);
        newAttachments.push({ ...parsed, _id: `${Date.now()}-${Math.random()}` });
      }
      onAttachmentsChange(newAttachments);
    } catch (e) {
      setUploadError(e.message || "Erreur upload");
    } finally {
      setUploading(false);
      if (ref?.current) ref.current.value = "";
    }
  };

  const openImagePicker = () => {
    setAttachOpen(false);
    imageInputRef.current?.click();
  };

  const openDocPicker = () => {
    setAttachOpen(false);
    docInputRef.current?.click();
  };

  const removeAttachment = (id) => {
    if (!onAttachmentsChange) return;
    onAttachmentsChange(attachments.filter((a) => a._id !== id));
  };

  return (
    <div className="w-full rounded-2xl sm:rounded-3xl border border-delt-border bg-white shadow-sm px-3 sm:px-4 pt-3 pb-2 transition-shadow focus-within:shadow-md">
      {/* Pièces jointes */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-delt-border">
          {attachments.map((att) => (
            <div
              key={att._id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-delt-surface border border-delt-border max-w-[16rem]"
            >
              {att.type === "image" ? (
                <img src={att.dataUrl} alt={att.name} className="w-7 h-7 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded bg-white border border-delt-border flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={att.type === "pdf" ? "#dc2626" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-delt-text truncate">{att.name}</div>
                {att.type === "pdf" && (
                  <div className="text-[10px] text-delt-muted">{att.readPages}/{att.pageCount} pages</div>
                )}
                {att.type === "text" && (
                  <div className="text-[10px] text-delt-muted">{(att.size / 1024).toFixed(1)} KB</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(att._id)}
                className="text-delt-muted hover:text-delt-text flex-shrink-0"
                aria-label="Retirer"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*"
        onChange={(e) => e.target.files?.length && handleFiles(Array.from(e.target.files), imageInputRef)}
      />
      <input
        ref={docInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.txt,.md,.mdx,.rst,.tex,.csv,.tsv,.log,.json,.jsonc,.jsonl,.ndjson,.xml,.yaml,.yml,.toml,.ini,.env,.conf,.cfg,.properties,.editorconfig,.html,.htm,.css,.scss,.sass,.less,.js,.mjs,.cjs,.jsx,.ts,.tsx,.vue,.svelte,.astro,.py,.pyw,.rb,.php,.pl,.pm,.lua,.r,.jl,.c,.h,.cpp,.hpp,.cc,.hh,.cxx,.cs,.java,.kt,.kts,.scala,.go,.rs,.swift,.dart,.m,.mm,.sh,.bash,.zsh,.fish,.ps1,.bat,.cmd,.sql,.graphql,.gql,.proto,.prisma,.dockerfile,.makefile,.mk,.gradle,.sbt,.cmake,.nim,.zig,.v,.vb,.fs,.fsx,.ml,.mli,.ex,.exs,.elm,.erl,.hs,.clj,.cljs,.asm,.s,text/*,application/*"
        onChange={(e) => e.target.files?.length && handleFiles(Array.from(e.target.files), docInputRef)}
      />

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder="Posez votre question"
        rows={1}
        className="w-full outline-none resize-none text-[15px] text-delt-text placeholder:text-delt-muted leading-relaxed bg-transparent"
      />

      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
          {/* Attach — popover image / fichier */}
          <div ref={attachMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAttachOpen((v) => !v)}
              disabled={uploading}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                uploading ? "text-delt-accent bg-delt-surface"
                : attachOpen ? "bg-delt-surface text-delt-text"
                : "text-delt-muted hover:bg-delt-surface"
              }`}
              aria-label="Joindre"
              title={uploadError || "Joindre image ou fichier"}
            >
              {uploading ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )}
            </button>

            {attachOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-52 rounded-2xl border border-delt-border bg-white shadow-lg overflow-hidden z-40 animate-slideUp">
                <button
                  type="button"
                  onClick={openImagePicker}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-delt-surface transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-delt-text">Image</div>
                    <div className="text-[11px] text-delt-muted">PNG, JPG, GIF, WebP…</div>
                  </div>
                </button>

                <div className="h-px bg-delt-border" />

                <button
                  type="button"
                  onClick={openDocPicker}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-delt-surface transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-delt-text">Fichier</div>
                    <div className="text-[11px] text-delt-muted">PDF, TXT, code…</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {showAuto && (() => {
            const isFullAuto = autoMode && !manualModel;
            const brand = !isFullAuto ? manualModel?.brand : null;
            const brandLogo = brand ? BRAND_LOGOS[brand] : null;
            const label = isFullAuto ? "Auto" : (manualLabel || "Modèle");
            return (
              <button
                type="button"
                onClick={onOpenModels}
                className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full border border-delt-border hover:bg-delt-surface transition-colors text-xs sm:text-sm text-delt-text min-w-0"
                title="Choisir la famille de modèle"
              >
                {brandLogo ? (
                  <img src={brandLogo} alt={brand} className="w-4 h-4 object-contain flex-shrink-0" />
                ) : brand ? (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-delt-text text-white text-[8px] font-bold flex-shrink-0">
                    {brand.charAt(0)}
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2.39 6.95L22 9.5l-5.5 4.55L18.18 22 12 18.27 5.82 22l1.68-7.95L2 9.5l7.61-.55L12 2z"/>
                  </svg>
                )}
                <span className="font-medium truncate max-w-[6rem] sm:max-w-[10rem]">{label}</span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            );
          })()}

          {onToggleDeep && (
            <button
              type="button"
              onClick={onToggleDeep}
              className={`flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full border transition-colors text-xs sm:text-sm min-w-0 ${
                deepActive
                  ? "border-transparent text-white shadow-sm"
                  : "border-delt-border text-delt-muted hover:text-delt-text hover:bg-delt-surface"
              }`}
              style={deepActive ? { background: "linear-gradient(135deg, #0f766e, #2563eb)" } : {}}
              title="DELT Deep Search Beta"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
                <path d="M8.5 11h5M11 8.5v5" />
              </svg>
              <span className="font-medium">Deep</span>
            </button>
          )}

          {/* Mode Débat */}
          {onOpenDebate && (
            <button
              type="button"
              onClick={onOpenDebate}
              className={`flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full border transition-colors text-xs sm:text-sm min-w-0 ${
                debateActive
                  ? "border-transparent text-white shadow-sm"
                  : "border-delt-border text-delt-muted hover:text-delt-text hover:bg-delt-surface"
              }`}
              style={debateActive ? { background: "linear-gradient(135deg, #a855f7, #ec4899)" } : {}}
              title={debateActive ? "Désactiver le débat" : "Mode débat : plusieurs IA débattent puis synthétisent"}
            >
              <span className="text-sm leading-none">🎭</span>
              <span className="font-medium hidden sm:inline">{debateActive ? "Débat actif" : "Débat"}</span>
            </button>
          )}

          {/* Multi-modèle parallèle */}
          {onOpenParallel && (
            <button
              type="button"
              onClick={onOpenParallel}
              className={`flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full border transition-colors text-xs sm:text-sm min-w-0 ${
                parallelModels.length > 0
                  ? "border-transparent text-white shadow-sm"
                  : "border-delt-border text-delt-muted hover:text-delt-text hover:bg-delt-surface"
              }`}
              style={parallelModels.length > 0 ? { background: "linear-gradient(135deg, #6366f1, #06b6d4)" } : {}}
              title="Comparer plusieurs modèles en parallèle"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span className="font-medium">
                {parallelModels.length > 0 ? `×${parallelModels.length}` : "Multi"}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMic}
            disabled={transcribing}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              recording ? "bg-red-500 text-white animate-pulse"
              : transcribing ? "bg-delt-surface text-delt-muted"
              : "text-delt-muted hover:bg-delt-surface"
            }`}
            aria-label={recording ? "Arrêter" : "Dictée vocale"}
            title={recError || (recording ? "Cliquer pour arrêter" : "Dictée vocale")}
          >
            {transcribing ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="12" rx="3"/>
                <path d="M19 11a7 7 0 0 1-14 0M12 19v3"/>
              </svg>
            )}
          </button>

          {disabled && onStop ? (
            <button
              onClick={onStop}
              className="w-9 h-9 rounded-full bg-delt-text text-white flex items-center justify-center hover:bg-black transition-colors animate-fadeIn"
              aria-label="Arrêter la génération"
              title="Arrêter"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5"/>
              </svg>
            </button>
          ) : canSend && (
            <button
              onClick={onSend}
              className="w-9 h-9 rounded-full bg-delt-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity"
              aria-label="Envoyer"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="text-[11px] text-red-600 mt-1.5 px-1">{uploadError}</div>
      )}
    </div>
  );
}
