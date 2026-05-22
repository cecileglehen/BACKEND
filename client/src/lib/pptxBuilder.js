// Génération de vraies présentations PowerPoint via pptxgenjs.
//
// Format d'entrée : JSON (préféré) ou markdown (fallback).
//
// JSON :
// {
//   "title": "Titre global",
//   "subtitle": "Sous-titre global",
//   "theme": "blue" | "purple" | "green" | "dark",
//   "slides": [
//     { "layout": "cover",        "title": "...", "subtitle": "...", "author": "..." },
//     { "layout": "section",      "title": "Partie 1" },
//     { "layout": "bullets",      "title": "...", "bullets": ["...", "..."] },
//     { "layout": "two-column",   "title": "...", "leftTitle": "...", "leftBullets": [...], "rightTitle": "...", "rightBullets": [...] },
//     { "layout": "quote",        "quote": "...", "author": "..." },
//     { "layout": "stats",        "title": "...", "stats": [{ "value": "26M", "label": "morts URSS" }, ...] },
//     { "layout": "image-text",   "title": "...", "bullets": [...], "imageUrl": "https://..." | null },
//     { "layout": "table",        "title": "...", "table": [["A","B"], ["1","2"]] },
//     { "layout": "conclusion",   "title": "Merci", "subtitle": "Questions ?" }
//   ]
// }
//
// Markdown (fallback) : slides séparées par ---, # titre, ## sous-titre, - bullet

import PptxGenJS from "pptxgenjs";

const THEMES = {
  blue:   { primary: "2563EB", secondary: "1E40AF", accent: "60A5FA",  text: "0F172A", muted: "64748B", bg: "F8FAFC" },
  purple: { primary: "7C3AED", secondary: "5B21B6", accent: "A78BFA",  text: "1E1B4B", muted: "6B7280", bg: "FAF5FF" },
  green:  { primary: "059669", secondary: "047857", accent: "34D399",  text: "064E3B", muted: "6B7280", bg: "F0FDF4" },
  dark:   { primary: "F59E0B", secondary: "D97706", accent: "FBBF24",  text: "F8FAFC", muted: "94A3B8", bg: "0F172A" }
};

function tryParseJson(content) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

// Détecte si le contenu est du **code JS pptxgenjs** plutôt que du JSON/markdown.
// Signal fort : présence de `pptx.addSlide(` ou `new PptxGenJS(`.
function isPptxCode(content) {
  return /pptx\.addSlide\s*\(|new\s+PptxGenJS\s*\(/.test(content);
}

// Exécute le code JS écrit par l'IA dans un scope contrôlé.
// L'IA reçoit un objet `pptx` (instance PptxGenJS), elle ajoute des slides
// dessus, et on appelle `writeFile` derrière.
async function executePptxCode(filename, code) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = filename.replace(/\.pptx$/i, "");
  pptx.author = "Delt AI";

  // Helper async-friendly wrapper. Le code AI peut être sync ou async.
  // On lui donne `pptx` + `PptxGenJS` (au cas où il veut instancier des consts).
  const fn = new Function(
    "pptx",
    "PptxGenJS",
    `return (async () => {\n${code}\n})();`
  );

  await fn(pptx, PptxGenJS);
  await pptx.writeFile({ fileName: filename });

  // Compte les slides ajoutées (heuristique : .slides est interne mais souvent dispo)
  return { slideCount: pptx?.slides?.length || pptx?._slides?.length || 0 };
}

function parseMarkdownAsJson(markdown) {
  const blocks = markdown.split(/^\s*---\s*$/gm).map((b) => b.trim()).filter(Boolean);
  const slides = blocks.map((block, idx) => {
    const lines = block.split("\n");
    let title = "", subtitle = "";
    const bullets = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("# ") && !title) title = line.slice(2).trim();
      else if (line.startsWith("## ") && !subtitle) subtitle = line.slice(3).trim();
      else if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, "").trim());
    }
    if (idx === 0 && bullets.length === 0) {
      return { layout: "cover", title, subtitle };
    }
    return { layout: "bullets", title, subtitle, bullets };
  });
  return { slides };
}

