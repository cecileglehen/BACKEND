---
name: images-utilisateur
description: Intégrer les images IMPORTÉES par l'utilisateur dans son app Launch, notamment via les références @nom (ex. "@wheyvanille"). À utiliser dès qu'un message contient un @référence ou parle d'une image uploadée/importée.
triggers: /@[a-z0-9_-]+/, mon image, ma photo, mon logo, image importée, image uploadée, cette image
---
# Skill : Images importées par l'utilisateur (@références)

## Le système @
- L'utilisateur peut uploader ses propres images dans Launch (glisser-déposer ou trombone).
- Dans son message, il les référence avec `@nom` : « mets @wheyvanille sur la carte produit ».
- La liste EXACTE des images disponibles est fournie dans ton contexte sous
  « Images disponibles (réfère-les via leur URL racine…) » — ce sont les seules qui existent.

## Résolution d'une référence
1. Prends le texte après le `@` (ex. `wheyvanille`).
2. Cherche le fichier correspondant dans la liste (insensible à la casse, ignore tirets/underscores) :
   `@wheyvanille` → `/whey-vanille.png` ou `/WheyVanille.jpg`.
3. Si AUCUNE image ne correspond : dis-le clairement dans le summary
   (« Je ne trouve pas d'image @wheyvanille — uploade-la ou vérifie le nom ») et n'invente JAMAIS un chemin.

## Intégration dans le code
- URL racine absolue : `<img src="/whey-vanille.png" alt="Whey vanille" />` (jamais de chemin relatif ./ ni public/).
- TOUJOURS styler l'image insérée dans la même réponse :
  dimensions ou aspect-ratio fixes, `object-fit: cover`, coins arrondis cohérents avec la DA du projet.
- Produit/carte : image en haut, ratio 4:3 ou 1:1, `width:100%`.
- Logo : hauteur fixe (28-40px), `width:auto`, dans la nav.
- Héro plein écran : `background-image` OU `<img>` + `object-fit:cover; position:absolute; inset:0` avec overlay.
- Ces images sont des binaires SERVIS par Launch : ne tente jamais de les recréer via write_file.

## Ne PAS confondre
- Image utilisateur (@référence, liste « Images disponibles ») → utiliser telle quelle.
- Image à GÉNÉRER par IA (« ajoute une illustration de montagne ») → endpoint /api/launch/img (skill images-ia).
