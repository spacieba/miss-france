# 👑 Miss France 2025 - Application de Pronostics et Quiz

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

### Installation
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

L'application dispose d'une **interface d'administration** pour saisir les résultats en temps réel !

#### Accéder à l'interface admin
1. Aller sur `https://VOTRE-APP.up.railway.app/admin.html`
2. Entrer le mot de passe admin : `missfranceadmin2025`
   - ⚠️ **IMPORTANT** : Changez ce mot de passe en production via la variable d'environnement `ADMIN_PASSWORD` dans Railway

#### Fonctionnalités de l'admin
✅ **Saisie du Top 15** : Cochez les 15 candidates sélectionnées + la candidate bonus
✅ **Saisie du Top 5** : Cochez les 5 finalistes + la candidate bonus
✅ **Classement final** : Entrez le classement de 1 à 5 (Miss France + dauphines)
✅ **Validation des prédictions live** : Validez chaque prédiction individuellement pendant la soirée
✅ **Statistiques en temps réel** : Nombre d'utilisateurs, pronostics soumis, etc.
✅ **Calcul automatique** : Les scores sont recalculés automatiquement pour tous les joueurs

#### Pendant la soirée
1. **Prédictions live** : Validez chaque prédiction au fur et à mesure (couleur de robe, nombre de "magnifique", etc.)
2. **Top 15** : Saisissez les résultats dès l'annonce du top 15
3. **Top 5** : Saisissez les résultats dès l'annonce du top 5
4. **Classement final** : Saisissez le podium et cliquez sur "Valider tous les résultats"
5. Les scores de tous les joueurs sont **recalculés instantanément** !

#### Changer le mot de passe admin
Sur Railway, dans les variables d'environnement :
```
ADMIN_PASSWORD=votre_mot_de_passe_securise
```

## 🎨 Personnalisation

### Modifier les candidates
Éditez le tableau `candidates` dans `server.js` (ligne ~120)

### Ajouter des questions au quiz
Éditez le tableau `quizQuestions` dans `server.js` (ligne ~150)

### Modifier les items du bingo
Éditez le tableau `bingoItems` dans `server.js` (ligne ~400)

### Changer les couleurs
Modifiez les variables CSS dans `public/style.css` (`:root`)

## 🛠️ Technologies utilisées

- **Backend** : Node.js + Express
- **Base de données** : SQLite (better-sqlite3)
- **Frontend** : HTML, CSS, JavaScript vanilla
- **Authentification** : Sessions Express
- **Déploiement** : Railway

## 📝 Notes importantes

- La base de données SQLite est persistante sur Railway
- Tous les joueurs doivent se connecter avec leur pseudo
- Les pronostics peuvent être modifiés jusqu'à ce que vous validiez les résultats
- Le classement se met à jour automatiquement

## 🎉 Amusez-vous bien !

Créé avec ❤️ pour votre soirée Miss France 2025

## 📞 Support

Si vous avez des questions ou des problèmes, vérifiez :
1. Que tous les fichiers sont bien commités
2. Que Railway a bien détecté Node.js
3. Que le domaine est bien généré
4. Les logs de Railway en cas d'erreur

Bon jeu ! 👑✨
