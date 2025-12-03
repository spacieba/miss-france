const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Base de données SQLite
const db = new Database('data/miss-france.db');

// Initialisation des tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    quiz_score INTEGER DEFAULT 0,
    pronostics_score INTEGER DEFAULT 0,
    predictions_score INTEGER DEFAULT 0,
    bingo_score INTEGER DEFAULT 0,
    defis_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pronostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    top15 TEXT,
    bonus_top15 TEXT,
    top5 TEXT,
    bonus_top5 TEXT,
    classement_final TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    question_id INTEGER,
    answer TEXT,
    is_correct BOOLEAN,
    points INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    prediction_type TEXT,
    prediction_value TEXT,
    points INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bingo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    grid TEXT,
    completed_lines INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS defis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    defi_id INTEGER,
    completed BOOLEAN DEFAULT 0,
    points INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'miss-france-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h
}));
app.use(express.static('public'));

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

// Routes authentification
app.post('/api/register', async (req, res) => {
  const { pseudo } = req.body;
  
  if (!pseudo || pseudo.trim().length === 0) {
    return res.status(400).json({ error: 'Pseudo requis' });
  }

  try {
    const password = await bcrypt.hash('missfrancerules', 10);
    const stmt = db.prepare('INSERT INTO users (pseudo, password) VALUES (?, ?)');
    const result = stmt.run(pseudo, password);
    
    // Créer le score initial
    db.prepare('INSERT INTO scores (user_id) VALUES (?)').run(result.lastInsertRowid);
    
    req.session.userId = result.lastInsertRowid;
    req.session.pseudo = pseudo;
    
    res.json({ 
      success: true, 
      userId: result.lastInsertRowid,
      pseudo: pseudo
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      res.status(400).json({ error: 'Ce pseudo existe déjà' });
    } else {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
});

app.post('/api/login', (req, res) => {
  const { pseudo } = req.body;
  
  if (!pseudo) {
    return res.status(400).json({ error: 'Pseudo requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);
  
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  req.session.userId = user.id;
  req.session.pseudo = user.pseudo;
  
  res.json({ 
    success: true,
    userId: user.id,
    pseudo: user.pseudo
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, pseudo FROM users WHERE id = ?').get(req.session.userId);
  const score = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
  
  res.json({ user, score });
});

// Routes Quiz
const quizQuestions = [
  { id: 1, question: "En quelle année a eu lieu la première élection de Miss France ?", answers: ["1920", "1927", "1935", "1945"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 2, question: "Quelle Miss France est devenue actrice dans James Bond ?", answers: ["Mareva Galanter", "Marine Lorphelin", "Iris Mittenaere", "Laury Thilleman"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 3, question: "Combien de fois Jean-Pierre Foucault a-t-il présenté Miss France ?", answers: ["Plus de 20 fois", "Plus de 25 fois", "Plus de 30 fois", "Plus de 35 fois"], correct: 2, points: 2, difficulty: "moyen" },
  { id: 4, question: "Quelle Miss France a remporté Miss Univers en 2016 ?", answers: ["Flora Coquerel", "Iris Mittenaere", "Camille Cerf", "Marine Lorphelin"], correct: 1, points: 1, difficulty: "facile" },
  { id: 5, question: "Dans quelle ville se déroule généralement l'élection de Miss France ?", answers: ["Paris", "Nice", "Une ville différente chaque année", "Lille"], correct: 2, points: 1, difficulty: "facile" },
  { id: 6, question: "Quelle est la taille minimum requise pour participer à Miss France ?", answers: ["1m65", "1m70", "1m75", "Aucune restriction"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 7, question: "Qui a créé le concours Miss France ?", answers: ["Maurice de Waleffe", "Jean-Pierre Foucault", "Geneviève de Fontenay", "Louis de Funès"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 8, question: "Quelle Miss France est devenue Miss Univers en 1953 ?", answers: ["Christiane Martel", "Sylvie Tellier", "Muguette Fabris", "Denise Perrier"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 9, question: "Combien y a-t-il de candidates en moyenne chaque année ?", answers: ["20", "25", "30", "35"], correct: 2, points: 1, difficulty: "facile" },
  { id: 10, question: "Qui présentait Miss France avant Jean-Pierre Foucault ?", answers: ["Patrick Sabatier", "Michel Drucker", "Yves Mourousi", "Patrick Sébastien"], correct: 2, points: 3, difficulty: "difficile" },
  { id: 11, question: "Quelle Miss France a eu le règne le plus long ?", answers: ["Iris Mittenaere", "Marine Lorphelin", "Malika Ménard", "Eve Gilles"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 12, question: "Sur quelle chaîne est diffusé Miss France ?", answers: ["TF1", "France 2", "M6", "France 3"], correct: 0, points: 1, difficulty: "facile" },
  { id: 13, question: "Quelle est la durée du règne d'une Miss France ?", answers: ["6 mois", "1 an", "2 ans", "18 mois"], correct: 1, points: 1, difficulty: "facile" },
  { id: 14, question: "Qui est l'actuelle présidente de la société Miss France ?", answers: ["Geneviève de Fontenay", "Sylvie Tellier", "Alexia Laroche-Joubert", "Cindy Fabre"], correct: 2, points: 2, difficulty: "moyen" },
  { id: 15, question: "Quelle Miss France a participé à Danse avec les Stars ?", answers: ["Plusieurs", "Aucune", "Marine Lorphelin uniquement", "Iris Mittenaere uniquement"], correct: 0, points: 1, difficulty: "facile" },
  { id: 16, question: "Quel âge maximum peut avoir une candidate ?", answers: ["24 ans", "25 ans", "26 ans", "Pas de limite"], correct: 0, points: 2, difficulty: "moyen" },
  { id: 17, question: "Quelle région a gagné le plus de fois ?", answers: ["Île-de-France", "Provence", "Nord-Pas-de-Calais", "Normandie"], correct: 2, points: 3, difficulty: "difficile" },
  { id: 18, question: "Combien de Miss France ont remporté Miss Univers ?", answers: ["1", "2", "3", "4"], correct: 1, points: 3, difficulty: "difficile" },
  { id: 19, question: "Quelle Miss France est devenue chroniqueuse TV ?", answers: ["Plusieurs", "Aucune", "Malika Ménard uniquement", "Marine Lorphelin uniquement"], correct: 0, points: 1, difficulty: "facile" },
  { id: 20, question: "Quelle est la récompense principale de Miss France ?", answers: ["De l'argent", "Une voiture", "Un appartement", "Des cadeaux et contrats publicitaires"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 21, question: "Qui était Miss France 2023 ?", answers: ["Indira Ampiot", "Eve Gilles", "Diane Leyre", "Amandine Petit"], correct: 1, points: 1, difficulty: "facile" },
  { id: 22, question: "Combien de dauphines sont élues ?", answers: ["1", "2", "3", "4"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 23, question: "Quelle Miss France a chanté à l'Eurovision ?", answers: ["Amandine Petit", "Aucune", "Marine Lorphelin", "Laury Thilleman"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 24, question: "Dans quel mois a lieu l'élection de Miss France ?", answers: ["Novembre", "Décembre", "Janvier", "Février"], correct: 1, points: 1, difficulty: "facile" },
  { id: 25, question: "Quelle Miss France a créé une association caritative ?", answers: ["Plusieurs", "Aucune", "Marine Lorphelin uniquement", "Iris Mittenaere uniquement"], correct: 0, points: 2, difficulty: "moyen" },
  { id: 26, question: "Combien de costumes portent les candidates pendant l'émission ?", answers: ["2", "3", "4", "5"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 27, question: "Quelle Miss France a posé pour Playboy ?", answers: ["Aucune", "Une seule", "Plusieurs", "Toutes"], correct: 2, points: 3, difficulty: "difficile" },
  { id: 28, question: "Qui choisit Miss France ?", answers: ["Le jury uniquement", "Le public uniquement", "Le public et le jury", "Jean-Pierre Foucault"], correct: 2, points: 1, difficulty: "facile" },
  { id: 29, question: "Quelle est la marque de la couronne Miss France ?", answers: ["Chaumet", "Cartier", "Boucheron", "Van Cleef & Arpels"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 30, question: "Combien de spectateurs en moyenne devant la TV ?", answers: ["3 millions", "5 millions", "7 millions", "10 millions"], correct: 2, points: 2, difficulty: "moyen" }
];

app.get('/api/quiz/questions', requireAuth, (req, res) => {
  res.json(quizQuestions);
});

app.post('/api/quiz/answer', requireAuth, (req, res) => {
  const { questionId, answer } = req.body;
  const question = quizQuestions.find(q => q.id === questionId);
  
  if (!question) {
    return res.status(404).json({ error: 'Question non trouvée' });
  }

  const isCorrect = answer === question.correct;
  const points = isCorrect ? question.points : 0;

  // Enregistrer la réponse
  db.prepare('INSERT INTO quiz_answers (user_id, question_id, answer, is_correct, points) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.userId, questionId, answer, isCorrect ? 1 : 0, points);

  // Mettre à jour le score
  const currentScore = db.prepare('SELECT quiz_score FROM scores WHERE user_id = ?').get(req.session.userId);
  const newQuizScore = (currentScore.quiz_score || 0) + points;
  
  db.prepare('UPDATE scores SET quiz_score = ?, total_score = quiz_score + pronostics_score + predictions_score + bingo_score + defis_score WHERE user_id = ?')
    .run(newQuizScore, req.session.userId);

  res.json({ 
    correct: isCorrect, 
    points: points,
    correctAnswer: question.answers[question.correct]
  });
});

app.get('/api/quiz/score', requireAuth, (req, res) => {
  const answers = db.prepare('SELECT * FROM quiz_answers WHERE user_id = ?').all(req.session.userId);
  const totalPoints = answers.reduce((sum, a) => sum + a.points, 0);
  
  res.json({ 
    totalAnswers: answers.length,
    correctAnswers: answers.filter(a => a.is_correct).length,
    totalPoints: totalPoints
  });
});

// Routes Pronostics
const candidates = [
  "Miss Guadeloupe", "Miss Martinique", "Miss Guyane", "Miss Réunion", "Miss Mayotte",
  "Miss Île-de-France", "Miss Nord-Pas-de-Calais", "Miss Provence", "Miss Côte d'Azur",
  "Miss Languedoc", "Miss Roussillon", "Miss Aquitaine", "Miss Midi-Pyrénées",
  "Miss Limousin", "Miss Auvergne", "Miss Bourgogne", "Miss Franche-Comté",
  "Miss Alsace", "Miss Lorraine", "Miss Champagne-Ardenne", "Miss Picardie",
  "Miss Normandie", "Miss Bretagne", "Miss Pays de la Loire", "Miss Centre-Val de Loire",
  "Miss Poitou-Charentes", "Miss Corse", "Miss Tahiti", "Miss Nouvelle-Calédonie",
  "Miss Saint-Martin", "Miss Saint-Barthélemy"
];

app.get('/api/candidates', requireAuth, (req, res) => {
  res.json(candidates);
});

app.post('/api/pronostics', requireAuth, (req, res) => {
  const { top15, bonusTop15, top5, bonusTop5, classementFinal } = req.body;
  
  try {
    // Vérifier si des pronostics existent déjà
    const existing = db.prepare('SELECT id FROM pronostics WHERE user_id = ?').get(req.session.userId);
    
    if (existing) {
      db.prepare(`UPDATE pronostics 
        SET top15 = ?, bonus_top15 = ?, top5 = ?, bonus_top5 = ?, classement_final = ?, submitted_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?`)
        .run(JSON.stringify(top15), bonusTop15, JSON.stringify(top5), bonusTop5, JSON.stringify(classementFinal), req.session.userId);
    } else {
      db.prepare('INSERT INTO pronostics (user_id, top15, bonus_top15, top5, bonus_top5, classement_final) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.session.userId, JSON.stringify(top15), bonusTop15, JSON.stringify(top5), bonusTop5, JSON.stringify(classementFinal));
    }
    
    res.json({ success: true, message: 'Pronostics enregistrés !' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

app.get('/api/pronostics', requireAuth, (req, res) => {
  const pronostics = db.prepare('SELECT * FROM pronostics WHERE user_id = ?').get(req.session.userId);
  
  if (pronostics) {
    pronostics.top15 = JSON.parse(pronostics.top15);
    pronostics.top5 = JSON.parse(pronostics.top5);
    pronostics.classement_final = JSON.parse(pronostics.classement_final);
  }
  
  res.json(pronostics || null);
});

// Routes Prédictions live
const predictionTypes = [
  { id: 'first_eliminated', label: 'Qui sera éliminée en premier du top 15 ?', points: 5 },
  { id: 'first_tears', label: 'Quelle région va pleurer en premier ?', points: 3 },
  { id: 'jp_magnifique', label: 'Combien de fois JP dira "magnifique" ?', points: 5, type: 'number' },
  { id: 'dress_color', label: 'Couleur de la robe de la gagnante ?', points: 5, options: ['Rouge', 'Bleu', 'Blanc', 'Noir', 'Doré', 'Argenté'] }
];

app.get('/api/predictions/types', requireAuth, (req, res) => {
  res.json(predictionTypes);
});

app.post('/api/predictions', requireAuth, (req, res) => {
  const { predictionType, value } = req.body;
  
  db.prepare('INSERT INTO predictions (user_id, prediction_type, prediction_value) VALUES (?, ?, ?)')
    .run(req.session.userId, predictionType, value);
  
  res.json({ success: true });
});

// Routes Bingo
const bingoItems = [
  "Larme d'émotion", "Problème de micro", "Candidate qui trébuche", "JP Foucault fait une blague",
  "Gros plan sur la famille", "Standing ovation", "Problème technique", "Candidate surprise",
  "Robe dorée", "Défilé en maillot", "Question pièges", "Discours engagé",
  "Miss dit 'paix dans le monde'", "Chanteuse invitée", "Ancienne Miss présente",
  "Candidate qui pleure", "Suspense interminable", "Publicité Dior", "Couronne qui brille",
  "JP dit 'et la nouvelle Miss France est...'", "Confettis", "Hymne national", "Écharpe Miss France",
  "Baiser sur la joue", "Photo de groupe finale"
];

app.get('/api/bingo/items', requireAuth, (req, res) => {
  // Mélanger et prendre 25 items
  const shuffled = [...bingoItems].sort(() => 0.5 - Math.random());
  res.json(shuffled.slice(0, 25));
});

app.post('/api/bingo/check', requireAuth, (req, res) => {
  const { grid, completedLines } = req.body;
  
  const points = completedLines * 20;
  
  // Enregistrer ou mettre à jour
  const existing = db.prepare('SELECT id FROM bingo WHERE user_id = ?').get(req.session.userId);
  
  if (existing) {
    db.prepare('UPDATE bingo SET grid = ?, completed_lines = ?, points = ? WHERE user_id = ?')
      .run(JSON.stringify(grid), completedLines, points, req.session.userId);
  } else {
    db.prepare('INSERT INTO bingo (user_id, grid, completed_lines, points) VALUES (?, ?, ?, ?)')
      .run(req.session.userId, JSON.stringify(grid), completedLines, points);
  }
  
  // Mettre à jour le score total
  const currentScore = db.prepare('SELECT bingo_score FROM scores WHERE user_id = ?').get(req.session.userId);
  db.prepare('UPDATE scores SET bingo_score = ?, total_score = quiz_score + pronostics_score + predictions_score + bingo_score + defis_score WHERE user_id = ?')
    .run(points, req.session.userId);
  
  res.json({ success: true, points: points });
});

// Routes Défis
const defis = [
  { id: 1, title: "Imite le défilé", description: "Imite le défilé d'une Miss", points: 10 },
  { id: 2, title: "Objet doré", description: "Trouve un objet doré dans la pièce", points: 15 },
  { id: 3, title: "Discours de Miss", description: "Invente un discours de Miss en 30 secondes", points: 10 },
  { id: 4, title: "Couronne improvisée", description: "Fabrique une couronne avec ce que tu trouves", points: 15 },
  { id: 5, title: "Pose Miss France", description: "Fais ta meilleure pose Miss France", points: 10 }
];

app.get('/api/defis', requireAuth, (req, res) => {
  const completed = db.prepare('SELECT defi_id FROM defis WHERE user_id = ?').all(req.session.userId);
  const completedIds = completed.map(d => d.defi_id);
  
  const available = defis.filter(d => !completedIds.includes(d.id));
  
  res.json(available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null);
});

app.post('/api/defis/complete', requireAuth, (req, res) => {
  const { defiId } = req.body;
  const defi = defis.find(d => d.id === defiId);
  
  if (!defi) {
    return res.status(404).json({ error: 'Défi non trouvé' });
  }
  
  db.prepare('INSERT INTO defis (user_id, defi_id, completed, points) VALUES (?, ?, 1, ?)')
    .run(req.session.userId, defiId, defi.points);
  
  // Mettre à jour le score
  const currentScore = db.prepare('SELECT defis_score FROM scores WHERE user_id = ?').get(req.session.userId);
  const newDefisScore = (currentScore.defis_score || 0) + defi.points;
  
  db.prepare('UPDATE scores SET defis_score = ?, total_score = quiz_score + pronostics_score + predictions_score + bingo_score + defis_score WHERE user_id = ?')
    .run(newDefisScore, req.session.userId);
  
  res.json({ success: true, points: defi.points });
});

// Routes Classement
app.get('/api/leaderboard', requireAuth, (req, res) => {
  const leaderboard = db.prepare(`
    SELECT u.pseudo, s.* 
    FROM scores s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.total_score DESC
  `).all();
  
  res.json(leaderboard);
});

// Route admin pour valider les résultats réels
app.post('/api/admin/validate-results', requireAuth, (req, res) => {
  const { top15Real, bonusTop15Real, top5Real, bonusTop5Real, classementFinalReal } = req.body;
  
  // Récupérer tous les pronostics
  const allPronostics = db.prepare('SELECT * FROM pronostics').all();
  
  allPronostics.forEach(prono => {
    let score = 0;
    
    // Calculer les points pour top15
    const top15User = JSON.parse(prono.top15);
    top15User.forEach(candidate => {
      if (top15Real.includes(candidate)) {
        score += 5;
      }
    });
    
    // Bonus top15
    if (prono.bonus_top15 === bonusTop15Real) {
      score += 80;
    }
    
    // Top5
    const top5User = JSON.parse(prono.top5);
    top5User.forEach(candidate => {
      if (top5Real.includes(candidate)) {
        score += 8;
      }
    });
    
    // Bonus top5
    if (prono.bonus_top5 === bonusTop5Real) {
      score += 20;
    }
    
    // Classement final
    const classementUser = JSON.parse(prono.classement_final);
    classementUser.forEach((candidate, index) => {
      if (classementFinalReal[index] === candidate) {
        score += 8;
      }
    });
    
    // Mettre à jour le score
    db.prepare('UPDATE scores SET pronostics_score = ?, total_score = quiz_score + pronostics_score + predictions_score + bingo_score + defis_score WHERE user_id = ?')
      .run(score, prono.user_id);
  });
  
  res.json({ success: true, message: 'Résultats validés et scores mis à jour !' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🎉 Serveur Miss France démarré sur le port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
});
