# BFR Chantier — Suivi de Chantier & Rapport Quotidien

Application web mobile **100 % hors connexion**, calquée sur la charte officielle **BFR Systems** de [`BFR_Repport`](https://2kp46mwzkg-lang.github.io/BFR_Repport/), mais conçue spécifiquement pour **piloter la réalisation d'un chantier sur plusieurs jours** :

- **Checklist de tâches par Phases / Lots** (configurable dans l'application, par copier-coller texte, ou par import Excel `.xlsx` / `.csv` / `.json`).
- **Pointage terrain complet au doigt** : case à cocher instantanée (**Fait ce jour**), statuts détaillés (**À faire / En cours / Fait / Bloqué**), motif de blocage/réserve, commentaires vocaux (dictée) et **photos annotées au doigt** (flèche, cercle, crayon, texte).
- **Suivi multi-jours (`Jour 1`, `Jour 2`, `Jour 3`…)** : chaque tâche cochée est rattachée à sa journée de réalisation, et chaque journée dispose de son propre journal (synthèse, horaires/équipe, programme prévu demain, photos d'avancement du jour).
- **Rapport quotidien PDF (et Word `.docx`) « brandé » BFR Systems** (sans signature client chaque soir) prêt à envoyer par e-mail aux personnes concernées par le projet (Client, Chef de projet BFR, Chargé d'affaires, SAV…).

---

## 1. Déploiement sur GitHub Pages (2 minutes)

Comme `BFR_Repport`, le dépôt contient déjà tout ce qu'il faut :

1. Créez un nouveau dépôt sur GitHub (ex. `BFR_Chantier`) et poussez tous les fichiers de ce dossier sur la branche `main`.
2. Sur GitHub, allez dans **Settings → Pages** :
   - **Option A (automatique)** : *Source* → **GitHub Actions** (le workflow `.github/workflows/pages.yml` exécute `python3 build.py` et publie `docs/`).
   - **Option B (directe sans Actions)** : *Source* → **Deploy from a branch** → Branche `main` → Dossier **`/docs`** → *Save* (`docs/` est déjà généré et prêt).
3. Ouvrez l'adresse obtenue (`https://<votre-compte>.github.io/<nom-du-depot>/`) sur votre téléphone :
   - **Android (Chrome)** : Menu **⋮** → **Ajouter à l'écran d'accueil** → *Installer*.
   - **iPhone (Safari)** : Bouton **Partager** → **Sur l'écran d'accueil**.

### Variante sans hébergement (fichier unique)

Le fichier **`Suivi-Chantier-BFR.html`** à la racine contient toute l'application en **un seul fichier HTML autonome** (icônes, logo BFR, moteur PDF, moteur Word et éditeur photo inclus).

---

## 2. Utilisation sur le terrain

1. **☰ → Mes informations** : renseignez une seule fois vos Prénom, Nom, Fonction, Téléphone et E-mail BFR. Ils apparaissent automatiquement dans le bloc *« Votre interlocuteur chantier BFR Systems »* de tous vos rapports.
2. **Configurer le chantier & les destinataires** :
   - Renseignez l'intitulé du chantier, le N° d'affaire, le client, le site et éventuellement le logo du client.
   - Dans **Destinataires**, ajoutez toutes les personnes concernées par le projet (**À** ou **Cc**). Vous pouvez cocher *« Mémoriser aussi pour mes prochains chantiers »* pour vos collègues BFR habituels.
3. **Préparer la liste de tâches** (bouton **Importer** ou **+ Ajouter tâche**) :
   - **Copier-coller** : collez directement une liste depuis un mail ou une note (`# Phase 1` ou `Montage mécanique :` crée automatiquement une phase, `- Tâche` crée une tâche).
   - **Excel / CSV** : importez un fichier `.xlsx` ou `.csv` (colonnes reconnues automatiquement : *Phase, Tâche, Domaine, Statut, Commentaire*). Un modèle CSV vierge est téléchargeable en un clic.
   - **Modèles BFR intégrés** : *Installation & Mise en service ligne BFR*, *Rétrofit machine*, ou *Chantier vierge*.
4. **Au fil de la journée (`Jour 1`, `Jour 2`…)** :
   - Cochez les tâches réalisées en un appui sur la case à gauche (elles sont automatiquement marquées **✓ Fait ce jour**).
   - Appuyez sur une tâche pour la passer **En cours** (`25 % / 50 % / 75 %`), signaler un **Point bloquant / Réserve**, dicter une note technique ou prendre une **photo annotée**.
5. **Chaque soir — Rapport quotidien** :
   - Complétez si besoin le **Journal du Jour** (bouton *✨ Brouillon auto* et *✨ Pré-remplir la suite* disponibles).
   - Vérifiez le rendu avec **👁️ Aperçu PDF** (affiché directement dans l'application), puis appuyez sur **📤 Envoyer le rapport quotidien** : le PDF BFR Systems est joint automatiquement au partage mobile (Gmail / Outlook) avec l'objet, le résumé d'avancement et les destinataires prêts.
   - Le lendemain matin, appuyez sur **`+ Jour`** en haut à droite pour ouvrir la nouvelle journée tout en conservant l'avancement cumulé du chantier !

---

## 3. Reconstruire après modification du code source

Aucune bibliothèque externe n'est requise (Python 3 standard suffit) :

```bash
python3 build.py
```

Cela met à jour simultanément :
- `docs/` (application PWA installable pour GitHub Pages + Service Worker hors-ligne)
- `Suivi-Chantier-BFR.html` (fichier unique autonome)
