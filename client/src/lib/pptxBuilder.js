// Convertit du markdown structuré en .pptx via pptxgenjs.
// Format attendu (séparateur de slide = "---" sur sa propre ligne) :
//
//   # Titre de la présentation
//   ## Sous-titre optionnel
//
//   ---
//
//   # Slide 1 : Titre
//   - Point 1
//   - Point 2
//   - Point 3
//
//   ---
//
//   # Slide 2
//   ...
//
// Tout texte hors `#`/`##`/`-` devient un paragraphe normal.

import PptxGenJS from "pptxgenjs";

function parseSlides(markdown) {
  const blocks = markdown.split(/^\s*---\s*$/gm).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    let title = "";
    let subtitle = "";
    const bullets = [];
    const paragraphs = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("# ") && !title) title = line.slice(2).trim();
      else if (line.startsWith("## ") && !subtitle) subtitle = line.slice(3).trim();
      else if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, "").trim());
      else if (line && !line.startsWith("#")) paragraphs.push(line);
    }

    return { title, subtitle, bullets, paragraphs };
  });
}

export async function downloadPptx(filename, markdown) {
  const slides = parseSlides(markdown);
  if (slides.length === 0) throw new Error("Aucune slide détectée dans le markdown");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = filename.replace(/\.pptx$/i, "");

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();

    // Background gradient subtil
    slide.background = { color: "FFFFFF" };

    // Bande décorative à gauche
    slide.addShape("rect", {
      x: 0, y: 0, w: 0.3, h: 7.5,
      fill: { color: "2563EB" }
    });

    // Title
    if (s.title) {
      slide.addText(s.title, {
        x: 0.6, y: 0.4, w: 12, h: 1.1,
        fontSize: i === 0 ? 44 : 32,
        bold: true,
        color: "0F172A",
        fontFace: "Calibri"
      });
    }

    // Subtitle
    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.6, y: i === 0 ? 1.6 : 1.5, w: 12, h: 0.8,
        fontSize: i === 0 ? 24 : 18,
        color: "475569",
        fontFace: "Calibri",
        italic: true
      });
    }

    // Bullets
    if (s.bullets.length > 0) {
      slide.addText(
        s.bullets.map((t) => ({ text: t, options: { bullet: { code: "25CF" } } })),
        {
          x: 0.8, y: s.subtitle ? 2.6 : 1.9, w: 11.5, h: 4.5,
          fontSize: 20,
          color: "1E293B",
          fontFace: "Calibri",
          paraSpaceAfter: 12
        }
      );
    }

    // Paragraphs (under bullets or alone)
    if (s.paragraphs.length > 0) {
      slide.addText(s.paragraphs.join("\n\n"), {
        x: 0.8,
        y: s.bullets.length > 0 ? 6 : (s.subtitle ? 2.6 : 1.9),
        w: 11.5, h: 1.3,
        fontSize: 16,
        color: "475569",
        fontFace: "Calibri"
      });
    }

    // Footer numéro slide
    if (i > 0) {
      slide.addText(`${i} / ${slides.length - 1}`, {
        x: 11.5, y: 7, w: 1.5, h: 0.3,
        fontSize: 10,
        color: "94A3B8",
        align: "right"
      });
    }

    // Footer "Made with Delt AI"
    slide.addText("Delt AI", {
      x: 0.6, y: 7, w: 3, h: 0.3,
      fontSize: 10,
      color: "94A3B8",
      bold: true
    });
  });

  await pptx.writeFile({ fileName: filename });
  return { slideCount: slides.length };
}
