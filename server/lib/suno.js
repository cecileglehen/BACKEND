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
  // callBackUrl est OBLIGATOIRE pour Suno même si on poll
  // On met un placeholder ; Suno appellera l'URL mais on n'écoute pas
  const callBackUrl = params.callBackUrl || process.env.SUNO_CALLBACK_URL || "https://api.delt.ai/api/suno/callback";

  const body = {
    customMode:   params.customMode ?? true,
    instrumental: params.instrumental ?? false,
    model:        params.model || "V5_5",
    prompt:       String(params.prompt || "").slice(0, 3000),
    style:        params.style || "Pop",
    title:        params.title || "DELT AI Track",
    callBackUrl,
    ...(params.personaId    && { personaId: params.personaId }),
    ...(params.personaModel && { personaModel: params.personaModel }),
    ...(params.negativeTags && { negativeTags: params.negativeTags }),
    ...(params.vocalGender  && { vocalGender: params.vocalGender }),
    ...(Number.isFinite(params.styleWeight)         && { styleWeight: params.styleWeight }),
    ...(Number.isFinite(params.weirdnessConstraint) && { weirdnessConstraint: params.weirdnessConstraint }),
    ...(Number.isFinite(params.audioWeight)         && { audioWeight: params.audioWeight })
  };

  const res = await fetch(`${SUNO_BASE}/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));

  // Suno renvoie HTTP 200 même en cas d'erreur ; le vrai status est dans data.code
  if (!res.ok || (data?.code && data.code !== 200)) {
    const msg = data?.msg || data?.message || JSON.stringify(data).slice(0, 200);
    throw new Error(`Suno ${data?.code || res.status}: ${msg}`);
  }

  const taskId = data?.data?.taskId || data?.taskId || data?.data?.task_id;
  if (!taskId) {
    throw new Error(`Suno : pas de taskId retourné — réponse : ${JSON.stringify(data).slice(0, 300)}`);
  }
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
  if (!res.ok || (data?.code && data.code !== 200)) {
    throw new Error(`Suno status ${data?.code || res.status}: ${data?.msg || JSON.stringify(data).slice(0, 200)}`);
  }
  const info = data?.data || {};
  const status = info.status || "UNKNOWN";
  const tracks = info?.response?.sunoData || info?.response?.data || [];
  return { status, tracks, raw: data };
}

/**
 * Soumet puis polle jusqu'à complétion (ou timeout).
 * @param {object} params - paramètres de génération
 * @param {number} maxMs  - timeout total (défaut 7 min)
 * @param {number} pollMs - intervalle de polling (défaut 5 s)
 */
export async function sunoGenerate(params, { maxMs = 420_000, pollMs = 5000 } = {}) {
  const { taskId } = await sunoSubmit(params);
  console.log("[suno] taskId:", taskId);
  const start = Date.now();
  let lastStatus = "";

  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    let info;
    try {
      info = await sunoStatus(taskId);
    } catch (e) {
      console.warn("[suno] polling error (retry):", e.message);
      continue;
    }
    const s = String(info.status || "").toUpperCase();
    if (s !== lastStatus) {
      console.log("[suno] status →", s, "| tracks:", info.tracks?.length || 0);
      lastStatus = s;
    }

    // Échec explicite
    if (s.includes("FAIL") || s === "ERROR" || s.includes("SENSITIVE")) {
      throw new Error(`Suno génération échouée : ${s}`);
    }

    // Vérifie si des pistes sont prêtes (audioUrl OU streamAudioUrl)
    const ready = (info.tracks || []).filter((t) =>
      t.audioUrl || t.audio_url || t.streamAudioUrl || t.stream_audio_url || t.source_audio_url
    );

    // SUCCESS / FIRST_SUCCESS / COMPLETE : on accepte dès qu'on a des pistes lisibles
    if (ready.length > 0 && (s === "SUCCESS" || s === "COMPLETE" || s === "FIRST_SUCCESS" || s === "TEXT_SUCCESS")) {
      console.log("[suno] ✓ génération terminée (" + ready.length + " pistes)");
      return {
        taskId,
        tracks: ready.map((t) => ({
          id:        t.id,
          title:     t.title || t.songName,
          audioUrl:  t.audioUrl || t.audio_url || t.streamAudioUrl || t.stream_audio_url || t.source_audio_url,
          imageUrl:  t.imageUrl || t.image_url || t.sourceImageUrl,
          duration:  t.duration,
          tags:      t.tags
        }))
      };
    }
  }

  throw new Error("Suno : timeout (génération > 7 min)");
}
