# Pouls — bien-être, engagement, performance

Implémentation Next.js du handoff design `design_handoff_pouls/` (voir ce
dossier pour le prototype HTML de référence, `Bien-etre App.dc.html`, et le
détail des écrans / tokens / règles d'accès).

**État : testé de bout en bout dans un vrai navigateur**, avec Node.js local
et PostgreSQL (Postgres.app) sur cette machine — build de production propre,
`npx tsc --noEmit` propre, et chaque écran cliqué avec les 3 rôles (y
compris connexion par lien magique, ajout/désactivation d'employés,
réassignation de manager, protection par rôle sur toutes les routes). Le
détail de ce qui a été vérifié est dans les messages de la session qui a
construit ce projet ; deux vrais bugs trouvés en testant ont été corrigés
(calcul de semaine ISO décalé selon le fuseau horaire, page manager qui
plantait si son équipe lui était retirée) — voir l'historique Git une fois
le dépôt initialisé.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind · Prisma + PostgreSQL ·
Auth.js (NextAuth v4) · PWA (manifest + service worker).

## Démarrage

```bash
docker compose up -d          # Postgres local (voir docker-compose.yml)
npm install
cp .env.example .env          # puis ouvre .env : NEXTAUTH_SECRET doit être généré
openssl rand -base64 32       # colle le résultat dans NEXTAUTH_SECRET
npm run prisma:migrate        # crée les tables
npm run prisma:seed           # questionnaire par défaut + comptes de démo + 6 semaines d'historique
npm run dev                   # http://localhost:3000
```

Comptes de démo (mot de passe `demo1234`, mode `ENABLE_DEMO_LOGIN=true` dans
`.env.example` — **à désactiver en production**, voir plus bas) :

| E-mail | Rôle |
|---|---|
| camille@entreprise.fr | Employée (Équipe Produit) |
| julien@entreprise.fr | Manager (Équipe Produit) |
| sarah@entreprise.fr | RH / Admin |

Le seed crée aussi une seconde équipe, « Équipe Design » (3 personnes), pour
démontrer le masquage « n/d » sous le seuil d'anonymat k=5 quand Sarah (RH)
la sélectionne dans « Toutes les équipes ».

Ré-exécuter `npm run prisma:seed` sans repasser par `npm run db:reset`
échouera (les check-ins historiques sont déjà enregistrés pour ces
semaines) — c'est attendu.

## Reste à faire avant une vraie mise en production

- **Icônes PWA.** `public/icon-*.png` et `public/apple-touch-icon.png` sont
  des carrés arrondis unis générés par un script maison (pas d'outil image
  disponible côté build) — à remplacer par de vrais assets de marque.
- **Domaine d'envoi Resend.** Tant que `RESEND_FROM_EMAIL` pointe vers
  `onboarding@resend.dev` (le domaine de test de Resend), les liens de
  connexion et rappels partent d'une adresse générique — vérifier un domaine
  à toi sur Resend améliore la délivrabilité et la confiance des employés.
- **RGPD** : voir la section correspondante plus bas — registre de
  traitement et consultation du CSE avant un vrai déploiement.

## Auth : lien magique (production), SSO (optionnel), démo (dev uniquement)

L'entreprise n'ayant pas de SSO géré (Microsoft 365 / Google Workspace) et
les employés n'ayant que des adresses e-mail personnelles, l'authentification
principale est un **lien de connexion à usage unique envoyé par e-mail**
(comme Slack ou Notion), pas un mot de passe :

- `src/lib/magicLink.ts` génère un jeton aléatoire, n'en stocke que le hash
  (SHA-256) en base (`LoginToken`), valable 15 minutes, à usage unique.
- `POST /api/auth/magic-link` déclenche l'envoi (toujours la même réponse,
  qu'un compte existe ou non, pour ne pas laisser deviner quelles adresses
  sont enregistrées).
