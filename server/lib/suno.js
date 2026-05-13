// Suno API integration (https://sunoapi.org)
// Génération de musique async — soumet une tâche puis polle son statut

const SUNO_BASE = "https://api.sunoapi.org/api/v1";

function key() {
  const k = (process.env.SUNO_API_KEY || "").trim();
  if (!k) throw new Error("SUNO_API_KEY manquante");
  return k;
}

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key()}`
});

/**
 * Soumet une tâche de génération musicale.
 * Champs supportés (cf. doc Suno V5_5) :
 *   - prompt        (string, requis si customMode=true)
 *   - style         (string, requis si customMode=true)
 *   - title         (string, requis si customMode=true)
 *   - customMode    (bool, défaut true)
 *   - instrumental  (bool, défaut false)
 *   - model         (string, défaut "V5_5")
 *   - personaId     (string, optionnel)
 *   - personaModel  (string, optionnel)
 *   - negativeTags  (string, optionnel)
 *   - vocalGender   (string "m" | "f", optionnel)
 *   - styleWeight   (number 0-1, optionnel)
 *   - weirdnessConstraint (number 0-1, optionnel)
 *   - audioWeight   (number 0-1, optionnel)
 *   - callBackUrl   (string, optionnel)
 */
export async function sunoSubmit(params) {
  const body = {
    customMode:   params.customMode ?? true,
    instrumental: params.instrumental ?? false,
    model:        params.model || "V5_5",
    prompt:       String(params.prompt || "").slice(0, 3000),
    style:        params.style || "Pop",
    title:        params.title || "DELT AI Track",
    ...(params.personaId    && { personaId: params.personaId }),
    ...(params.personaModel && { personaModel: params.personaModel }),
    ...(params.negativeTags && { negativeTags: params.negativeTags }),
    ...(params.vocalGender  && { vocalGender: params.vocalGender }),
    ...(Number.isFinite(params.styleWeight)         && { styleWeight: params.styleWeight }),
    ...(Number.isFinite(params.weirdnessConstraint) && { weirdnessConstraint: params.weirdnessConstraint }),
    ...(Number.isFinite(params.audioWeight)         && { audioWeight: params.audioWeight }),
    ...(params.callBackUrl && { callBackUrl: params.callBackUrl })
  };

  const res = await fetch(`${SUNO_BASE}/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Suno ${res.status}: ${data?.msg || data?.message || JSON.stringify(data).slice(0, 200)}`);
  }
  const taskId = data?.data?.taskId || data?.taskId || data?.data?.task_id;
  if (!taskId) throw new Error("Suno : pas de taskId retourné");
  return { taskId, raw: data };
}

/**
 * Récupère le statut d'une tâche.
 * Retourne un statut + (si terminé) les URLs des pistes audio.
 */
export async function sunoStatus(taskId) {
  const url = `${SUNO_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`;
  const res = await fetch(url, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Suno status ${res.status}: ${data?.msg || JSON.stringify(data).slice(0, 200)}`);
  }
  // Format de réponse attendu : data.data.status + data.data.response.sunoData[]
  const info = data?.data || {};
  const status = info.status || "UNKNOWN";
  const tracks = info?.response?.sunoData || info?.response?.data || [];
  return { status, tracks, raw: data };
}

/**
 * Soumet puis polle jusqu'à complétion (ou timeout).
 * @param {object} params - paramètres de génération
 * @param {number} maxMs  - timeout total (défaut 5 min)
 * @param {number} pollMs - intervalle de polling (défaut 5 s)
 */
export async function sunoGenerate(params, { maxMs = 300_000, pollMs = 5000 } = {}) {
  const { taskId } = await sunoSubmit(params);
  const start = Date.now();

  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    let info;
    try {
      info = await sunoStatus(taskId);
    } catch (e) {
      // Erreur réseau temporaire : on retente
      continue;
    }
    const s = String(info.status || "").toUpperCase();
    if (s === "SUCCESS" || s === "COMPLETE" || s === "FIRST_SUCCESS" || s === "TEXT_SUCCESS") {
      // Première piste prête
      if (info.tracks?.length > 0 && info.tracks.some((t) => t.audioUrl || t.audio_url)) {
        return {
          taskId,
          tracks: info.tracks.map((t) => ({
            id:        t.id,
            title:     t.title,
            audioUrl:  t.audioUrl  || t.audio_url,
            imageUrl:  t.imageUrl  || t.image_url,
            duration:  t.duration,
            tags:      t.tags
          }))
        };
      }
    }
    if (s.includes("FAIL") || s === "ERROR") {
      throw new Error(`Suno génération échouée : ${s}`);
    }
  }

  throw new Error("Suno : timeout (génération > 5 min)");
}