function normalizeData(content) {
  const json = tryParseJson(content);
  if (json) {
    if (Array.isArray(json)) return { slides: json };
    return json;
  }
  return parseMarkdownAsJson(content);
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

const W = 13.333; // LAYOUT_WIDE width (inches)
const H = 7.5;

function addBackground(slide, theme, kind = "light") {
  if (kind === "dark") {
    slide.background = { color: theme.text };
  } else {
    slide.background = { color: "FFFFFF" };
  }
}

function addAccentBar(slide, theme, position = "left") {
  if (position === "left") {
    slide.addShape("rect", { x: 0, y: 0, w: 0.25, h: H, fill: { color: theme.primary } });
  } else if (position === "top") {
    slide.addShape("rect", { x: 0, y: 0, w: W, h: 0.18, fill: { color: theme.primary } });
  }
}

function addFooter(slide, theme, slideNum, total) {
  slide.addText("Delt AI", { x: 0.5, y: H - 0.4, w: 3, h: 0.3, fontSize: 9, color: theme.muted, bold: true, fontFace: "Inter" });
  if (slideNum !== undefined) {
    slide.addText(`${slideNum} / ${total}`, { x: W - 1.8, y: H - 0.4, w: 1.3, h: 0.3, fontSize: 9, color: theme.muted, align: "right", fontFace: "Inter" });
  }
}

// ─── Layouts ────────────────────────────────────────────────────────────────

function renderCover(slide, data, theme) {
  // Fond dégradé via 2 rectangles superposés
  slide.background = { color: theme.primary };
  slide.addShape("rect", { x: 0, y: H * 0.5, w: W, h: H * 0.5, fill: { color: theme.secondary } });

  // Diagonale décorative
  slide.addShape("rect", {
    x: -1, y: H - 1.5, w: W + 2, h: 0.05,
    fill: { color: theme.accent },
    rotate: -3
  });

  slide.addText(data.title || "Présentation", {
    x: 0.8, y: 2.2, w: W - 1.6, h: 2,
    fontSize: 54, bold: true, color: "FFFFFF", fontFace: "Inter"
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 4.3, w: W - 1.6, h: 0.8,
      fontSize: 22, color: "FFFFFF", fontFace: "Inter", italic: true,
      transparency: 20
    });
  }

  if (data.author) {
    slide.addText(data.author, {
      x: 0.8, y: H - 1.2, w: W - 1.6, h: 0.4,
      fontSize: 14, color: "FFFFFF", fontFace: "Inter", transparency: 30
    });
  }

  slide.addText("Delt AI", { x: 0.8, y: H - 0.55, w: 3, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fontFace: "Inter", transparency: 40 });
}

function renderSection(slide, data, theme) {
  slide.background = { color: theme.bg };
  addAccentBar(slide, theme, "left");

  slide.addText(data.title || "", {
    x: 0.8, y: H / 2 - 0.8, w: W - 1.6, h: 1.5,
    fontSize: 48, bold: true, color: theme.primary, fontFace: "Inter"
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: H / 2 + 0.7, w: W - 1.6, h: 0.5,
      fontSize: 18, color: theme.muted, fontFace: "Inter", italic: true
    });
  }
}

function renderBullets(slide, data, theme) {
  addBackground(slide, theme);
  addAccentBar(slide, theme);

  slide.addText(data.title || "", {
    x: 0.7, y: 0.5, w: W - 1.4, h: 0.9,
    fontSize: 32, bold: true, color: theme.text, fontFace: "Inter"
  });

  // Trait de séparation
  slide.addShape("rect", { x: 0.7, y: 1.5, w: 1.2, h: 0.05, fill: { color: theme.primary } });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.7, y: 1.7, w: W - 1.4, h: 0.5,
      fontSize: 16, color: theme.muted, italic: true, fontFace: "Inter"
    });
  }

  const bullets = (data.bullets || []).filter(Boolean);
  if (bullets.length > 0) {
    const yStart = data.subtitle ? 2.5 : 2.0;
    slide.addText(
      bullets.map((b) => ({
        text: typeof b === "string" ? b : b.text || "",
        options: { bullet: { code: "25CF", color: theme.primary } }
      })),
      {
        x: 0.9, y: yStart, w: W - 1.8, h: H - yStart - 0.7,
        fontSize: 20, color: theme.text, fontFace: "Inter",
        paraSpaceAfter: 14, valign: "top"
      }
    );
  }
}

