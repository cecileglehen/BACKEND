import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useT } from "../lib/i18n.jsx";

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
  integrations = [],
  enabledIntegrations,
  onToggleIntegration,
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
  const t = useT();
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
                aria-label={t("composer.remove_attach")}
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
        placeholder={t("composer.placeholder")}
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
              aria-label={t("composer.attach")}
              title={uploadError || t("composer.attach_title")}
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
                title={t("composer.choose_family")}
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

          {/* Outils / intégrations connectées (gear) */}
          {integrations.length > 0 && integrations.some((i) => i.connected) && (
            <ToolsButton
              integrations={integrations}
              enabledIntegrations={enabledIntegrations}
              onToggle={onToggleIntegration}
            />
          )}

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
              title={t("composer.deep_title")}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
                <path d="M8.5 11h5M11 8.5v5" />
              </svg>
              <span className="font-medium">Deep Search</span>
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
              title={debateActive ? t("composer.debate_disable") : t("composer.debate_off")}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
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
              title={t("composer.parallel_title")}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span className="font-medium">
                {parallelModels.length > 0 ? `×${parallelModels.length}` : t("composer.parallel")}
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
            aria-label={recording ? t("composer.stop_record") : t("composer.dictate")}
            title={recError || (recording ? t("composer.dictate_stop") : t("composer.dictate"))}
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

// ─── Bouton "Outils" : icône gear + popover avec toggles intégrations ───────
const INTEG_BRAND_COLORS = {
  gmail: "#EA4335", googledrive: "#4285F4", googlecalendar: "#4285F4",
  slack: "#4A154B", notion: "#000", github: "#181717", linear: "#5E6AD2",
  trello: "#0079BF", discord: "#5865F2", stripe: "#635BFF"
};
const INTEG_COLOR_LOGOS = {
  gmail: "/brands/gmail-color.png",
  googledrive: "/brands/googledrive-color.png",
  googlecalendar: "/brands/googlecalendar-color.png",
  slack: "/brands/slack-color.png"
};

function ToolsButton({ integrations, enabledIntegrations, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const connected = integrations.filter((i) => i.connected);
  const activeCount = connected.filter((i) => enabledIntegrations?.has(i.app)).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 h-9 px-2.5 rounded-full border transition-colors text-xs sm:text-sm min-w-0 ${
          activeCount > 0
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-delt-border text-delt-muted hover:text-delt-text hover:bg-delt-surface"
        }`}
        title="Outils connectés"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        {activeCount > 0 && (
          <span className="text-[10px] font-bold bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-50 w-72 bg-white rounded-xl border border-delt-border shadow-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-delt-border bg-delt-surface/40">
            <div className="text-xs font-bold text-delt-text uppercase tracking-wider">Outils connectés</div>
            <div className="text-[11px] text-delt-muted mt-0.5">Active ce que l'IA peut utiliser dans ce chat</div>
          </div>
          {connected.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="text-sm text-delt-muted">Aucune intégration connectée</div>
              <a href="/settings" className="text-xs text-blue-600 font-semibold hover:underline mt-2 inline-block">Connecter une app →</a>
            </div>
          ) : (
            <div className="py-1 max-h-80 overflow-y-auto">
              {connected.map((it) => {
                const active = enabledIntegrations?.has(it.app);
                return (
                  <button
                    key={it.app}
                    onClick={() => onToggle(it.app)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-delt-surface transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-delt-border flex items-center justify-center overflow-hidden">
                      {INTEG_COLOR_LOGOS[it.app] ? (
                        <img src={INTEG_COLOR_LOGOS[it.app]} alt={it.label} className="w-5 h-5 object-contain" />
                      ) : (
                        <div
                          className="w-5 h-5"
                          style={{
                            WebkitMaskImage: `url(/brands/${it.app}.svg)`,
                            WebkitMaskSize: "contain",
                            WebkitMaskRepeat: "no-repeat",
                            maskImage: `url(/brands/${it.app}.svg)`,
                            maskSize: "contain",
                            maskRepeat: "no-repeat",
                            backgroundColor: INTEG_BRAND_COLORS[it.app] || "#0F172A"
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-delt-text truncate">{it.label}</div>
                      <div className="text-[10px] text-delt-muted">
                        {active ? "✓ Autorisé pour ce chat" : "Inactif"}
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        active ? "bg-blue-600" : "bg-delt-border"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          active ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-3 py-2 border-t border-delt-border bg-delt-surface/30 text-[10px] text-delt-muted text-center">
            Apps activées → l'IA peut les appeler dans ce chat
          </div>
        </div>
      )}
    </div>
  );
}
