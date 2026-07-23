// ─── Source de vérité unique pour les logos + labels de marques ──────────────
// Avant : 7 copies divergentes de BRAND_LOGO dans autant de composants, ce qui
// causait des incohérences (un modèle Qwen/Nova/Kimi avec son logo dans le chat
// mais un cercle générique dans DebateSetup/Usage/etc.).
// Désormais tous les composants importent depuis ce fichier.

export const BRAND_CONFIG = {
  DELT:        { icon: "/logo-delt.svg",               label: "DELT" },
  OpenAI:      { icon: "/brands/openai.svg",           label: "GPT" },
  Anthropic:   { icon: "/brands/claude-color.svg",     label: "Claude" },
  Google:      { icon: "/brands/gemini-color.svg",     label: "Gemini" },
  Mistral:     { icon: "/brands/mistral-color.svg",    label: "Mistral" },
  xAI:         { icon: "/brands/grok.svg",             label: "Grok" },
  Perplexity:  { icon: "/brands/perplexity-color.svg", label: "Perplexity" },
  Meta:        { icon: "/brands/meta-color.svg",       label: "Llama" },
  Venice:      { icon: "/brands/venice-color.svg",     label: "Venice" },
  InclusionAI: { icon: "/brands/antgroup-color.svg",   label: "Inclusion" },
  Recraft:     { icon: "/brands/recraft.svg",          label: "Recraft" },
  Flux:        { icon: "/brands/flux.svg",             label: "FLUX" },
  ByteDance:   { icon: "/brands/bytedance-color.svg",  label: "Seedance" },
  Arcee:       { icon: "/brands/arcee-color.png",      label: "Arcee" },
  Moonshot:    { icon: "/brands/moonshot-color.svg",   label: "Kimi" },
  Nova:        { icon: "/brands/nova-color.svg",       label: "Nova" },
  Qwen:        { icon: "/brands/qwen-color.svg",       label: "Qwen" },
  DeepSeek:    { icon: "/brands/deepseek-color.svg",   label: "DeepSeek" },
  "Z.ai":      { icon: null,                           label: "GLM" },
  Suno:        { icon: null,                           label: "Suno" },
  MiniMax:     { icon: "/brands/minimax-color.svg",     label: "MiniMax" },
  Krea:        { icon: "/brands/krea-color.svg",        label: "Krea" },
  SDXL:        { icon: "/brands/stability-color.svg",   label: "SDXL" },
  Microsoft:   { icon: "/brands/microsoft-color.svg",   label: "Microsoft" }
};

// Map brand → chemin du logo (null filtré). Compatible avec l'usage BRAND_LOGO[brand].
export const BRAND_LOGO = Object.fromEntries(
  Object.entries(BRAND_CONFIG)
    .filter(([, cfg]) => cfg.icon)
    .map(([brand, cfg]) => [brand, cfg.icon])
);

// Map brand → label court (GPT, Claude, Kimi…). Compatible avec BRAND_LABEL[brand].
export const BRAND_LABEL = Object.fromEntries(
  Object.entries(BRAND_CONFIG).map(([brand, cfg]) => [brand, cfg.label])
);

export function brandLogo(brand) {
  return BRAND_CONFIG[brand]?.icon || null;
}

export function brandLabel(brand) {
  return BRAND_CONFIG[brand]?.label || brand;
}

// ─── Intégrations (Composio : Gmail, Slack, Notion…) ────────────────────────
// Couleur de marque pour le mask monochrome quand pas de logo couleur natif.
export const INTEG_BRAND_COLORS = {
  gmail:          "#EA4335",
  googledrive:    "#4285F4",
  googlecalendar: "#4285F4",
  slack:          "#4A154B",
  notion:         "#000000",
  github:         "#181717",
  linear:         "#5E6AD2",
  trello:         "#0079BF",
  discord:        "#5865F2",
  stripe:         "#635BFF"
};

// Logos couleur officiels (PNG/SVG natifs). Si présent → affiché tel quel
// au lieu du mask monochrome avec couleur appliquée.
export const INTEG_COLOR_LOGOS = {
  gmail:          "/brands/gmail-color.png",
  googledrive:    "/brands/googledrive-color.png",
  googlecalendar: "/brands/googlecalendar-color.png",
  slack:          "/brands/slack-color.png"
};
