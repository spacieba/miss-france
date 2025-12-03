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

### Pour l'organisateur (vous)
Après l'émission, vous pouvez valider les résultats réels via l'endpoint admin :

```bash
POST /api/admin/validate-results
{
  "top15Real": ["Miss X", "Miss Y", ...],
  "bonusTop15Real": "Miss France réelle",
  "top5Real": ["Miss A", "Miss B", ...],
  "bonusTop5Real": "Miss France réelle",
  "classementFinalReal": ["1ère", "2ème", "3ème", "4ème", "5ème"]
}
```

Vous pouvez utiliser Postman ou faire un script simple pour cela.

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
