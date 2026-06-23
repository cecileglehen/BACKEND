=== INTÉGRATION NOTION (créateur) ===

L'app peut lire/écrire dans le Notion du créateur via le SDK déjà présent (src/launch.js).
Importe-le : import { LaunchIntegrations } from "./launch.js"
Toutes les méthodes sont async et renvoient { ok: true, data } ou { ok: false, error }.
Best-effort : enveloppe-les en try/catch, n'affiche JAMAIS d'erreur Notion à l'utilisateur final.

PAIEMENTS : déjà journalisés AUTOMATIQUEMENT côté serveur à chaque commande payée.
Ne les re-journalise JAMAIS dans le code de l'app (doublon).

──────────── COMMANDES DISPONIBLES ────────────

const N = LaunchIntegrations.notion;

1) Créer une page (titre + corps markdown). Va dans la page/base configurée par le créateur.
   await N.log("Nouvelle inscription", "**Email :** " + email);

2) Créer une base (tableau) avec ses colonnes.
   columns = liste de { name, type }. Types : title, rich_text, number, select,
   multi_select, status, date, email, checkbox, url, phone_number.
   ⚠️ Exactement UNE colonne de type 'title' est obligatoire.
   await N.createDatabase(pageParenteId, "Inscriptions", [
     { name: "Nom",    type: "title"  },
     { name: "Email",  type: "email"  },
     { name: "Statut", type: "select" },
     { name: "Date",   type: "date"   }
   ]);
   // → data.id contient l'ID de la base créée (garde-le si tu veux y insérer des lignes).

2b) Ajouter une colonne à une base existante.
   type : rich_text, number, select, date, email, checkbox, url, phone_number…
   await N.addColumn(databaseId, "Adresse", "rich_text");

3) Ajouter une ligne dans une base.
   properties = liste de { name, type, value } — les noms ET types doivent correspondre
   EXACTEMENT au schéma de la base (sensible à la casse). value = chaîne.
   await N.insertRow(databaseId, [
     { name: "Nom",    type: "title",  value: "Marie" },
     { name: "Email",  type: "email",  value: "marie@x.fr" },
     { name: "Statut", type: "select", value: "Nouveau" },
     { name: "Date",   type: "date",   value: new Date().toISOString() }
   ]);

4) Lire les lignes d'une base.
   const r = await N.listRows(databaseId, { page_size: 50 });
   if (r.ok) { /* r.data contient les lignes */ }

5) Mettre à jour une ligne (par son id).
   await N.updateRow(rowId, [{ name: "Statut", type: "select", value: "Traité" }]);

──────────── RÈGLES ────────────
- N'ajoute du code Notion QUE si l'utilisateur le demande explicitement.
- Pour écrire dans une base précise, il faut son ID (créé via createDatabase, ou fourni par l'user).
- Les valeurs de type 'select'/'status' doivent correspondre à une option existante de la colonne.
- La page/base parente doit être partagée avec l'intégration Notion (config côté créateur).
- log() sans base configurée échoue silencieusement — c'est normal.
