// Génération d'image unifiée : route fal.ai (FLUX) ou OpenRouter (Gemini/GPT image)
// selon le provider du modèle. Utilisé par le chat ET par Launch.
import { CREATIVE } from "../config/models.js";

// Modèles d'image autorisés dans Launch — plafonné à « Nano Banana 2 »
// (on exclut Nano Banana Pro, GPT Image et GPT Image 2, trop chers pour un app-builder).
export const LAUNCH_IMAGE_MODEL_IDS = [
  "fal-ai/fast-sdxl",
  "fal-ai/flux-1/schnell",
  "google/gemini-2.5-flash-image",
  "openai/gpt-5-image-mini",
  "google/gemini-3.1-flash-image-preview"
];

// Modèle d'édition image-à-image (à partir de pièces jointes @référencées)
export const SEEDREAM_EDIT_ID = "fal-ai/bytedance/seedream/v5/lite/edit";

export function launchImageModels() {
  return CREATIVE.IMAGE.models.filter((m) => LAUNCH_IMAGE_MODEL_IDS.includes(m.id));
}

// Renvoie le modèle d'image autorisé pour Launch (sinon FLUX Schnell par défaut).
export function resolveLaunchImageModel(modelId) {
  const id = LAUNCH_IMAGE_MODEL_IDS.includes(String(modelId)) ? modelId : "fal-ai/flux-1/schnell";
  return CREATIVE.IMAGE.models.find((m) => m.id === id) || CREATIVE.IMAGE.models[0];
}

// Génère une image et renvoie { url }. `model` = objet du catalogue CREATIVE.IMAGE.
export async function generateImage(model, prompt, options = {}) {
  const m = typeof model === "string"
    ? CREATIVE.IMAGE.models.find((x) => x.id === model) || CREATIVE.IMAGE.models[0]
    : model;
  if (m.provider === "fal") {
    const { falGenerateImage } = await import("./fal.js");
    const result = await falGenerateImage(m.id, prompt, { imageUrls: options.imageUrls });
    return { url: result?.url || null };
  }
  // OpenRouter (Gemini Nano Banana, GPT Image…)
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY manquante");
  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://delt.ai",
      "X-Title": "DELT AI"
    },
    body: JSON.stringify({
      model: m.id,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image"]
    })
  });
  if (!orRes.ok) {
    const txt = await orRes.text().catch(() => "");
    throw new Error(`OpenRouter ${orRes.status}: ${txt.slice(0, 200)}`);
  }
  const data = await orRes.json();
  return { url: data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null };
}
