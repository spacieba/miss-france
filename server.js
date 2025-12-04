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
    is_admin INTEGER DEFAULT 0,
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

// Créer l'utilisateur admin s'il n'existe pas
const adminUser = db.prepare('SELECT * FROM users WHERE pseudo = ?').get('admin');
if (!adminUser) {
  const password = bcrypt.hashSync('fernando80', 10);
  const result = db.prepare('INSERT INTO users (pseudo, password, is_admin) VALUES (?, ?, 1)').run('admin', password);
  db.prepare('INSERT INTO scores (user_id) VALUES (?)').run(result.lastInsertRowid);
  console.log('✅ Utilisateur admin créé (pseudo: admin)');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'miss-france-secret-2025-change-me-in-production',
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

// Middleware d'authentification admin
const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  next();
};

// Routes authentification
app.post('/api/register', async (req, res) => {
  const { pseudo, password } = req.body;

  if (!pseudo || pseudo.trim().length === 0) {
    return res.status(400).json({ error: 'Pseudo requis' });
  }

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Mot de passe requis (min 4 caractères)' });
  }

  // Empêcher la création d'un compte "admin"
  if (pseudo.toLowerCase() === 'admin') {
    return res.status(400).json({ error: 'Ce pseudo est réservé' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (pseudo, password) VALUES (?, ?)');
    const result = stmt.run(pseudo, hashedPassword);
    
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

app.post('/api/login', async (req, res) => {
  const { pseudo, password } = req.body;

  if (!pseudo) {
    return res.status(400).json({ error: 'Pseudo requis' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  // Vérifier le mot de passe
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  req.session.userId = user.id;
  req.session.pseudo = user.pseudo;
  req.session.isAdmin = user.is_admin === 1;

  res.json({
    success: true,
    userId: user.id,
    pseudo: user.pseudo,
    isAdmin: user.is_admin === 1
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, pseudo, is_admin FROM users WHERE id = ?').get(req.session.userId);
  const score = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);

  res.json({
    user: {
      ...user,
      isAdmin: user.is_admin === 1
    },
    score
  });
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

  // Vérifier si l'utilisateur a déjà répondu à cette question
  const existingAnswer = db.prepare('SELECT id FROM quiz_answers WHERE user_id = ? AND question_id = ?')
    .get(req.session.userId, questionId);

  if (existingAnswer) {
    return res.status(400).json({ error: 'Tu as déjà répondu à cette question' });
  }

  const isCorrect = answer === question.correct;
  const points = isCorrect ? question.points : 0;

  // Enregistrer la réponse
  db.prepare('INSERT INTO quiz_answers (user_id, question_id, answer, is_correct, points) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.userId, questionId, answer, isCorrect ? 1 : 0, points);

  // Mettre à jour le score
  const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
  const newQuizScore = (currentScore.quiz_score || 0) + points;
  const newTotalScore = newQuizScore + (currentScore.pronostics_score || 0) + (currentScore.predictions_score || 0) + (currentScore.bingo_score || 0) + (currentScore.defis_score || 0);

  db.prepare('UPDATE scores SET quiz_score = ?, total_score = ? WHERE user_id = ?')
    .run(newQuizScore, newTotalScore, req.session.userId);

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

// Route pour sauvegarder le top 15 uniquement
app.post('/api/pronostics/top15', requireAuth, (req, res) => {
  const { top15, bonusTop15 } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM pronostics WHERE user_id = ?').get(req.session.userId);

    if (existing) {
      db.prepare(`UPDATE pronostics
        SET top15 = ?, bonus_top15 = ?, submitted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`)
        .run(JSON.stringify(top15), bonusTop15, req.session.userId);
    } else {
      db.prepare('INSERT INTO pronostics (user_id, top15, bonus_top15) VALUES (?, ?, ?)')
        .run(req.session.userId, JSON.stringify(top15), bonusTop15);
    }

    res.json({ success: true, message: 'Top 15 enregistré !' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

// Route pour sauvegarder le top 5 uniquement
app.post('/api/pronostics/top5', requireAuth, (req, res) => {
  const { top5, bonusTop5 } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM pronostics WHERE user_id = ?').get(req.session.userId);

    if (existing) {
      db.prepare(`UPDATE pronostics
        SET top5 = ?, bonus_top5 = ?, submitted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`)
        .run(JSON.stringify(top5), bonusTop5, req.session.userId);
    } else {
      db.prepare('INSERT INTO pronostics (user_id, top5, bonus_top5) VALUES (?, ?, ?)')
        .run(req.session.userId, JSON.stringify(top5), bonusTop5);
    }

    res.json({ success: true, message: 'Top 5 enregistré !' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

// Route pour sauvegarder le classement final uniquement
app.post('/api/pronostics/final', requireAuth, (req, res) => {
  const { classementFinal } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM pronostics WHERE user_id = ?').get(req.session.userId);

    if (existing) {
      db.prepare(`UPDATE pronostics
        SET classement_final = ?, submitted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`)
        .run(JSON.stringify(classementFinal), req.session.userId);
    } else {
      db.prepare('INSERT INTO pronostics (user_id, classement_final) VALUES (?, ?)')
        .run(req.session.userId, JSON.stringify(classementFinal));
    }

    res.json({ success: true, message: 'Classement final enregistré !' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

app.get('/api/pronostics', requireAuth, (req, res) => {
  const pronostics = db.prepare('SELECT * FROM pronostics WHERE user_id = ?').get(req.session.userId);

  if (pronostics) {
    // Gestion sécurisée des valeurs NULL
    pronostics.top15 = pronostics.top15 ? JSON.parse(pronostics.top15) : [];
    pronostics.top5 = pronostics.top5 ? JSON.parse(pronostics.top5) : [];
    pronostics.classement_final = pronostics.classement_final ? JSON.parse(pronostics.classement_final) : [];
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

  // Vérifier si une prédiction existe déjà pour ce type
  const existing = db.prepare('SELECT id FROM predictions WHERE user_id = ? AND prediction_type = ?')
    .get(req.session.userId, predictionType);

  if (existing) {
    // Mettre à jour la prédiction existante
    db.prepare('UPDATE predictions SET prediction_value = ? WHERE id = ?')
      .run(value, existing.id);
  } else {
    // Créer une nouvelle prédiction
    db.prepare('INSERT INTO predictions (user_id, prediction_type, prediction_value) VALUES (?, ?, ?)')
      .run(req.session.userId, predictionType, value);
  }

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

// Fonction de mélange Fisher-Yates (non biaisé)
function shuffleArray(array, seed) {
  const result = [...array];
  let currentIndex = result.length;

  // Générateur pseudo-aléatoire basé sur la seed
  const seededRandom = (seed) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seedValue = seed;
  while (currentIndex > 0) {
    const randomIndex = Math.floor(seededRandom(seedValue++) * currentIndex);
    currentIndex--;
    [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
  }

  return result;
}

app.get('/api/bingo/items', requireAuth, (req, res) => {
  // Vérifier si l'utilisateur a déjà une grille
  const existing = db.prepare('SELECT grid FROM bingo WHERE user_id = ?').get(req.session.userId);

  if (existing && existing.grid) {
    // Retourner la grille existante
    const savedGrid = JSON.parse(existing.grid);
    // Si la grille contient des items (pas juste des booléens), les retourner
    if (savedGrid.items) {
      res.json(savedGrid.items);
      return;
    }
  }

  // Générer une nouvelle grille basée sur l'ID utilisateur (déterministe)
  const shuffled = shuffleArray(bingoItems, req.session.userId);
  const items = shuffled.slice(0, 25);

  // Sauvegarder la grille pour cet utilisateur
  if (existing) {
    db.prepare('UPDATE bingo SET grid = ? WHERE user_id = ?')
      .run(JSON.stringify({ items, checked: new Array(25).fill(false) }), req.session.userId);
  } else {
    db.prepare('INSERT INTO bingo (user_id, grid, completed_lines, points) VALUES (?, ?, 0, 0)')
      .run(req.session.userId, JSON.stringify({ items, checked: new Array(25).fill(false) }));
  }

  res.json(items);
});

app.post('/api/bingo/check', requireAuth, (req, res) => {
  const { grid, completedLines } = req.body;

  const points = completedLines * 20;

  // Récupérer la grille existante pour conserver les items
  const existing = db.prepare('SELECT grid FROM bingo WHERE user_id = ?').get(req.session.userId);

  let gridData = { items: [], checked: grid };
  if (existing && existing.grid) {
    const savedGrid = JSON.parse(existing.grid);
    if (savedGrid.items) {
      gridData.items = savedGrid.items;
    }
  }
  gridData.checked = grid;

  // Mettre à jour
  if (existing) {
    db.prepare('UPDATE bingo SET grid = ?, completed_lines = ?, points = ? WHERE user_id = ?')
      .run(JSON.stringify(gridData), completedLines, points, req.session.userId);
  } else {
    db.prepare('INSERT INTO bingo (user_id, grid, completed_lines, points) VALUES (?, ?, ?, ?)')
      .run(req.session.userId, JSON.stringify(gridData), completedLines, points);
  }
  
  // Mettre à jour le score total
  const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
  const newTotalScore = (currentScore.quiz_score || 0) + (currentScore.pronostics_score || 0) + (currentScore.predictions_score || 0) + points + (currentScore.defis_score || 0);

  db.prepare('UPDATE scores SET bingo_score = ?, total_score = ? WHERE user_id = ?')
    .run(points, newTotalScore, req.session.userId);
  
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
  const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
  const newDefisScore = (currentScore.defis_score || 0) + defi.points;
  const newTotalScore = (currentScore.quiz_score || 0) + (currentScore.pronostics_score || 0) + (currentScore.predictions_score || 0) + (currentScore.bingo_score || 0) + newDefisScore;

  db.prepare('UPDATE scores SET defis_score = ?, total_score = ? WHERE user_id = ?')
    .run(newDefisScore, newTotalScore, req.session.userId);
  
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

// ============================================
// ROUTES ADMIN
// ============================================

// Login Admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  // Mot de passe admin (à changer en production)
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fernando80';

  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
  }
});

// Récupérer les candidates (pour admin)
app.get('/api/admin/candidates', requireAuth, requireAdmin, (req, res) => {
  console.log('🔐 Admin candidates requested by:', req.session.pseudo, 'isAdmin:', req.session.isAdmin);
  res.json(candidates);
});

// Récupérer les types de prédictions (pour admin)
app.get('/api/admin/prediction-types', requireAuth, requireAdmin, (req, res) => {
  console.log('🔐 Admin prediction-types requested by:', req.session.pseudo);
  res.json(predictionTypes);
});

// Récupérer les statistiques
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  console.log('🔐 Admin stats requested by:', req.session.pseudo, 'isAdmin:', req.session.isAdmin);
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalPronostics = db.prepare('SELECT COUNT(*) as count FROM pronostics').get().count;
  const totalPredictions = db.prepare('SELECT COUNT(*) as count FROM predictions').get().count;

  console.log('📊 Stats:', { totalUsers, totalPronostics, totalPredictions });

  res.json({
    totalUsers,
    totalPronostics,
    totalPredictions
  });
});

// Valider une prédiction individuelle
app.post('/api/admin/validate-prediction', requireAuth, requireAdmin, (req, res) => {
  const { predictionType, correctValue } = req.body;

  // Récupérer toutes les prédictions de ce type
  const userPredictions = db.prepare('SELECT * FROM predictions WHERE prediction_type = ?').all(predictionType);

  let usersAwarded = 0;

  userPredictions.forEach(pred => {
    // Vérifier si la prédiction est correcte (avec trim pour ignorer les espaces)
    let isCorrect = false;

    if (pred.prediction_value.toString().toLowerCase().trim() === correctValue.toString().toLowerCase().trim()) {
      isCorrect = true;
    }

    if (isCorrect) {
      // Trouver les points pour ce type de prédiction
      const predType = predictionTypes.find(p => p.id === predictionType);
      const points = predType ? predType.points : 5;

      // Mettre à jour les points de la prédiction
      db.prepare('UPDATE predictions SET points = ? WHERE id = ?').run(points, pred.id);

      // Mettre à jour le score de l'utilisateur
      const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(pred.user_id);
      const newPredictionsScore = (currentScore.predictions_score || 0) + points;
      const newTotalScore = (currentScore.quiz_score || 0) + (currentScore.pronostics_score || 0) + newPredictionsScore + (currentScore.bingo_score || 0) + (currentScore.defis_score || 0);

      db.prepare('UPDATE scores SET predictions_score = ?, total_score = ? WHERE user_id = ?')
        .run(newPredictionsScore, newTotalScore, pred.user_id);

      usersAwarded++;
    }
  });

  res.json({ success: true, usersAwarded });
});

// Route admin pour valider les résultats réels
app.post('/api/admin/validate-results', requireAuth, requireAdmin, (req, res) => {
  const { top15Real, bonusTop15Real, top5Real, bonusTop5Real, classementFinalReal } = req.body;

  // Récupérer tous les pronostics
  const allPronostics = db.prepare('SELECT * FROM pronostics').all();

  let usersUpdated = 0;

  allPronostics.forEach(prono => {
    let score = 0;

    // Calculer les points pour top15 (avec gestion NULL)
    if (prono.top15) {
      const top15User = JSON.parse(prono.top15);
      if (Array.isArray(top15User)) {
        top15User.forEach(candidate => {
          if (top15Real && top15Real.includes(candidate)) {
            score += 5;
          }
        });
      }
    }

    // Bonus top15
    if (prono.bonus_top15 && prono.bonus_top15 === bonusTop15Real) {
      score += 80;
    }

    // Top5 (avec gestion NULL)
    if (prono.top5) {
      const top5User = JSON.parse(prono.top5);
      if (Array.isArray(top5User)) {
        top5User.forEach(candidate => {
          if (top5Real && top5Real.includes(candidate)) {
            score += 8;
          }
        });
      }
    }

    // Bonus top5
    if (prono.bonus_top5 && prono.bonus_top5 === bonusTop5Real) {
      score += 20;
    }

    // Classement final (avec gestion NULL)
    if (prono.classement_final) {
      const classementUser = JSON.parse(prono.classement_final);
      if (Array.isArray(classementUser)) {
        classementUser.forEach((candidate, index) => {
          if (classementFinalReal && classementFinalReal[index] === candidate) {
            score += 8;
          }
        });
      }
    }

    // Mettre à jour le score
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(prono.user_id);
    const newTotalScore = (currentScore.quiz_score || 0) + score + (currentScore.predictions_score || 0) + (currentScore.bingo_score || 0) + (currentScore.defis_score || 0);

    db.prepare('UPDATE scores SET pronostics_score = ?, total_score = ? WHERE user_id = ?')
      .run(score, newTotalScore, prono.user_id);

    usersUpdated++;
  });

  res.json({ success: true, message: 'Résultats validés et scores mis à jour !', usersUpdated });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🎉 Serveur Miss France démarré sur le port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
});
