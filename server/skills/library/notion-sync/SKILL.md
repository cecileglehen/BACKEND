---
name: notion-sync
description: Connecter une app Launch à Notion (journal de commandes, base de données, CRM). À utiliser pour "notion", "base de données", "enregistrer les commandes/leads".
triggers: notion, base de données, crm, journaliser, enregistrer les commandes, leads
---
# Skill : Notion (Launch SDK)

## LA CIBLE EST GÉRÉE AUTOMATIQUEMENT — ne demande JAMAIS l'ID
Le créateur connecte juste son compte Notion (bouton Notion de l'IDE). La base
est ensuite CRÉÉE AUTOMATIQUEMENT par le serveur si elle n'existe pas, et son
ID est stocké côté serveur. Ne demande JAMAIS « envoie-moi l'ID de ta base » ni
« crée une base avec telles colonnes » : passe `null` comme databaseId et le
serveur route vers la cible configurée.
Si le contexte « INTÉGRATION NOTION DU PROJET » indique que la base vient
d'être créée : DONNE SON LIEN à l'utilisateur dans ta réponse.
Il contient aussi les colonnes réelles : utilise EXACTEMENT ces noms et types.
Si Notion n'est pas connecté : dis à l'utilisateur de cliquer sur le bouton
Notion en haut de l'IDE (30 secondes), rien d'autre.

## SDK intégré — actions whitelistées sur le Notion du CRÉATEUR
```js
// Lire les lignes de la base configurée (null = cible du projet) :
const rows = await LaunchIntegrations.notion.listRows(null);
// Insérer dans la base configurée — colonnes = celles du schéma fourni :
await LaunchIntegrations.notion.insertRow(null,
  [{ name: "Nom", type: "title", value: nom }, { name: "Email", type: "email", value: email }]);
// Mettre à jour une ligne :
await LaunchIntegrations.notion.updateRow(rowId, [{ name: "Statut", type: "select", value: "Expédié" }]);
// Page simple dans la cible configurée du projet :
await LaunchIntegrations.notion.createPage("Nouveau lead", "**Email:** " + email);
// Créer une NOUVELLE base (seulement si l'utilisateur le demande explicitement) :
const db = await LaunchIntegrations.notion.createDatabase(parentId, "Leads",
  [{ name: "Nom", type: "title" }, { name: "Email", type: "email" }, { name: "Date", type: "date" }]);
await LaunchIntegrations.notion.insertRow(db.databaseId, [...]);
```

## Règles
- Les commandes payées sont journalisées AUTOMATIQUEMENT (webhook) — ne pas dupliquer.
- Toujours gérer l'échec : `const r = await …; if (!r.ok) console.warn(r.error)` — l'app ne doit JAMAIS planter à cause de Notion.
- Rate-limit : max ~20 actions/min — grouper, ne pas boucler ligne par ligne sur 100 items.
- Types de colonnes valides : title, rich_text, number, select, date, email, url, checkbox.
