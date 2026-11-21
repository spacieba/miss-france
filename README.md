# 👑 Miss France 2027 - Application de Pronostics et Quiz

> Élection du **12 décembre 2026** au Futuroscope (31 candidates).

Application interactive pour organiser une soirée Miss France entre amis avec système de points, quiz, pronostics et jeux en direct !

## 🎯 Fonctionnalités

### 🏆 Pronostics
- Choix des 15 sélectionnées (5 pts chacune)
- Bonus Miss France top 15 (80 pts)
- Choix des 5 finalistes (8 pts chacune)
- Bonus Miss France top 5 (20 pts)
- Classement final du top 5 (8 pts par bonne place)

### 📚 Quiz Miss France
- 30 questions sur l'histoire de Miss France
- 3 niveaux de difficulté (facile, moyen, difficile)
- Points variables selon la difficulté

### 🎭 Prédictions Live
- Prédictions pendant l'émission
- Questions amusantes avec points bonus

### 🎯 Bingo Miss France
- Grille de 25 cases à cocher
- 20 points par ligne complète
- Mise à jour en temps réel

### 🌟 Défis Bonus
- Défis amusants à réaliser pendant la soirée
- Points bonus pour chaque défi complété

### 📊 Classement en Direct
- Classement général actualisé automatiquement
- Détail des points par catégorie

## 🚀 Déploiement (Vercel + Supabase)

L'application tourne sur **Vercel** (fichiers statiques de `public/` + API Express en fonction serverless `api/index.js`, région `fra1`) avec une base **Postgres Supabase** (projet `miss-france`, eu-central-1).

1. **Base Supabase** : les tables (`users`, `pronostics`, `scores`, `quiz_answers`, `culture_g_answers`, `costume_photos`, `costume_votes`, `official_results`, `sessions`, `rate_limits`) existent déjà dans le projet Supabase.
2. **Projet Vercel** : *Add New → Project*, importer le dépôt GitHub `spacieba/miss-france` (preset « Other », aucune commande de build : `vercel.json` s'occupe de tout).
3. **Variables d'environnement** (Vercel → Settings → Environment Variables) : voir le tableau ci-dessous.
4. Chaque `git push` sur `main` redéploie automatiquement en production.

## 💻 Développement local

### Installation (Node.js 22+)
```bash
npm install
cp .env.example .env   # puis remplir DATABASE_URL, SESSION_SECRET, ADMIN_USERS
```

### Lancer le serveur
```bash
npm run dev
```

L'application sera accessible sur http://localhost:3000

## 📱 Utilisation

### Pour les joueurs
1. Se connecter avec un pseudo (ou créer un compte)
2. Remplir ses pronostics avant l'émission
3. Répondre au quiz Miss France
4. Jouer aux prédictions live pendant l'émission
5. Cocher les cases du bingo
6. Relever les défis bonus
7. Consulter le classement en temps réel

### 🔐 Pour l'organisateur - Interface Admin

Les comptes admin se connectent normalement (page d'accueil) et voient l'onglet **Admin**.

#### Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | **Obligatoire.** URL Supabase « Transaction pooler » (port 6543) avec le mot de passe de la base. |
| `ADMIN_USERS` | **Obligatoire en prod.** Comptes admin : `pseudo1:motdepasse1,pseudo2:motdepasse2`. Les mots de passe sont resynchronisés à chaque démarrage. |
| `SESSION_SECRET` | **Obligatoire en prod.** Chaîne aléatoire d'au moins 32 caractères. |
| `EDITION` | Optionnel. Édition à charger (`2027` par défaut → `editions/2027.js`). |

Sans `ADMIN_USERS`, aucun compte admin n'est créé (un avertissement apparaît dans les logs).

#### Pendant la soirée
1. **Top 15** : cochez les 15 candidates puis validez
2. **Top 5** : cochez les 5 finalistes puis validez
3. **Classement final** : saisissez le podium et validez
4. Les scores sont **recalculés instantanément** ; une étape peut être annulée.
Les points Quiz / Culture G (15/10/5) et Costume (30/20/10) sont recalculés automatiquement (les ex-aequo partagent le même rang).

## 🎨 Personnalisation / nouvelle édition

Tout le contenu de l'édition est dans `editions/2027.js` : candidates (nom, prénom, photo), quiz, questionnaire Culture G, année.
- **Nombre de qualifiées au premier tour** : `semiFinalists` (12 par défaut, comme en 2026 ; parfois 15). À fixer **avant** que les joueurs fassent leurs pronostics.
- **Photos des candidates** : remplacez `PLACEHOLDER` par l'URL de la photo officielle.
- **Questionnaire Culture G** : c'est le test officiel 2027 (publié le 20 novembre 2026), sans la question en images ni 5 des 10 énigmes de logique, non publiées.
- **Édition suivante** : copiez `editions/2027.js` en `editions/2028.js`, mettez-le à jour, ajoutez-le dans la table `EDITIONS` de `src/app.js` et définissez `EDITION=2028`.
  Toutes les éditions partagent la même base Supabase : pour repartir de zéro, utilisez le bouton de réinitialisation complète de l'onglet Admin (ou créez un nouveau projet Supabase pour garder l'historique).

## 🛠️ Technologies utilisées

- **Backend** : Node.js + Express
- **Base de données** : Postgres Supabase (librairie `postgres`)
- **Frontend** : HTML, CSS, JavaScript vanilla
- **Authentification** : Sessions Express stockées en Postgres, bcrypt, protection CSRF
- **Déploiement** : Vercel (serverless)

## 📝 Notes importantes

- Les données sont stockées dans Supabase (persistantes entre les déploiements)
- Tous les joueurs doivent se connecter avec leur pseudo
- Les pronostics peuvent être modifiés jusqu'à ce que vous validiez les résultats
- Le classement se met à jour automatiquement

## 🎉 Amusez-vous bien !

Créé avec ❤️ pour votre soirée Miss France 2027

## 📞 Support

Si vous avez des questions ou des problèmes, vérifiez :
1. Que tous les fichiers sont bien commités
2. Que les variables d'environnement sont bien définies sur Vercel
3. Que le projet Supabase n'est pas en pause (projets gratuits mis en pause après inactivité)
4. Les logs Vercel (Deployments → Functions) en cas d'erreur

Bon jeu ! 👑✨