function renderTwoColumn(slide, data, theme) {
  addBackground(slide, theme);
  addAccentBar(slide, theme);

  slide.addText(data.title || "", {
    x: 0.7, y: 0.5, w: W - 1.4, h: 0.9,
    fontSize: 30, bold: true, color: theme.text, fontFace: "Inter"
  });
  slide.addShape("rect", { x: 0.7, y: 1.5, w: 1.2, h: 0.05, fill: { color: theme.primary } });

  const colW = (W - 2) / 2;
  // Left
  if (data.leftTitle) {
    slide.addText(data.leftTitle, {
      x: 0.7, y: 1.9, w: colW, h: 0.5,
      fontSize: 18, bold: true, color: theme.primary, fontFace: "Inter"
    });
  }
  if (data.leftBullets?.length) {
    slide.addText(
      data.leftBullets.map((b) => ({ text: b, options: { bullet: { code: "25AA", color: theme.primary } } })),
      { x: 0.9, y: 2.5, w: colW, h: H - 3.2, fontSize: 16, color: theme.text, fontFace: "Inter", paraSpaceAfter: 10, valign: "top" }
    );
  }
  // Right
  if (data.rightTitle) {
    slide.addText(data.rightTitle, {
      x: 0.9 + colW, y: 1.9, w: colW, h: 0.5,
      fontSize: 18, bold: true, color: theme.primary, fontFace: "Inter"
    });
  }
  if (data.rightBullets?.length) {
    slide.addText(
      data.rightBullets.map((b) => ({ text: b, options: { bullet: { code: "25AA", color: theme.primary } } })),
      { x: 1.1 + colW, y: 2.5, w: colW, h: H - 3.2, fontSize: 16, color: theme.text, fontFace: "Inter", paraSpaceAfter: 10, valign: "top" }
    );
  }
  // Divider vertical
  slide.addShape("rect", { x: W / 2 - 0.02, y: 2.0, w: 0.04, h: H - 3.0, fill: { color: theme.accent } });
}

function renderQuote(slide, data, theme) {
  slide.background = { color: theme.bg };

  // Big quote mark
  slide.addText("“", {
    x: 0.5, y: 0.4, w: 3, h: 3,
    fontSize: 200, color: theme.accent, bold: true, fontFace: "Georgia", transparency: 30
  });

  slide.addText(data.quote || "", {
    x: 1.5, y: 2, w: W - 3, h: 3,
    fontSize: 28, italic: true, color: theme.text, fontFace: "Georgia",
    valign: "middle"
  });

  if (data.author) {
    slide.addText(`— ${data.author}`, {
      x: 1.5, y: H - 1.6, w: W - 3, h: 0.5,
      fontSize: 16, color: theme.primary, bold: true, fontFace: "Inter"
    });
  }
}

function renderStats(slide, data, theme) {
  addBackground(slide, theme);
  addAccentBar(slide, theme, "top");

  slide.addText(data.title || "", {
    x: 0.7, y: 0.5, w: W - 1.4, h: 0.9,
    fontSize: 30, bold: true, color: theme.text, fontFace: "Inter"
  });

  const stats = (data.stats || []).slice(0, 4);
  const cardW = (W - 1.4 - 0.3 * (stats.length - 1)) / Math.max(stats.length, 1);
  stats.forEach((s, i) => {
    const x = 0.7 + i * (cardW + 0.3);
    const y = 2.5;
    slide.addShape("roundRect", {
      x, y, w: cardW, h: 3,
      fill: { color: theme.bg },
      line: { color: theme.accent, width: 1 },
      rectRadius: 0.15
    });
    slide.addText(s.value || "", {
      x: x + 0.2, y: y + 0.4, w: cardW - 0.4, h: 1.4,
      fontSize: 48, bold: true, color: theme.primary, fontFace: "Inter", align: "center"
    });
    slide.addText(s.label || "", {
      x: x + 0.2, y: y + 1.8, w: cardW - 0.4, h: 1,
      fontSize: 14, color: theme.muted, fontFace: "Inter", align: "center"
    });
  });
}

function renderTable(slide, data, theme) {
  addBackground(slide, theme);
  addAccentBar(slide, theme);

  slide.addText(data.title || "", {
    x: 0.7, y: 0.5, w: W - 1.4, h: 0.9,
    fontSize: 30, bold: true, color: theme.text, fontFace: "Inter"
  });

  const rows = (data.table || []).map((row, ri) =>
    row.map((cell) => ({
      text: String(cell ?? ""),
      options: {
        bold: ri === 0,
        color: ri === 0 ? "FFFFFF" : theme.text,
        fill: { color: ri === 0 ? theme.primary : (ri % 2 === 0 ? theme.bg : "FFFFFF") },
        fontSize: ri === 0 ? 14 : 13,
        align: "left",
        valign: "middle",
        margin: 0.1
      }
    }))
  );
  if (rows.length > 0) {
    slide.addTable(rows, {
      x: 0.7, y: 1.8, w: W - 1.4,
      fontFace: "Inter",
      border: { type: "solid", color: theme.accent, pt: 0.5 }
    });
  }
}

