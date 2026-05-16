// Parsing des pièces jointes : images, PDFs, texte
import { getPlanLimits } from "../config/plans.js";

const IMAGE_MIMES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/gif",
  "image/webp", "image/heic", "image/heif"
]);

const TEXT_MIMES = new Set([
  "text/plain", "text/markdown", "text/csv", "text/html",
  "application/json", "application/xml", "text/xml",
  "text/javascript", "application/javascript",
  "text/x-python", "text/x-c", "text/x-c++", "text/x-java"
]);

const PDF_MIME = "application/pdf";

/**
 * Traite un buffer de fichier selon son type.
 * @param {Buffer} buffer
 * @param {object} file { mimetype, originalname, size }
 * @param {string} plan
 * @returns {Promise<{type, name, mime, dataUrl?, text?, pageCount?}>}
 */
export async function parseAttachment(buffer, file, plan = "FREE") {
  const limits = getPlanLimits(plan);
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

  if (buffer.length > maxBytes) {
    throw new Error(
      `Fichier trop volumineux (${(buffer.length / 1024 / 1024).toFixed(1)} MB). ` +
      `Plan ${plan} : max ${limits.maxFileSizeMB} MB par fichier.`
    );
  }

  const mime = String(file.mimetype || "").toLowerCase();
  const name = String(file.originalname || "fichier").slice(0, 200);

  // ─── Image ──────────────────────────────────────────────────
  if (IMAGE_MIMES.has(mime)) {
    const base64 = buffer.toString("base64");
    return {
      type: "image",
      name,
      mime,
      dataUrl: `data:${mime};base64,${base64}`,
      size: buffer.length
    };
  }

  // ─── PDF ────────────────────────────────────────────────────
  if (mime === PDF_MIME || name.toLowerCase().endsWith(".pdf")) {
    const { default: pdfParse } = await import("pdf-parse");
    const data = await pdfParse(buffer, { max: limits.pdfMaxPages });
    const totalPages = data.numpages || 0;
    const readPages = Math.min(totalPages, limits.pdfMaxPages);
    let text = String(data.text || "").trim();

    if (totalPages > limits.pdfMaxPages) {
      text += `\n\n[… PDF tronqué : ${totalPages - limits.pdfMaxPages} pages non lues. Plan ${plan} : max ${limits.pdfMaxPages} pages. Passe à un plan supérieur pour lire le PDF entier.]`;
    }
    return {
      type: "pdf",
      name,
      mime,
      text: text.slice(0, 200_000),
      pageCount: totalPages,
      readPages,
      size: buffer.length
    };
  }

  // ─── Texte / code ───────────────────────────────────────────
  // Extensions explicitement reconnues (couvre la majorité des langages/configs)
  const TEXT_EXT_REGEX = /\.(txt|md|mdx|rst|tex|bib|csv|tsv|log|json|jsonc|jsonl|ndjson|xml|yaml|yml|toml|ini|env|conf|cfg|properties|editorconfig|html?|css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|vue|svelte|astro|py|pyw|rb|php|pl|pm|lua|r|jl|c|h|cpp|hpp|cc|hh|cxx|cs|java|kt|kts|scala|go|rs|swift|dart|m|mm|sh|bash|zsh|fish|ps1|bat|cmd|sql|graphql|gql|proto|prisma|dockerfile|makefile|mk|gradle|sbt|cmake|nim|zig|v|vb|fs|fsx|ml|mli|ex|exs|elm|erl|hs|clj|cljs|asm|s|srt|vtt)$/i;

  const looksTextual = (buf) => {
    // Heuristique : UTF-8 décodable + ratio de caractères imprimables élevé sur les 4 premiers KB
    const sample = buf.subarray(0, Math.min(buf.length, 4096));
    try {
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(sample);
      // null bytes ou ratio > 5% de caractères de contrôle = binaire
      if (decoded.indexOf("\x00") !== -1) return false;
      let ctrl = 0;
      for (const c of decoded) {
        const code = c.charCodeAt(0);
        if (code < 9 || (code > 13 && code < 32) || code === 127) ctrl++;
      }
      return ctrl / decoded.length < 0.05;
    } catch { return false; }
  };

  if (TEXT_MIMES.has(mime) || mime.startsWith("text/") || TEXT_EXT_REGEX.test(name) || looksTextual(buffer)) {
    const text = buffer.toString("utf8").slice(0, 200_000);
    return {
      type: "text",
      name,
      mime: mime || "text/plain",
      text,
      size: buffer.length
    };
  }

  throw new Error(`Type de fichier non supporté : ${mime || name}`);
}

/**
 * Transforme une liste d'attachements en parts compatibles OpenRouter (chat completion).
 * Les images deviennent des parts image_url, les textes/PDFs sont concaténés en préfixe.
 */
export function buildMessageContent(text, attachments = []) {
  if (!attachments.length) return text;

  const images = attachments.filter((a) => a.type === "image");
  const textBlocks = attachments.filter((a) => a.type !== "image");

  // Préfixe le message avec le contenu des PDFs/textes
  let prefix = "";
  for (const att of textBlocks) {
    const label = att.type === "pdf"
      ? `📄 PDF "${att.name}" (${att.readPages}/${att.pageCount} pages)`
      : `📎 Fichier "${att.name}"`;
    prefix += `\n\n${label} :\n\`\`\`\n${att.text}\n\`\`\``;
  }

  const fullText = `${prefix ? prefix + "\n\n---\n\n" : ""}${text}`;

  // S'il n'y a que du texte, retourne directement la string
  if (images.length === 0) return fullText;

  // Sinon, retourne un tableau de parts (format vision)
  const parts = [{ type: "text", text: fullText }];
  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: { url: img.dataUrl }
    });
  }
  return parts;
}
