// Helper fal.ai pour génération d'image / vidéo
// Auth: header `Authorization: Key <FAL_API_KEY>`

const FAL_BASE = "https://fal.run";

function getKey() {
  const key = (process.env.FAL_API_KEY || "").trim();
  if (!key) throw new Error("FAL_API_KEY manquante");
  return key;
}

// Appel synchrone — ok pour FLUX schnell qui est rapide (~1-2s)
export async function falGenerateImage(modelId, prompt, options = {}) {
  const res = await fetch(`${FAL_BASE}/${modelId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${getKey()}`
    },
    body: JSON.stringify({
      prompt,
      // Image-à-image (modèles "edit" type Seedream) : images de référence en entrée.
      ...(Array.isArray(options.imageUrls) && options.imageUrls.length && { image_urls: options.imageUrls }),
      ...(options.imageSize && { image_size: options.imageSize }),
      ...(options.numImages && { num_images: options.numImages })
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`fal.ai ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url ?? null;
  if (!url) throw new Error("Réponse fal.ai invalide (pas d'URL d'image)");
  return { url, raw: data };
}

// Text-to-speech (MiniMax Speech 2.8, Qwen Audio TTS, MAI Voice…). Le champ
// voix diffère selon le provider — chaque famille a sa propre convention.
export async function falGenerateSpeech(modelId, text, options = {}) {
  const voiceField = options.voiceId
    ? modelId.startsWith("qwen/")
      ? { voice: options.voiceId }
      : { voice_setting: { voice_id: options.voiceId } }
    : {};
  const res = await fetch(`${FAL_BASE}/${modelId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${getKey()}`
    },
    body: JSON.stringify({
      text,
      ...voiceField,
      ...(options.speed && { speed: options.speed })
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`fal.ai ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const url = data?.audio?.url ?? null;
  if (!url) throw new Error("Réponse fal.ai invalide (pas d'URL audio)");
  return { url, raw: data };
}

// Génération vidéo (ex: Seedance 2)
export async function falGenerateVideo(modelId, prompt, options = {}) {
  const res = await fetch(`${FAL_BASE}/${modelId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${getKey()}`
    },
    body: JSON.stringify({
      prompt,
      ...(options.duration && { duration: options.duration }),
      ...(options.resolution && { resolution: options.resolution })
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`fal.ai ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const url = data?.video?.url ?? null;
  if (!url) throw new Error("Réponse fal.ai invalide (pas d'URL vidéo)");
  return { url, raw: data };
}
