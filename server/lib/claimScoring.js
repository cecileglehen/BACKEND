// Scoring quantitatif par CLAIM (au-delà du scoring par source).
// Formule :
//   claim_score = support_count * 0.5 + (source_score/100) * 0.3 + specificity * 0.2
// → permet de distinguer 2 infos vraies d'1 bullshit AU SEIN de la même source.

// Specificity 0-1 : nb de chiffres, dates, entités nommées détectés
function specificity(text) {
  const t = String(text || "");
  let score = 0;
  // Chiffres / pourcentages / unités
  const numbers = t.match(/\b\d+(?:[.,]\d+)?\s*(%|€|\$|k|M|B|G|tok|ms|s|h|GB|MB|TB)?\b/g) || [];
  score += Math.min(0.4, numbers.length * 0.08);
  // Dates (années 19xx-20xx)
  if (/\b(19|20)\d{2}\b/.test(t)) score += 0.15;
  // Entités capitalisées (noms propres) — au moins 2 mots avec maj
  const capitalized = (t.match(/\b[A-Z][a-zA-Z0-9.-]{1,}\b/g) || []).filter((w) => w.length > 2);
  score += Math.min(0.25, capitalized.length * 0.05);
  // URL ou citation explicite
  if (/https?:\/\/|\bdoi\b|\barxiv\b/i.test(t)) score += 0.1;
  // Longueur raisonnable (ni trop court, ni énorme)
  const len = t.length;
  if (len >= 40 && len <= 400) score += 0.1;
  return Math.min(1, score);
}

// Combien de sources confirment cette claim (via clusters cross-ref) ?
function supportCount(claimText, clusters) {
  if (!Array.isArray(clusters)) return 1;
  const claimLower = String(claimText || "").toLowerCase().slice(0, 200);
  for (const cluster of clusters) {
    const repr = String(cluster.repr || cluster.statement || cluster.text || "").toLowerCase();
    if (!repr) continue;
    // Match simple : sous-chaîne sur les 60 premiers caractères
    if (claimLower.slice(0, 60) && repr.includes(claimLower.slice(0, 60))) {
      return cluster.sources?.length || 1;
    }
  }
  return 1;
}

// Score [0-100] par claim
export function scoreClaim({ claim, source, clusters }) {
  const text = String(claim?.text || claim?.statement || claim || "");
  if (!text) return { score: 0, support: 0, spec: 0, sourceScore: 0 };

  const support = supportCount(text, clusters);
  const sourceScore01 = (source?.scoring?.score ?? 50) / 100;
  const spec = specificity(text);
  // support_count peut être > 1 ; on plafonne pour éviter qu'une claim avec
  // 10 sources prenne tout le poids → normaliser à un max raisonnable de 5
  const supportNorm = Math.min(1, support / 5);

  const score01 =
    supportNorm * 0.5 +
    sourceScore01 * 0.3 +
    spec * 0.2;

  return {
    score: Math.round(score01 * 100),
    support,
    spec: Math.round(spec * 100),
    sourceScore: source?.scoring?.score ?? 50
  };
}

// Applique scoreClaim à toutes les claims d'une source. Mute la source en place.
export function scoreAllClaims(sources, graph) {
  const clusters = graph?.clusters || [];
  return sources.map((s) => ({
    ...s,
    claims: (s.claims || []).map((c) => {
      const scoring = scoreClaim({ claim: c, source: s, clusters });
      return { ...(typeof c === "string" ? { text: c } : c), claimScoring: scoring };
    })
  }));
}

// Confiance globale d'un rapport (0-1) — utilisée par le multi-hop aggressif.
export function reportConfidence(sources, graph) {
  const clusters = graph?.clusters || [];
  if (clusters.length === 0) return 0.5;
  const weights = { high: 1, medium: 0.7, low: 0.3 };
  let total = 0, count = 0;
  for (const c of clusters) {
    const w = weights[c.confidence] ?? 0.5;
    const multi = Math.min(1, (c.sources?.length || 1) / 3); // bonus si ≥3 sources
    total += w * (0.7 + 0.3 * multi);
    count += 1;
  }
  // Pénalité si beaucoup de contradictions / gaps
  let confidence = total / count;
  const contradictions = graph.contradictions?.length || 0;
  const gaps = graph.gaps?.length || 0;
  confidence -= Math.min(0.2, contradictions * 0.04);
  confidence -= Math.min(0.15, gaps * 0.03);
  return Math.max(0, Math.min(1, confidence));
}
