# La Bonne Aventure — moteur de réservation directe

Ce dépôt contient **le site** (pages `index` / `extras` / `guide` + `assets/`) **et son
moteur de réservation** maison, synchronisé avec Airbnb, hébergé **gratuitement sur
Cloudflare Pages**. Il remplace le calendrier Smoobu.

## Comment ça marche (vue d'ensemble)

- Le voyageur choisit ses dates sur `index.html` → le prix est calculé côté serveur
  (`60 €/nuit + 45 € de ménage`, 2 nuits min.) → il paie par **Stripe** → sa réservation est
  **confirmée immédiatement** et il reçoit un email.
- **Synchro Airbnb dans les deux sens**, via iCal :
  - **Entrant** : on lit l'iCal d'Airbnb → les dates réservées là-bas apparaissent « occupées » ici.
  - **Sortant** : nos réservations directes sont exposées sur `/calendar.ics` → **à importer
    dans Airbnb** pour bloquer les dates automatiquement.
- **Garde-fou anti double-réservation** : les dates sont bloquées 30 min pendant le paiement,
  et on refait une synchro **live** avec Airbnb juste avant de créer le paiement.

> ⚠️ Limite d'Airbnb (identique à Smoobu) : Airbnb ne relit un calendrier importé que **toutes
> les 2-3 h**. Une double-résa reste possible dans ce court laps de temps.

---

## Prérequis (comptes gratuits)

1. **Cloudflare** — https://dash.cloudflare.com/sign-up
2. **Stripe** — https://dashboard.stripe.com/register (commencer en **mode Test**)
3. **Resend** (emails) — https://resend.com (offre gratuite)
4. Votre **lien iCal Airbnb** : Airbnb → *Calendrier* → *Disponibilité* →
   *Synchroniser les calendriers* → *Exporter le calendrier* → copier l'URL `.ics`.

Installer l'outil en ligne de commande :
```bash
npm install -g wrangler
wrangler login
```

---

## Étape 1 — Base de données D1 + cache KV

```bash
# Base des réservations
wrangler d1 create lba-bookings
#   → copiez le "database_id" affiché dans wrangler.toml (champ database_id)

# Cache du calendrier Airbnb
wrangler kv namespace create CACHE
#   → copiez l'"id" affiché dans wrangler.toml (bloc [[kv_namespaces]])

# Créer les tables
wrangler d1 execute lba-bookings --remote --file=./schema.sql
```

## Étape 2 — Secrets

```bash
wrangler pages secret put AIRBNB_ICAL_URL       # l'URL .ics d'Airbnb
wrangler pages secret put STRIPE_SECRET_KEY      # sk_test_... (puis sk_live_... en prod)
wrangler pages secret put STRIPE_WEBHOOK_SECRET  # whsec_... (voir étape 4)
wrangler pages secret put RESEND_API_KEY         # re_...
```

Les tarifs et emails non secrets se règlent dans `wrangler.toml` (bloc `[vars]`) :
`NIGHTLY_CENTS`, `CLEANING_CENTS`, `MIN_NIGHTS`, `MAX_GUESTS`, `TAXE_CENTS`,
`HOST_EMAIL`, `FROM_EMAIL`.

## Étape 3 — Déploiement

Le plus simple : dans le tableau de bord **Cloudflare Pages → Create project → Connect to Git**,
choisir ce dépôt. Réglages de build :
- *Build command* : (laisser vide)
- *Build output directory* : `/`

Puis, dans **Settings → Functions → Bindings**, rattacher **D1** (`DB` → `lba-bookings`) et
**KV** (`CACHE`). Chaque `git push` redéploie automatiquement.

*(Alternative en ligne de commande : `wrangler pages deploy .`)*

## Étape 4 — Webhook Stripe

1. Stripe → **Développeurs → Webhooks → Ajouter un endpoint**.
2. URL : `https://VOTRE-SITE.pages.dev/api/stripe-webhook`
3. Événements à écouter : `checkout.session.completed` **et** `checkout.session.expired`.
4. Copier le **« Signing secret »** (`whsec_...`) → `wrangler pages secret put STRIPE_WEBHOOK_SECRET`.

## Étape 5 — Emails (Resend)

1. Vérifier votre domaine dans Resend (ou utiliser un domaine de test au début).
2. Régler `FROM_EMAIL` dans `wrangler.toml` avec une adresse de ce domaine
   (ex. `reservation@labonneaventure.fr`). `HOST_EMAIL` reçoit la notification de résa.

## Étape 6 — Brancher Airbnb (les deux sens)

- **Importer nos résas dans Airbnb** : Airbnb → *Calendrier* → *Disponibilité* →
  *Synchroniser les calendriers* → *Importer un calendrier* → coller
  `https://VOTRE-SITE.pages.dev/calendar.ics` → nommer « Réservations directes ».
- **Exporter Airbnb vers nous** : c'est l'URL `.ics` déjà mise dans `AIRBNB_ICAL_URL` (étape 2).

---

## Vos photos

Seules les pages HTML ont été fournies au départ. Déposez vos vraies images dans `assets/`
en **gardant exactement ces noms** (elles s'afficheront automatiquement) :
`aix-aerial.jpg`, `centre-ville.jpg`, `t-emotions.jpg`, `aqualis.jpg`, `chevalley.jpg`,
`parenthese.jpg`, `revard.jpg`. Le logo est déjà recréé en vectoriel
(`logo-light.svg` / `logo-dark.svg`).

## Taxe de séjour

Désactivée par défaut (`TAXE_CENTS=0`, réglée « en supplément » comme aujourd'hui).
Pour l'intégrer au prix, mettre le montant **en centimes par personne et par nuit**
(ex. `TAXE_CENTS="110"` pour 1,10 €).

## Passage en production

Quand tout est validé en mode Test : remplacer les clés Stripe par les clés **live**
(`sk_live_...`) et recréer le **webhook** côté live (nouveau `whsec_...`).

---

## Développement local

```bash
cp .dev.vars.example .dev.vars   # y mettre vos clés de test
wrangler pages dev . --d1 DB=lba-bookings --kv CACHE
```
Carte de test Stripe : `4242 4242 4242 4242`, date future, CVC quelconque.

## Structure du projet

```
index.html / extras.html / guide.html   Site (widget de résa dans index.html)
assets/                                 site.css, booking.css/js, logos SVG, placeholder, photos
functions/
  api/availability.js   GET  dispo + tarifs (Airbnb ⋃ résas)
  api/quote.js          POST devis validé côté serveur
  api/checkout.js       POST re-synchro live + hold 30 min + session Stripe
  api/stripe-webhook.js POST confirmation + emails
  calendar.ics.js       GET  export .ics (à importer dans Airbnb)
  _lib/                  ical.js · pricing.js · db.js
schema.sql                              table bookings (D1)
wrangler.toml                           config Pages + bindings + tarifs
```
