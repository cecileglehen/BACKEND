import { useState, useRef, useEffect } from "react";

// Map brand name → fichier SVG + label affiché
const BRAND_CONFIG = {
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
  DeepSeek:    { icon: "/brands/deepseek-color.svg",   label: "DeepSeek" },
  Suno:        { icon: null,                           label: "Suno" }
};

function BrandIcon({ brand, size = 16 }) {
  const cfg = BRAND_CONFIG[brand];
  if (!cfg?.icon) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-delt-text text-white text-[9px] font-bold flex-shrink-0"
        style={{ width: size, height: size }}
      >
        {brand.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={cfg.icon}
      alt={brand}
      width={size}
      height={size}
      className="flex-shrink-0"
      style={{ objectFit: "contain" }}
    />
  );
}

function ImageBadge({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

function VideoBadge({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
}

function MusicBadge({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  );
}

function familyModel(brand, models, isFree = false) {
  const cfg = BRAND_CONFIG[brand];
  const first = isFree
    ? (models.find((m) => m.tier === "FREE" || m.freeMonthlyTokens) || models[0] || {})
    : (models.find((m) => m.tier !== "FREE") || models[0] || {});
  return {
    id: `brand:${encodeURIComponent(brand)}`,
    brand,
    display: cfg?.label || brand,
    tier: first.tier || "NANO",
    isBrandFamily: true
  };
}

function PillRow({ brands, selectedId, onSelect, isFree, isImage = false, isVideo = false, isMusic = false, openBrand, setOpenBrand, families }) {
  const isChat = !isImage && !isVideo && !isMusic;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
      {brands.map(([brand, models]) => {
        const cfg = BRAND_CONFIG[brand];
        const label = cfg?.label || brand;
        const pick = isImage || isVideo || isMusic ? models[0] : familyModel(brand, models, isFree);
        const selectedHere = selectedId === pick.id || models.some((m) => m.id === selectedId) || (typeof selectedId === "string" && selectedId.startsWith(`family:${encodeURIComponent(brand)}:`));
        const isLocked = isFree && !isImage && models.every((m) => m.tier !== "FREE" && m.tier !== "UNCENSORED" && !m.freeMonthlyTokens);
        const popKey = `${isMusic ? "mus" : isVideo ? "vid" : isImage ? "img" : "chat"}-${brand}`;
        const brandFamilies = isChat ? (families?.[brand] || []) : [];
        const hasFamilies = brandFamilies.length > 0;
        const showDots = !isLocked && ((isImage || isVideo || isMusic) ? models.length > 1 : hasFamilies);

        return (
          <div key={popKey} className="relative">
            <div
              className={`flex items-center gap-1 rounded-full border transition-colors overflow-hidden ${
                selectedHere
                  ? "bg-delt-text text-white border-delt-text"
                  : isLocked
                  ? "bg-white text-delt-muted/50 border-delt-border opacity-50"
                  : "bg-white text-delt-text border-delt-border hover:bg-delt-surface"
              }`}
            >
              <button
                onClick={() => !isLocked && onSelect(pick)}
                disabled={isLocked}
                className={`flex items-center gap-1.5 py-1 text-xs disabled:cursor-not-allowed ${showDots ? "pl-2.5 pr-1" : "px-2.5"}`}
              >
                <BrandIcon brand={brand} />
                {isImage && <ImageBadge />}
                {isVideo && <VideoBadge />}
                {isMusic && <MusicBadge />}
                <span className="font-medium">{label}</span>
              </button>

              {showDots && (
                <button
                  onClick={() => setOpenBrand(openBrand === popKey ? null : popKey)}
                  className={`pr-2 pl-1 py-1 ${selectedHere ? "text-white/70 hover:text-white" : "text-delt-muted hover:text-delt-text"}`}
                  aria-label={`Choisir famille ${brand}`}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <circle cx="5" cy="12" r="1.6"/>
                    <circle cx="12" cy="12" r="1.6"/>
                    <circle cx="19" cy="12" r="1.6"/>
                  </svg>
                </button>
              )}
              {isLocked && <span className="pr-2 text-[10px]">🔒</span>}
            </div>

            {openBrand === popKey && isChat && hasFamilies && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-72 bg-white rounded-xl border border-delt-border shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-delt-border flex items-center gap-2">
                  <BrandIcon brand={brand} size={18} />
                  <span className="text-sm font-semibold text-delt-text">{label}</span>
                  <span className="text-[10px] text-delt-muted uppercase tracking-wider ml-auto">Familles</span>
                </div>
                <div className="px-3 py-2 text-[11px] text-delt-muted border-b border-delt-border bg-delt-surface/30 leading-snug">
                  Choisis une <strong>famille</strong> — le router pick la version (nano/mini/full/pro) selon la difficulté de ta demande.
                </div>
                <div className="py-1 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => { onSelect(pick); setOpenBrand(null); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selectedId === pick.id ? "bg-indigo-50 text-delt-accent" : "text-delt-text hover:bg-delt-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">🤖 Auto (tout {label})</span>
                      <span className="text-[9px] uppercase tracking-wider text-delt-muted">Router</span>
                    </div>
                    <div className="text-[10px] text-delt-muted mt-0.5">Le routeur choisit librement dans toutes les versions</div>
                  </button>
                  {brandFamilies.map((fam) => {
                    const famId = `family:${encodeURIComponent(brand)}:${fam.id}`;
                    const selFam = selectedId === famId;
                    return (
                      <button
                        key={fam.id}
                        onClick={() => {
                          onSelect({
                            id: famId,
                            brand,
                            display: fam.label,
                            tier: "NORMAL",
                            isFamily: true
                          });
                          setOpenBrand(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors border-t border-delt-border/40 ${
                          selFam ? "bg-indigo-50 text-delt-accent" : "text-delt-text hover:bg-delt-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{fam.label}</span>
                          <span className="text-[9px] uppercase tracking-wider text-delt-muted">{fam.models.length} version{fam.models.length > 1 ? "s" : ""}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {openBrand === popKey && !isChat && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-64 bg-white rounded-xl border border-delt-border shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-delt-border flex items-center gap-2">
                  <BrandIcon brand={brand} size={18} />
                  {isImage && <ImageBadge size={14} />}
                  {isVideo && <VideoBadge size={14} />}
                  <span className="text-sm font-semibold text-delt-text">{label}</span>
                </div>
                <div className="py-1 max-h-72 overflow-y-auto">
                  {models.map((m) => {
                    const sel = selectedId === m.id;
                    const locked = isFree && !isImage && m.tier !== "FREE" && m.tier !== "UNCENSORED" && !m.freeMonthlyTokens;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (locked) return;
                          onSelect(m);
                          setOpenBrand(null);
                        }}
                        disabled={locked}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          sel ? "bg-indigo-50 text-delt-accent" : locked ? "text-delt-muted/50 cursor-not-allowed" : "text-delt-text hover:bg-delt-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{m.display}</span>
                          {locked ? (
                            <span className="text-[10px]">🔒</span>
                          ) : m.tier ? (
                            <span className="text-[9px] uppercase tracking-wider text-delt-muted">{m.tier}</span>
                          ) : null}
                        </div>
                        {m.tagline && (
                          <div className="text-[10px] text-delt-muted mt-0.5 truncate">{m.tagline}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BrandPills({ catalog, selectedId, onSelect, plan, showCreative = true }) {
  const [openBrand, setOpenBrand] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (!popRef.current?.contains(e.target)) setOpenBrand(null);
    };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, []);

  if (!catalog?.categories) return null;
  const isFree = plan === "FREE";

  // Chat: regroupe par marque (préserve l'ordre d'apparition)
  const chatBrandsMap = new Map();
  for (const [tier, cat] of Object.entries(catalog.categories)) {
    for (const m of cat.models) {
      if (!chatBrandsMap.has(m.brand)) chatBrandsMap.set(m.brand, []);
      chatBrandsMap.get(m.brand).push({ ...m, tier });
    }
  }
  const chatBrands = Array.from(chatBrandsMap.entries());

  const imageList = catalog.creative?.IMAGE?.models || [];
  const imageBrandsMap = new Map();
  for (const m of imageList) {
    if (!imageBrandsMap.has(m.brand)) imageBrandsMap.set(m.brand, []);
    imageBrandsMap.get(m.brand).push({ ...m });
  }
  const imageBrands = Array.from(imageBrandsMap.entries());

  const videoList = catalog.creative?.VIDEO?.models || [];
  const videoBrandsMap = new Map();
  for (const m of videoList) {
    if (!videoBrandsMap.has(m.brand)) videoBrandsMap.set(m.brand, []);
    videoBrandsMap.get(m.brand).push({ ...m });
  }
  const videoBrands = Array.from(videoBrandsMap.entries());

  const musicList = catalog.creative?.MUSIC?.models || [];
  const musicBrandsMap = new Map();
  for (const m of musicList) {
    if (!musicBrandsMap.has(m.brand)) musicBrandsMap.set(m.brand, []);
    musicBrandsMap.get(m.brand).push({ ...m });
  }
  const musicBrands = Array.from(musicBrandsMap.entries());

  return (
    <div ref={popRef}>
      <PillRow
        brands={chatBrands}
        selectedId={selectedId}
        onSelect={onSelect}
        isFree={isFree}
        isImage={false}
        openBrand={openBrand}
        setOpenBrand={setOpenBrand}
        families={catalog.families}
      />
      {showCreative && imageBrands.length > 0 && (
        <>
          <div className="flex items-center gap-3 max-w-3xl mx-auto my-5">
            <div className="flex-1 h-px bg-delt-border" />
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-delt-muted font-semibold">
              <ImageBadge size={14} />
              Image
            </span>
            <div className="flex-1 h-px bg-delt-border" />
          </div>
          <PillRow
            brands={imageBrands}
            selectedId={selectedId}
            onSelect={onSelect}
            isFree={isFree}
            isImage={true}
            openBrand={openBrand}
            setOpenBrand={setOpenBrand}
          />
          <div className="max-w-3xl mx-auto mt-3 px-1">
            <div className="text-[11px] text-delt-muted text-center bg-delt-surface rounded-lg px-3 py-2 leading-relaxed">
              <span className="font-semibold text-delt-text">⚠ Conseil :</span>{" "}
              FLUX pour le quotidien · Nano Banana pour la qualité · Nano Banana 2 pour un rendu presque parfait · Nano Banana Pro pour le rendu parfait · GPT Image 2 pour un rendu pro avec texte impeccable.
              <span className="block mt-1 text-delt-muted">Sois précis dans ton prompt (style, sujet, composition, ambiance) pour de meilleurs résultats.</span>
            </div>
          </div>
        </>
      )}
      {showCreative && videoBrands.length > 0 && (
        <>
          <div className="flex items-center gap-3 max-w-3xl mx-auto my-5">
            <div className="flex-1 h-px bg-delt-border" />
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-delt-muted font-semibold">
              <VideoBadge size={14} />
              Vidéo
            </span>
            <div className="flex-1 h-px bg-delt-border" />
          </div>
          <PillRow
            brands={videoBrands}
            selectedId={selectedId}
            onSelect={onSelect}
            isFree={isFree}
            isVideo={true}
            openBrand={openBrand}
            setOpenBrand={setOpenBrand}
          />
        </>
      )}
      {showCreative && musicBrands.length > 0 && (
        <>
          <div className="flex items-center gap-3 max-w-3xl mx-auto my-5">
            <div className="flex-1 h-px bg-delt-border" />
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-delt-muted font-semibold">
              <MusicBadge size={14} />
              Musique
            </span>
            <div className="flex-1 h-px bg-delt-border" />
          </div>
          <PillRow
            brands={musicBrands}
            selectedId={selectedId}
            onSelect={onSelect}
            isFree={isFree}
            isMusic={true}
            openBrand={openBrand}
            setOpenBrand={setOpenBrand}
          />
        </>
      )}
    </div>
  );
}
