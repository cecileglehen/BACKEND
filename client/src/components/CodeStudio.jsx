import { useMemo, useState } from "react";
import { api } from "../lib/api.js";

const EXAMPLES = [
  "Crée une landing page HTML/CSS/JS pour un SaaS de facturation.",
  "Crée une page d'accueil index.html avec un lien vers pricing.html, puis crée pricing.html.",
  "Crée une API Node Express simple avec routes CRUD en mémoire.",
  "Crée un petit jeu snake en Python avec pygame.",
  "Crée un composant React de tableau de bord avec données mockées."
];

export default function CodeStudio() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [session, setSession] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [error, setError] = useState(null);

  const htmlFiles = useMemo(() => {
    const files = session?.files ?? [];
    return files
      .map((file) => file.path)
      .filter((file) => /\.html?$/i.test(file))
      .sort((a, b) => {
        if (a === "index.html") return -1;
        if (b === "index.html") return 1;
        return a.localeCompare(b);
      });
  }, [session]);

  const previewUrl = session?.id && previewFile ? api.codePreviewUrl(session.id, previewFile) : null;

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSession(null);
    try {
      const result = await api.codeSession(prompt);
      setSession(result);
      const firstHtml = result.files
        ?.map((file) => file.path)
        .filter((file) => /\.html?$/i.test(file))
        .sort((a, b) => {
          if (a === "index.html") return -1;
          if (b === "index.html") return 1;
          return a.localeCompare(b);
        })[0];
      setPreviewFile(firstHtml ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updatePreviewAfterSessionChange = (result) => {
    const html = result.files
      ?.map((file) => file.path)
      .filter((file) => /\.html?$/i.test(file))
      .sort((a, b) => {
        if (a === "index.html") return -1;
        if (b === "index.html") return 1;
        return a.localeCompare(b);
      }) ?? [];
    setPreviewFile((current) => html.includes(current) ? current : html[0] ?? null);
  };

  const editSession = async () => {
    if (!session?.id || !editPrompt.trim() || editing) return;
    setEditing(true);
    setError(null);
    try {
      const result = await api.codeEditSession(session.id, editPrompt);
      setSession(result);
      updatePreviewAfterSessionChange(result);
      setEditPrompt("");
    } catch (e) {
      setError(e.message);
    } finally {
      setEditing(false);
    }
  };

  const downloadZip = async () => {
    if (!session?.id) return;
    setError(null);
    try {
      const data = await api.codeZip(session.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ring-code-${session.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col gap-5">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-bold text-lg text-delt-text">Code</h2>
            <p className="text-sm text-delt-muted mt-1">
              Ring génère un projet en fichiers, puis DELT prépare un ZIP téléchargeable.
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded font-semibold bg-slate-100 border border-slate-200 text-slate-600">
            RING-2.6-1T
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="Décris le projet, le langage, les fichiers attendus, le style, les contraintes..."
          className="w-full rounded-xl bg-delt-surface border border-delt-border px-4 py-3 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all resize-none"
        />

        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-delt-border text-delt-muted hover:text-delt-text hover:border-delt-text transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-delt-muted">
            Actions JSON sécurisées : dossiers, fichiers, suppressions dans une session isolée.
          </span>
          <button
            onClick={generate}
            disabled={busy || editing || !prompt.trim()}
            className="btn-primary"
          >
            {busy ? "Génération..." : "Générer le projet"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {session && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 min-h-0">
          <div className="card p-5 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-1">Session Ring</div>
                <h3 className="font-semibold text-delt-text">{session.summary}</h3>
              </div>
              {session.tokensOut > 0 && (
                <span className="text-[10px] text-delt-muted font-mono">
                  {session.tokensOut.toLocaleString("fr-FR")} tokens générés
                </span>
              )}
            </div>

            <div className="rounded-xl border border-delt-border overflow-hidden">
              <div className="px-3 py-2 bg-delt-surface border-b border-delt-border text-xs font-semibold text-delt-muted">
                Fichiers générés
              </div>
              <div className="divide-y divide-delt-border max-h-[420px] overflow-y-auto">
                {session.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => /\.html?$/i.test(file.path) && setPreviewFile(file.path)}
                    className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-sm text-left ${
                      previewFile === file.path ? "bg-indigo-50" : "hover:bg-delt-surface"
                    } ${/\.html?$/i.test(file.path) ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <code className={`font-mono text-xs truncate ${previewFile === file.path ? "text-delt-accent" : "text-delt-text"}`}>
                      {file.path}
                    </code>
                    <span className="text-[10px] text-delt-muted flex-shrink-0">{Math.ceil(file.bytes / 1024)} Ko</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {htmlFiles.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted">Preview</div>
                    <div className="text-sm font-medium text-delt-text mt-1">{previewFile}</div>
                  </div>
                  <select
                    value={previewFile ?? ""}
                    onChange={(e) => setPreviewFile(e.target.value)}
                    className="text-xs rounded-lg border border-delt-border bg-white px-2 py-1.5 outline-none"
                  >
                    {htmlFiles.map((file) => (
                      <option key={file} value={file}>{file}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-delt-border overflow-hidden bg-white aspect-[4/3]">
                  {previewUrl && (
                    <iframe
                      key={previewUrl}
                      src={previewUrl}
                      title="Preview HTML"
                      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                      className="w-full h-full bg-white"
                    />
                  )}
                </div>
                <p className="text-xs text-delt-muted mt-3">
                  Les liens relatifs entre pages HTML restent dans la preview, par exemple `pricing.html`.
                </p>
              </div>
            )}

            <div className="card p-5 h-fit">
              <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-3">Export</div>
              <button onClick={downloadZip} className="btn-primary w-full justify-center">
                Télécharger le ZIP
              </button>
              {session.run && (
                <div className="mt-4 space-y-2 text-sm">
                  {session.run.entry && (
                    <div>
                      <div className="text-xs text-delt-muted mb-1">Entrée</div>
                      <code className="font-mono text-xs text-delt-text break-all">{session.run.entry}</code>
                    </div>
                  )}
                  {session.run.instructions && (
                    <div>
                      <div className="text-xs text-delt-muted mb-1">Lancement</div>
                      <p className="text-delt-text">{session.run.instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-delt-muted mb-3">Modifier après preview</div>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
                placeholder="Ex: ajoute une section tarifs, corrige le responsive, relie le bouton Tarifs vers pricing.html..."
                className="w-full rounded-xl bg-delt-surface border border-delt-border px-3 py-2 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all resize-none"
              />
              <button
                onClick={editSession}
                disabled={editing || busy || !editPrompt.trim()}
                className="btn-secondary w-full justify-center mt-3"
              >
                {editing ? "Modification..." : "Appliquer la modification"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
