---
name: seo
description: Référencement d'un site (balises, Open Graph, performance). À utiliser pour "SEO", "Google", "référencement", ou toute landing publique.
triggers: seo, référencement, google, sitemap, open graph, og:, meta description
---
# Skill : SEO

## Head minimal obligatoire
- `<title>` unique 50-60 car. avec le mot-clé principal ; `<meta name="description">` 150-160 car. orientée bénéfice.
- Open Graph : og:title, og:description, og:image (1200x630), og:url + twitter:card summary_large_image.
- `<link rel="canonical">`, `<html lang="fr">`.

## Structure
- 1 seul h1 (mot-clé), h2 pour les sections. URLs courtes avec tirets.
- Images : alt descriptif, loading="lazy" sous la ligne de flottaison, formats modernes.
- JSON-LD si pertinent (Organization, Product, FAQ).

## Performance = SEO
- LCP < 2.5s : hero image préchargée (`fetchpriority="high"`), pas de font-display bloquant (`font-display: swap`).
- Zéro layout shift : dimensions sur images/embeds.
