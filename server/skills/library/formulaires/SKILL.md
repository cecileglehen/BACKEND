---
name: formulaires
description: Formulaires avec validation (contact, inscription, checkout). À utiliser pour "formulaire", "form", "validation", "inscription", "contact".
triggers: formulaire, form, validation, inscription, contact, input, champ
---
# Skill : Formulaires

## HTML
- `<form novalidate>` + validation JS custom ; `<label for>` lié à chaque champ ; `autocomplete` correct (email, name, tel).
- Types justes : email, tel, url, number → clavier mobile adapté.

## Validation UX
- Valider au `blur` (pas à chaque frappe), revalider à l'`input` UNIQUEMENT si déjà en erreur.
- Message d'erreur SOUS le champ, rouge, précis ("Email invalide — il manque le @"), `aria-describedby` + `aria-invalid`.
- Submit : désactiver le bouton pendant l'envoi + spinner + texte "Envoi…" ; message de succès inline (pas d'alert()).

## Regex utiles
- Email : `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`
- Ne JAMAIS bloquer un copier-coller ; trim() avant validation.
