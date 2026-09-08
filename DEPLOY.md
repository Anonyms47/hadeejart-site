# Déploiement — Hadeej'Art

## Architecture
- **Site public** (`index.html`, `css/`, `js/`) : site statique, aucun serveur applicatif requis.
- **Admin** (`admin/`) : SPA statique séparée, authentifiée via Supabase Auth.
- **Backend** : Supabase (projet `hadeejart`, région eu-west-3) — base de données, Auth, Storage.

## Hébergement du site statique
N'importe quel hébergeur de fichiers statiques convient (Netlify, Vercel, GitHub Pages, ou un simple Nginx/Apache) :
1. Déployer l'intégralité du dossier (racine du dépôt) tel quel — aucun build/bundler n'est nécessaire.
2. Le site public est servi depuis `/`, l'admin depuis `/admin/`.
3. Aucune variable d'environnement serveur n'est nécessaire : les identifiants Supabase publics (`SUPABASE_URL`, clé `anon`) sont déjà présents dans `js/config.js` et `admin/js/supabase-client.js` — c'est normal et sans risque (voir `.env.example`), la sécurité réelle est assurée par les policies RLS côté base de données.

## Variables (`.env.example`)
Utile uniquement si un outillage de build/CI est ajouté plus tard :
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` : valeurs publiques déjà en dur dans le code client.
- `SUPABASE_SERVICE_ROLE_KEY` : **jamais utilisée côté client** ; réservée à d'éventuels scripts d'administration exécutés hors navigateur. Ne jamais la commettre.
- `WHATSAPP_NUMBER` : numéro de réception des commandes (actuellement en dur dans `js/checkout.js`, `SITE_WA_NUMBER`).

## Accès admin
URL : `/admin/index.html`. Un seul compte existe actuellement (`moctarbeye@gmail.com`, mot de passe temporaire communiqué séparément) — **à changer dès la première connexion**.

## Actions manuelles restantes (non automatisables depuis cet environnement)
1. Changer le mot de passe administrateur temporaire.
2. Activer *Leaked Password Protection* : Dashboard Supabase → Authentication → Policies.
3. (Recommandé) Désactiver les inscriptions publiques si elles ne sont pas nécessaires : Dashboard Supabase → Authentication → Providers → Email.

## Migration vers un autre projet Supabase
1. Exporter le schéma (migrations dans `supabase/` si versionnées, sinon rejouer les migrations SQL appliquées via l'historique du projet).
2. Mettre à jour `SUPABASE_URL` / la clé anon dans `js/config.js` et `admin/js/supabase-client.js`.
3. Recréer le compte admin (voir procédure interne) et sa ligne dans `profiles` avec `role = 'admin'`.
