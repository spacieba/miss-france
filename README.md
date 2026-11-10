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

## 🚀 Déploiement sur Railway

### Prérequis
- Un compte GitHub
- Un compte Railway (gratuit)

### Étapes de déploiement

1. **Créer un repository GitHub**
   ```bash
   cd miss-france-app
   git init
   git add .
   git commit -m "Initial commit - Miss France App"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USERNAME/miss-france-app.git
   git push -u origin main
   ```

2. **Déployer sur Railway**
   - Aller sur https://railway.app
   - Cliquer sur "New Project"
   - Sélectionner "Deploy from GitHub repo"
   - Choisir votre repository `miss-france-app`
   - Railway détectera automatiquement Node.js grâce au nixpacks.toml
   - Cliquer sur "Deploy"

3. **Obtenir l'URL de l'application**
   - Une fois déployé, aller dans "Settings"
   - Cliquer sur "Generate Domain"
   - Votre app sera accessible à l'adresse : `https://VOTRE-APP.up.railway.app`

## 💻 Développement local

### Installation (Node.js 22+)
```bash
npm install
```

### Lancer le serveur
```bash
npm start
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

#### Variables d'environnement (Railway → Variables)

| Variable | Rôle |
|---|---|
| `ADMIN_USERS` | **Obligatoire en prod.** Comptes admin : `pseudo1:motdepasse1,pseudo2:motdepasse2`. Les mots de passe sont resynchronisés à chaque démarrage. |
| `SESSION_SECRET` | Recommandé. Longue chaîne aléatoire. Sinon un secret est généré et stocké dans le volume `/data`. |
| `EDITION` | Optionnel. Édition à charger (`2027` par défaut → `editions/2027.js`). |

Sans `ADMIN_USERS`, un compte `admin-comite` avec un mot de passe aléatoire est créé et affiché **une seule fois** dans les logs.

#### Pendant la soirée
1. **Top 15** : cochez les 15 candidates puis validez
2. **Top 5** : cochez les 5 finalistes puis validez
3. **Classement final** : saisissez le podium et validez
4. Les scores sont **recalculés instantanément** ; une étape peut être annulée.
Les points Quiz / Culture G (15/10/5) et Costume (30/20/10) sont recalculés automatiquement (les ex-aequo partagent le même rang).

## 🎨 Personnalisation / nouvelle édition

Tout le contenu de l'édition est dans `editions/2027.js` : candidates (nom, prénom, photo), quiz, questionnaire Culture G, année.
- **Photos des candidates** : remplacez `PLACEHOLDER` par l'URL de la photo officielle.
- **Questionnaire Culture G 2027** : à remplacer dès sa publication (c'est celui de 2026 en attendant).
- **Édition suivante** : copiez `editions/2027.js` en `editions/2028.js`, mettez-le à jour et définissez `EDITION=2028`.
  Chaque édition a sa propre base (`miss-france-<edition>.db`) : l'historique est conservé, tout le monde recrée son compte.

## 🛠️ Technologies utilisées

- **Backend** : Node.js + Express
- **Base de données** : SQLite (better-sqlite3)
- **Frontend** : HTML, CSS, JavaScript vanilla
- **Authentification** : Sessions Express stockées en SQLite, bcrypt
- **Déploiement** : Railway

## 📝 Notes importantes

- La base de données SQLite est persistante sur Railway
- Tous les joueurs doivent se connecter avec leur pseudo
- Les pronostics peuvent être modifiés jusqu'à ce que vous validiez les résultats
- Le classement se met à jour automatiquement

## 🎉 Amusez-vous bien !

Créé avec ❤️ pour votre soirée Miss France 2027

## 📞 Support

Si vous avez des questions ou des problèmes, vérifiez :
1. Que tous les fichiers sont bien commités
2. Que Railway a bien détecté Node.js
3. Que le domaine est bien généré
4. Les logs de Railway en cas d'erreur

Bon jeu ! 👑✨
