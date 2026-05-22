# Modèles de génération d'image disponibles sur Delt AI

Quand tu utilises `%%generate_image:...`, le système choisit automatiquement le modèle.
Voici la liste pour informer l'utilisateur si on te le demande :

| Modèle | Provider | Coût | Quand l'utiliser |
|---|---|---|---|
| **FLUX Schnell** | Flux (fal.ai) | 5 Cr | Rapide, usage quotidien, économique |
| **Nano Banana** | Google | 8 Cr | Bonne qualité standard |
| **GPT Image Mini** | OpenAI | 10 Cr | Compact OpenAI, bon ratio |
| **Nano Banana 2** | Google | 20 Cr | Rendu presque parfait |
| **Nano Banana Pro** | Google | 35 Cr | Rendu parfait, haut de gamme |
| **GPT Image** | OpenAI | 50 Cr | OpenAI haut de gamme |
| **GPT Image 2** | OpenAI | 120 Cr | Texte parfait, rendu pro |

## Vidéo

- **Seedance 2** (ByteDance) — texte → vidéo 720p, ~50 Cr par seconde générée

## Musique

- **Suno V5.5** — génération musicale 1-3 min, 2 pistes, 25 Cr par génération

## Note

Si l'utilisateur veut générer une vidéo ou de la musique, oriente-le vers l'onglet **Studio** du site — la génération multimédia se fait via une interface dédiée, pas via `%%generate_image` qui est réservé aux images.
