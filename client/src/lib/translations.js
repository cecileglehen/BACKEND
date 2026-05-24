// Toutes les chaînes de l'app : FR + EN.
// Convention de clés : "namespace.key" (genre "navbar.chat", "intro.title").

export const TRANSLATIONS = {

  // ─── Navbar ────────────────────────────────────────────────────────────────
  "navbar.chat":         { fr: "Chat",          en: "Chat" },
  "navbar.code":         { fr: "Code",          en: "Code" },
  "navbar.studio":       { fr: "Studio",        en: "Studio" },
  "navbar.pricing":      { fr: "Tarifs",        en: "Pricing" },
  "navbar.our_model":    { fr: "NOTRE MODÈLE",  en: "OUR MODEL" },
  "navbar.settings":     { fr: "Paramètres",    en: "Settings" },
  "navbar.logout":       { fr: "Déconnexion",   en: "Log out" },
  "navbar.menu":         { fr: "Menu profil",   en: "Profile menu" },

  // ─── /notre-modele (OurModelRoute) ─────────────────────────────────────────
  "ourmodel.badge":           { fr: "MADE IN FRANCE · OPEN BETA",        en: "MADE IN FRANCE · OPEN BETA" },
  "ourmodel.subtitle":        { fr: "Notre modèle propriétaire",         en: "Our proprietary model" },
  "ourmodel.hero_title":      { fr: "Un peu bébête<br />mais français 🇫🇷", en: "A bit dumb<br />but French 🇫🇷" },
  "ourmodel.hero_sub":        { fr: "Soutenez Delt AI dans le développement et la création d'IA !", en: "Support Delt AI in developing and creating AI!" },
  "ourmodel.stat_params":     { fr: "Paramètres",                        en: "Parameters" },
  "ourmodel.stat_params_desc":{ fr: "Entraîné from scratch sur GPU local — pas de fine-tuning externe.", en: "Trained from scratch on a local GPU — no external fine-tuning." },
  "ourmodel.stat_ctx":        { fr: "Contexte",                          en: "Context" },
  "ourmodel.stat_ctx_desc":   { fr: "Petite fenêtre, ultra rapide, conçu pour la conversation courte.", en: "Small window, ultra-fast, designed for short conversations." },
  "ourmodel.stat_delt":       { fr: "DELT",                              en: "DELT" },
  "ourmodel.stat_delt_desc":  { fr: "Architecture, tokenizer, dataset — tout est maison.", en: "Architecture, tokenizer, dataset — everything in-house." },
  "ourmodel.why_title":       { fr: "Pourquoi un modèle si petit ?",     en: "Why such a tiny model?" },
  "ourmodel.why_body":        { fr: "Parce qu'on commence quelque part. DELT 33M, c'est notre première brique d'IA souveraine : on apprend à entraîner, à servir, à scaler. C'est imparfait, parfois drôle, parfois confus — mais c'est <strong>le nôtre</strong>. Chaque abonnement Delt AI finance la prochaine version (100M, 500M, 1B…).", en: "Because you have to start somewhere. DELT 33M is our first sovereign-AI building block: we're learning to train, serve, and scale. It's imperfect, sometimes funny, sometimes confused — but it's <strong>ours</strong>. Every Delt AI subscription funds the next version (100M, 500M, 1B…)." },
  "ourmodel.test_badge":      { fr: "Live",                              en: "Live" },
  "ourmodel.test_title":      { fr: "Teste-le maintenant",               en: "Try it now" },
  "ourmodel.test_desc":       { fr: "Envoie un prompt à DELT 33M directement depuis cette page. Réponse en streaming, gratuit.", en: "Send a prompt to DELT 33M directly from this page. Streaming response, free." },
  "ourmodel.test_placeholder":{ fr: "Ex: Hello, who are you?",           en: "e.g. Hello, who are you?" },
  "ourmodel.test_send":       { fr: "Envoyer",                           en: "Send" },
  "ourmodel.test_loading":    { fr: "Génère…",                           en: "Generating…" },
  "ourmodel.test_thinking":   { fr: "DELT réfléchit…",                   en: "DELT is thinking…" },
  "ourmodel.test_warning":    { fr: "⚠ Le modèle parle surtout anglais et peut sortir n'importe quoi — c'est bébête mais c'est nous.", en: "⚠ The model speaks mostly English and can output anything — it's silly but it's ours." },
  "ourmodel.support_badge":   { fr: "🇫🇷 Soutiens un LLM 100% français", en: "🇫🇷 Support a 100% French LLM" },
  "ourmodel.support_title":   { fr: "Aide-nous à passer de 33M → 750M",  en: "Help us go from 33M → 750M" },
  "ourmodel.support_body":    { fr: "GPU, dataset, formation : il nous faut <strong>~5000€</strong> pour la prochaine génération. Chaque euro va directement dans le compute d'entraînement.", en: "GPU, dataset, training: we need <strong>~€5000</strong> for the next generation. Every euro goes straight to training compute." },
  "ourmodel.support_free":    { fr: "Libre",                             en: "Custom" },
  "ourmodel.support_secure":  { fr: "Paiement 100% sécurisé via PayPal · Reçu par email", en: "100% secure payment via PayPal · Receipt by email" },
  "ourmodel.cta_billing":     { fr: "Ou prends un abonnement Delt AI",   en: "Or get a Delt AI subscription" },
  "ourmodel.cta_billing_sub": { fr: "Chaque crédit acheté finance aussi les prochains modèles maison.", en: "Every credit purchased also funds the next in-house models." },

  // ─── /intro ────────────────────────────────────────────────────────────────
  "intro.welcome":           { fr: "🎉 Bienvenue {{plan}}",              en: "🎉 Welcome {{plan}}" },
  "intro.title":             { fr: "Tout Delt AI<br />en 5 minutes",     en: "All of Delt AI<br />in 5 minutes" },
  "intro.subtitle":          { fr: "Un guide complet de toutes les fonctionnalités. Clique sur chaque section pour découvrir.", en: "A complete guide to every feature. Click each section to explore." },
  "intro.cta_title":         { fr: "Prêt à commencer ?",                 en: "Ready to start?" },
  "intro.cta_sub":           { fr: "Tu as tout entre les mains. À toi de jouer.", en: "You've got everything you need. Time to play." },
  "intro.cta_button":        { fr: "Aller au chat",                      en: "Go to chat" },
  "intro.help_prefix":       { fr: "Besoin d'aide ?",                    en: "Need help?" },
  "intro.help_settings":     { fr: "Paramètres",                         en: "Settings" },
  "intro.help_ourmodel":     { fr: "Notre modèle",                       en: "Our model" },
  "intro.help_pricing":      { fr: "Tarifs",                             en: "Pricing" },

  // ─── /thanks ───────────────────────────────────────────────────────────────
  "thanks.title":            { fr: "Merci 🇫🇷",                         en: "Thank you 🇫🇷" },
  "thanks.body":             { fr: "Ton don nous aide concrètement à entraîner la prochaine génération de DELT.", en: "Your donation directly helps us train the next generation of DELT." },
  "thanks.body_emphasis":    { fr: "Chaque euro = du GPU pour faire grossir notre IA.", en: "Every euro = GPU time to grow our AI." },
  "thanks.step_today":       { fr: "Aujourd'hui",                        en: "Today" },
  "thanks.step_next":        { fr: "Prochaine étape",                    en: "Next step" },
  "thanks.step_goal":        { fr: "Objectif",                           en: "Goal" },
  "thanks.cta_back":         { fr: "Retour à DELT 33M",                  en: "Back to DELT 33M" },
  "thanks.cta_chat":         { fr: "Aller au chat",                      en: "Go to chat" },
  "thanks.receipt":          { fr: "Tu recevras ton reçu PayPal par email dans quelques minutes.", en: "You'll receive your PayPal receipt by email in a few minutes." },

  // ─── /goodbye ──────────────────────────────────────────────────────────────
  "goodbye.title":           { fr: "Pas de souci !",                     en: "No worries!" },
  "goodbye.body":            { fr: "Le don a été annulé.",               en: "The donation was cancelled." },
  "goodbye.body_emphasis":   { fr: "Tu peux nous soutenir autrement 💙",  en: "You can still support us differently 💙" },
  "goodbye.alt_share":       { fr: "Partage Delt AI",                    en: "Share Delt AI" },
  "goodbye.alt_share_desc":  { fr: "Parle-en à tes amis, sur les réseaux. La pub gratuite c'est précieux.", en: "Tell your friends, share on socials. Free word-of-mouth is gold." },
  "goodbye.alt_sub":         { fr: "Prends un abonnement",               en: "Get a subscription" },
  "goodbye.alt_sub_desc":    { fr: "Chaque crédit finance aussi l'entraînement des prochains modèles.", en: "Every credit also funds training for the next models." },
  "goodbye.cta_retry":       { fr: "Réessayer le don",                   en: "Try donating again" },
  "goodbye.cta_billing":     { fr: "Voir les abonnements",               en: "View subscriptions" },
  "goodbye.cta_chat":        { fr: "Retour au chat",                     en: "Back to chat" },
  "goodbye.note":            { fr: "Aucun débit n'a été effectué.",      en: "No charge was made." },

  // ─── Composer ──────────────────────────────────────────────────────────────
  "composer.auto":           { fr: "Auto",                               en: "Auto" },
  "composer.model":          { fr: "Modèle",                             en: "Model" },
  "composer.send":           { fr: "Envoyer",                            en: "Send" },
  "composer.stop":           { fr: "Stop",                               en: "Stop" },
  "composer.deep_search":    { fr: "Deep Search",                        en: "Deep Search" },
  "composer.debate":         { fr: "Débat",                              en: "Debate" },
  "composer.debate_active":  { fr: "Débat actif",                        en: "Debate on" },
  "composer.tools_title":    { fr: "Outils connectés",                   en: "Connected tools" },
  "composer.tools_desc":     { fr: "Active ce que l'IA peut utiliser dans ce chat", en: "Enable what the AI can use in this chat" },
  "composer.tools_empty":    { fr: "Aucune intégration connectée",       en: "No integrations connected" },
  "composer.tools_connect":  { fr: "Connecter une app →",                en: "Connect an app →" },
  "composer.tools_authorized":{fr: "✓ Autorisé pour ce chat",            en: "✓ Allowed in this chat" },
  "composer.tools_inactive": { fr: "Inactif",                            en: "Inactive" },
  "composer.tools_footer":   { fr: "Apps activées → l'IA peut les appeler dans ce chat", en: "Enabled apps → the AI can call them in this chat" },

  // ─── BrandPills ────────────────────────────────────────────────────────────
  "pills.collapse":          { fr: "− Masquer",                          en: "− Hide" },
  "pills.expand":            { fr: "+ Modèles",                          en: "+ Models" },
  "pills.auto_brand":        { fr: "🤖 Auto (tout {{brand}})",           en: "🤖 Auto (all {{brand}})" },
  "pills.auto_brand_desc":   { fr: "Le routeur choisit librement dans toutes les versions", en: "The router picks freely from all versions" },
  "pills.family_header":     { fr: "Familles",                           en: "Families" },
  "pills.family_hint":       { fr: "Choisis une famille — le router pick la version (nano/mini/full/pro) selon la difficulté de ta demande.", en: "Pick a family — the router selects the version (nano/mini/full/pro) based on request difficulty." },

  // ─── Errors & toasts ───────────────────────────────────────────────────────
  "err.conv_not_owned":      { fr: "Cette conversation n'existe pas ou ne t'appartient pas.", en: "This conversation doesn't exist or isn't yours." },
  "err.generic":             { fr: "Erreur",                             en: "Error" },

  // ─── Settings ──────────────────────────────────────────────────────────────
  "settings.title":          { fr: "Paramètres",                         en: "Settings" },
  "settings.subtitle":       { fr: "Compte, API, documentation et confidentialité.", en: "Account, API, documentation and privacy." },
  "settings.account":        { fr: "Compte",                             en: "Account" },
  "settings.memory":         { fr: "Mémoire",                            en: "Memory" },
  "settings.models":         { fr: "Modèles",                            en: "Models" },
  "settings.integrations":   { fr: "Intégrations",                       en: "Integrations" },
  "settings.usage":          { fr: "Utilisation",                        en: "Usage" },
  "settings.api":            { fr: "API",                                en: "API" },
  "settings.docs":           { fr: "Docs",                               en: "Docs" },
  "settings.privacy":        { fr: "Confidentialité",                    en: "Privacy" },
  "settings.language":       { fr: "Langue",                             en: "Language" },
  "settings.language_fr":    { fr: "Français",                           en: "French" },
  "settings.language_en":    { fr: "Anglais",                            en: "English" }
};
