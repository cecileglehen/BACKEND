import { useState, useRef } from "react";

const DELT_URL = "https://bathroom-ultram-usd-offering.trycloudflare.com";
const DELT_KEY = "myDMpvoCuw1ePElUrbqapiB7sXPfShWGfrSh5WdaSpM";

export default function OurModelRoute() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ctrlRef = useRef(null);

  async function runTest(e) {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || loading) return;
    setError("");
    setOutput("");
    setLoading(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const res = await fetch(`${DELT_URL}/v1/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DELT_KEY}` },
        body: JSON.stringify({
          model: "delt/delt-33m",
          messages: [{ role: "user", content: text }],
          stream: true,
          max_tokens: 200,
          temperature: 0.8
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const d = j.choices?.[0]?.delta?.content;
            if (d) { acc += d; setOutput(acc); }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Erreur");
    } finally {
      setLoading(false);
      ctrlRef.current = null;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            MADE IN FRANCE · OPEN BETA
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-delt-text leading-[1.05]">
            DELT 33M
          </h1>
          <p className="mt-3 text-blue-600 text-sm sm:text-base font-medium uppercase tracking-wider">
            Notre modèle propriétaire
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-8 sm:p-12 shadow-xl mb-10 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight">
            Un peu bébête<br />mais français 🇫🇷
          </h2>
          <p className="mt-5 text-base sm:text-lg text-blue-50 max-w-2xl mx-auto leading-relaxed">
            Soutenez Delt AI dans le développement et la création d'IA !
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="rounded-2xl border border-delt-border bg-white p-5">
            <div className="text-3xl font-extrabold text-delt-text">33M</div>
            <div className="text-xs text-delt-muted mt-1 uppercase tracking-wider font-semibold">Paramètres</div>
            <p className="text-sm text-delt-muted mt-2">Entraîné from scratch sur GPU local — pas de fine-tuning externe.</p>
          </div>
          <div className="rounded-2xl border border-delt-border bg-white p-5">
            <div className="text-3xl font-extrabold text-delt-text">1024</div>
            <div className="text-xs text-delt-muted mt-1 uppercase tracking-wider font-semibold">Context</div>
            <p className="text-sm text-delt-muted mt-2">Petite fenêtre, ultra rapide, conçu pour la conversation courte.</p>
          </div>
          <div className="rounded-2xl border border-delt-border bg-white p-5">
            <div className="text-3xl font-extrabold text-delt-text">100%</div>
            <div className="text-xs text-delt-muted mt-1 uppercase tracking-wider font-semibold">DELT</div>
            <p className="text-sm text-delt-muted mt-2">Architecture, tokenizer, dataset — tout est maison.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-delt-border bg-delt-surface p-6 sm:p-8 mb-10">
          <h3 className="text-xl font-bold text-delt-text mb-3">Pourquoi un modèle si petit ?</h3>
          <p className="text-sm sm:text-base text-delt-muted leading-relaxed">
            Parce qu'on commence quelque part. DELT 33M, c'est notre première brique
            d'IA souveraine : on apprend à entraîner, à servir, à scaler. C'est imparfait,
            parfois drôle, parfois confus — mais c'est <span className="font-semibold text-delt-text">le nôtre</span>.
            Chaque abonnement Delt AI finance la prochaine version (100M, 500M, 1B…).
          </p>
        </div>

        <div className="rounded-2xl border-2 border-blue-200 bg-white p-6 sm:p-8 mb-10 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">Live</span>
            <h3 className="text-xl font-bold text-delt-text">Teste-le maintenant</h3>
          </div>
          <p className="text-sm text-delt-muted mb-4">
            Envoie un prompt à DELT 33M directement depuis cette page. Réponse en streaming, gratuit.
          </p>
          <form onSubmit={runTest} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Hello, who are you?"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border border-delt-border bg-white text-delt-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              {loading ? "Génère…" : "Envoyer"}
            </button>
          </form>
          {(output || error || loading) && (
            <div className={`mt-4 p-4 rounded-xl text-sm whitespace-pre-wrap ${error ? "bg-red-50 text-red-700 border border-red-200" : "bg-delt-surface text-delt-text border border-delt-border"}`}>
              {error ? `Erreur : ${error}` : (output || <span className="text-delt-muted italic">DELT réfléchit…</span>)}
            </div>
          )}
          <p className="text-[11px] text-delt-muted mt-3 italic">
            ⚠ Le modèle parle surtout anglais et peut sortir n'importe quoi — c'est bébête mais c'est nous.
          </p>
        </div>

        <div className="text-center">
          <a
            href="/billing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            Soutenir Delt AI
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </a>
          <p className="text-xs text-delt-muted mt-3">
            Chaque crédit acheté finance les prochains modèles maison.
          </p>
        </div>

      </div>
    </div>
  );
}
