---
name: paiements-stripe
description: Encaisser des paiements dans une app Launch (Stripe Checkout via le SDK LaunchPay). À utiliser pour "paiement", "vendre", "boutique", "checkout", "stripe", "panier".
triggers: paiement, payer, stripe, checkout, vendre, boutique, panier, commande, prix, acheter
---
# Skill : Paiements (Launch SDK)

## SDK intégré (déjà disponible dans les apps Launch — ne PAS réimplémenter Stripe)
```js
// Ouvre un Stripe Checkout hébergé (redirige automatiquement). amount en CENTIMES.
await LaunchPay.checkout(2900, "Formation CSS", { quantity: 1 });
// Produit PHYSIQUE à livrer → shipping: true (Stripe collecte l'adresse de livraison) :
await LaunchPay.checkout(4900, "T-shirt DELT", { quantity: 2, shipping: true });
```
- Stripe collecte AUTOMATIQUEMENT email, nom, téléphone et adresse de
  facturation — ne code JAMAIS de formulaire d'adresse maison avant paiement.
  Pour un produit à LIVRER, passe `shipping: true` : l'adresse de livraison
  est collectée par Stripe et part dans la base Notion du créateur.
- Après paiement, l'utilisateur revient sur `successUrl` (défaut : page
  courante) → afficher une confirmation (ex: paramètre `?paid=1`).
- Chaque commande payée est journalisée automatiquement (dashboard + Notion) :
  produit, montant, statut, email, nom, téléphone, adresse, ville, CP, pays.

## UX de vente
- Prix TOUJOURS visibles avant le bouton. Bouton : "Acheter — 29 €" (montant dans le CTA).
- Panier simple : tableau localStorage `[{id, label, price, qty}]`, total recalculé à chaque rendu.
- Ne JAMAIS calculer le prix côté client pour l'envoyer tel quel : envoyer les IDs, les montants restent définis dans le code.