- `/login/verify` consomme le jeton et ouvre la session (provider Credentials
  `"magic"` dans `src/lib/auth.ts` — réutilise le même mécanisme de session
  JWT que les autres providers, pas d'adapter Prisma complet nécessaire).
- Sans `RESEND_API_KEY`, le lien est juste affiché dans les logs serveur
  (pratique en dev, **inutilisable en prod** — pense à configurer Resend).

Si l'entreprise passe un jour à Microsoft 365 ou Google Workspace,
`AZURE_AD_CLIENT_ID`/`SECRET`/`TENANT_ID` ou `GOOGLE_CLIENT_ID`/`SECRET`
activent ces providers en plus, sans rien retirer (voir `src/lib/auth.ts`).

`ENABLE_DEMO_LOGIN=true` (comptes de démo, mot de passe `demo1234`) est un
**substitut de développement uniquement** — `authorize()` refuse toute
tentative si `NODE_ENV=production`, et la section « Comptes de démo » de
l'écran de connexion ne s'affiche que si des comptes ont un
`demoPasswordHash` en base (donc absente d'elle-même si le seed de démo
n'est jamais lancé en prod). Un compte doit de toute façon déjà exister
dans la table `User` (créé via l'écran RH « Employés », ou en base) avant
que quiconque puisse se connecter, démo comme lien magique comme SSO — ce
n'est jamais en libre-service.

Le contrôle d'accès par rôle est appliqué à deux niveaux (voir README du
handoff, section "CRITIQUE") :
- `src/middleware.ts` protège les routes `/employe`, `/equipe`,
  `/questionnaire`, `/employes`.
- Chaque route API appelle `requireApiSpace(...)` (`src/lib/access.ts`) avant
  de toucher la base.

## Anonymat (k=5)

Toute la logique d'agrégation passe par `src/lib/aggregate.ts` : un compte
de réponses `< 5` renvoie systématiquement `null`/`"n/d"`, jamais une valeur
calculée. Voir aussi les commentaires dans `prisma/schema.prisma` sur
`CheckinReceipt` (dédoublonnage hebdomadaire sans lien vers le contenu des
réponses) et `PersonalHistoryEntry` (historique personnel qui fonctionne
même en anonyme, sans jamais être joint aux réponses côté managers/RH). Ce
dernier point reste, comme noté dans le handoff, **à valider avec le DPO**
avant mise en production.

## Non implémenté / laissé en stub

- Intégration calendrier pour « Planifier un point » (le statut est
  persisté, pas d'événement créé — voir `src/app/api/dashboard/alerts/route.ts`).
- Versionnement du questionnaire (`questionVersionId`) : le MVP archive une
  question supprimée si elle a déjà des réponses, plutôt que de versionner
  proprement — voir le commentaire dans `src/app/api/questions/[id]/route.ts`.
- Sélecteur d'équipe RH : fonctionnel (`src/components/Dashboard.tsx`), mais
  pas de pagination si l'organisation a beaucoup d'équipes.
- Notifications e-mail/Teams (`src/lib/notify.ts`) : le code est réel (appelle
  Resend / un webhook Teams) mais se contente d'un `console.info` tant que
  `RESEND_API_KEY`/`TEAMS_WEBHOOK_URL` ne sont pas renseignées.
- Pas de limitation de débit sur `POST /api/auth/magic-link` : quelqu'un
  pourrait spammer une boîte mail de demandes de connexion (pas de fuite de
  données, juste une nuisance). À ajouter avant une prod à grande échelle.
- Écran RH « Employés » (`src/app/(app)/employes`, `src/lib/employees.ts`) :
  ajouté après le handoff design d'origine (qui ne prévoyait pas de gestion
  des comptes) — permet créer/modifier/désactiver un employé et créer une
  équipe à la volée. Pas de suppression définitive (désactivation
  uniquement, pour préserver l'historique), pas d'import en masse (CSV).
