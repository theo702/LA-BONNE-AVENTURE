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
- **Garde-fou anti double-réservation** : les dates sont bloquées 3 h pendant le paiement
  (ensuite le calendrier se libère ; le séjour reste visible dans Mon espace jusqu’à
  finalisation ou expiration à J-1),
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
wrangler pages secret put ADMIN_PASSWORD         # mot de passe de la page /admin
wrangler pages secret put ADMIN_SECRET           # une longue chaîne aléatoire (signe le cookie admin)
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

## Étape 6 — Le site comme « channel manager » (hub central)

Le site centralise toutes vos disponibilités. Le principe, pour **chaque** plateforme
(Airbnb, Booking, Abritel…) :

1. **Importer le calendrier du site dans la plateforme** — mais en excluant *cette*
   plateforme, pour ne pas lui renvoyer ses propres dates :
   `https://VOTRE-SITE.pages.dev/calendar.ics?exclude=NOM`
   où `NOM` = le nom de la plateforme (`airbnb`, `booking`, `abritel`…). La plateforme
   bloque alors les résas **directes + toutes les autres plateformes**, sans boucle d'écho.
2. **Importer le calendrier de la plateforme dans le site** — ajoutez son URL `.ics` au
   secret `AIRBNB_ICAL_URL` (plusieurs entrées séparées par des virgules ou retours ligne).

Le **nom** de chaque source est déduit automatiquement de son domaine
(`airbnb.com` → `airbnb`, `booking.com` → `booking`). Pour forcer un nom, utilisez la
syntaxe `nom=url` dans `AIRBNB_ICAL_URL`, ex :

```
airbnb=https://www.airbnb.fr/calendar/ical/XXX.ics, booking=https://ical.booking.com/v1/export?...
```

**Exemple concret** (Airbnb + Booking) :
- Dans **Airbnb**, importez `…/calendar.ics?exclude=airbnb`.
- Dans **Booking**, importez `…/calendar.ics?exclude=booking`.
- `AIRBNB_ICAL_URL` contient les deux URLs d'export (Airbnb **et** Booking).

Ainsi une résa reçue **n'importe où** bloque partout ailleurs, automatiquement.

> Variantes : `…/calendar.ics` (sans paramètre) = **tout** (pratique pour un simple aperçu) ;
> `…/calendar.ics?scope=direct` = uniquement vos résas directes + blocages manuels.

---

## Vos photos

Seules les pages HTML ont été fournies au départ. Déposez vos vraies images dans `assets/`
en **gardant exactement ces noms** (elles s'afficheront automatiquement) :
`aix-aerial.jpg`, `casino.jpg`, `t-emotions.jpg`, `aqualis.jpg`, `chevalley.jpg`,
`parenthese.jpg`, `revard.jpg`. Le logo est déjà recréé en vectoriel
(`logo-light.svg` / `logo-dark.svg`).

## Page d'administration (`/admin`)

Rendez-vous sur `https://VOTRE-SITE.pages.dev/admin.html` et connectez-vous avec
`ADMIN_PASSWORD`. Quatre onglets, sans toucher au code :
- **Réservations** : toutes vos résas directes (dates, voyageur, montant, taxe, statut).
- **Tarifs & réductions** : prix/nuit, ménage, nuits min, voyageurs max ; réduction **hebdo**
  (≥ N nuits), **mensuelle** (≥ N nuits), **dernière minute** (arrivée sous X jours) ;
  réglages de la **taxe de séjour**.
- **Codes promo** : `%` ou montant fixe, validité (dates), séjour minimum, nombre d'usages.
- **Saisons** : un prix/nuit différent (et un min de nuits) sur une période donnée.
- **Blocages** : rendez des dates indisponibles à la main (travaux, séjour perso, résa reçue
  ailleurs). Elles disparaissent du calendrier public **et** sont exportées vers Airbnb via
  `/calendar.ics`.

Toutes ces valeurs sont stockées dans la base D1 (tables `settings`, `promo_codes`,
`season_rates`) et prises en compte immédiatement dans les devis du site.

## Taxe de séjour

Calculée **au réel**, par personne et par nuit :
`min(taux % × prix nuit ÷ nb personnes, plafond) × (1 + taxes additionnelles %)`.
Valeurs par défaut (réglables dans l'admin) : **5 %**, plafond **4,27 €**, additionnelles **+10 %**.
Décochez « Activer la taxe de séjour » dans l'admin pour la laisser « en supplément sur place ».

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
admin.html                              Page d'administration (protégée)
assets/   site.css, booking.css/js, admin.css/js, logos SVG, placeholder, photos
functions/
  api/availability.js   GET  dispo + réglages (Airbnb ⋃ résas)
  api/quote.js          POST devis validé côté serveur (remises, taxe, promo)
  api/checkout.js       POST re-synchro live + hold 3 h + session Stripe
  api/stripe-webhook.js POST confirmation + emails + usage promo
  calendar.ics.js       GET  export .ics (à importer dans Airbnb)
  api/admin/            login/logout/bookings/settings/promos/seasons (+ _middleware)
  _lib/                 ical.js · pricing.js · db.js · auth.js
schema.sql              tables bookings · settings · promo_codes · season_rates (D1)
wrangler.toml           config Pages + bindings + valeurs initiales
```

> Après un changement de `schema.sql`, ré-exécutez :
> `wrangler d1 execute lba-bookings --remote --file=./schema.sql` (les tables existantes sont
> conservées ; seules les nouvelles sont créées).

## Rappels « séjour en attente »

Les voyageurs qui ont commencé une réservation sans payer reçoivent un email de rappel
**une fois par semaine**. Dès la **veille de l’arrivée**, le séjour pending est annulé
automatiquement (plus d’email, disparition de *Mon espace*).

1. Créez le secret Cloudflare :
   ```bash
   wrangler pages secret put CRON_SECRET
   ```
2. Ajoutez le **même** secret `CRON_SECRET` dans GitHub → Settings → Secrets
   (le workflow `.github/workflows/pending-reminders.yml` tourne chaque lundi).
3. Test manuel :
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     https://labonneaventure-aixlesbains.fr/api/cron/pending-reminders
   ```