function renderImageText(slide, data, theme) {
  addBackground(slide, theme);
  addAccentBar(slide, theme);

  slide.addText(data.title || "", {
    x: 0.7, y: 0.5, w: W - 1.4, h: 0.9,
    fontSize: 30, bold: true, color: theme.text, fontFace: "Inter"
  });
  slide.addShape("rect", { x: 0.7, y: 1.5, w: 1.2, h: 0.05, fill: { color: theme.primary } });

  const colW = (W - 2) / 2;
  // Image à gauche (placeholder si pas d'URL)
  if (data.imageUrl) {
    slide.addImage({ path: data.imageUrl, x: 0.7, y: 1.9, w: colW, h: H - 2.8, sizing: { type: "contain", w: colW, h: H - 2.8 } });
  } else {
    slide.addShape("roundRect", {
      x: 0.7, y: 1.9, w: colW, h: H - 2.8,
      fill: { color: theme.bg },
      line: { color: theme.accent, width: 1 },
      rectRadius: 0.15
    });
    slide.addText("🖼️", { x: 0.7, y: 1.9, w: colW, h: H - 2.8, fontSize: 80, align: "center", valign: "middle" });
  }

  if (data.bullets?.length) {
    slide.addText(
      data.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF", color: theme.primary } } })),
      { x: 1.1 + colW, y: 1.9, w: colW - 0.4, h: H - 2.8, fontSize: 18, color: theme.text, fontFace: "Inter", paraSpaceAfter: 12, valign: "top" }
    );
  }
}

function renderConclusion(slide, data, theme) {
  slide.background = { color: theme.primary };

  slide.addText(data.title || "Merci !", {
    x: 0.8, y: 2.5, w: W - 1.6, h: 1.5,
    fontSize: 64, bold: true, color: "FFFFFF", fontFace: "Inter", align: "center"
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 4.2, w: W - 1.6, h: 0.8,
      fontSize: 24, color: "FFFFFF", italic: true, fontFace: "Inter", align: "center", transparency: 20
    });
  }

  slide.addText("Delt AI · deltai.fr", {
    x: 0.8, y: H - 0.8, w: W - 1.6, h: 0.4,
    fontSize: 12, color: "FFFFFF", align: "center", transparency: 40, fontFace: "Inter"
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function downloadPptx(filename, content) {
  // Mode CODE : l'IA a écrit du JS pptxgenjs brut → on l'exécute directement.
  if (isPptxCode(content)) {
    return executePptxCode(filename, content);
  }

  const data = normalizeData(content);
  const slides = data.slides || [];
  if (slides.length === 0) throw new Error("Aucune slide détectée");

  const theme = THEMES[data.theme] || THEMES.blue;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = filename.replace(/\.pptx$/i, "");
  pptx.author = "Delt AI";

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const layout = s.layout || "bullets";

    switch (layout) {
      case "cover":      renderCover(slide, s, theme); break;
      case "section":    renderSection(slide, s, theme); break;
      case "two-column": renderTwoColumn(slide, s, theme); break;
      case "quote":      renderQuote(slide, s, theme); break;
      case "stats":      renderStats(slide, s, theme); break;
      case "table":      renderTable(slide, s, theme); break;
      case "image-text": renderImageText(slide, s, theme); break;
      case "conclusion": renderConclusion(slide, s, theme); break;
      case "bullets":
      default:           renderBullets(slide, s, theme); break;
    }

    // Footer sur slides intermédiaires (pas cover/conclusion)
    if (layout !== "cover" && layout !== "conclusion") {
      addFooter(slide, theme, i, slides.length - 1);
    }
  });

  await pptx.writeFile({ fileName: filename });
  return { slideCount: slides.length };
}

export function parseForPreview(content) {
  if (isPptxCode(content)) {
    // Mode code : on extrait le nb approximatif d'addSlide() pour info
    const addSlideMatches = content.match(/pptx\.addSlide\s*\(/g) || [];
    return {
      mode: "code",
      codeLines: content.split("\n").length,
      slideCount: addSlideMatches.length,
      theme: "custom"
    };
  }
  const data = normalizeData(content);
  return { mode: "data", slides: data.slides || [], theme: data.theme || "blue", title: data.title };
}
