const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Détection environnement Railway (volume monté sur /data)
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
const dataDir = isRailway ? '/data' : path.join(__dirname, 'data');
const uploadsBaseDir = isRailway ? '/data/uploads' : path.join(__dirname, 'public', 'uploads');

// Créer les dossiers si nécessaire
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Base de données SQLite
const dbPath = path.join(dataDir, 'miss-france.db');
console.log(`📂 Base de données: ${dbPath}`);
const db = new Database(dbPath);

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
    culture_g_score REAL DEFAULT 0,
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
    prono_or TEXT,
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

  CREATE TABLE IF NOT EXISTS costume_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id INTEGER NOT NULL,
    voted_for INTEGER NOT NULL,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voter_id) REFERENCES users(id),
    FOREIGN KEY (voted_for) REFERENCES users(id),
    UNIQUE(voter_id)
  );

  CREATE TABLE IF NOT EXISTS culture_g_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    question_id TEXT,
    answer TEXT,
    is_correct BOOLEAN,
    points INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS official_results (
    id INTEGER PRIMARY KEY,
    top15 TEXT,
    bonus_top15 TEXT,
    top5 TEXT,
    bonus_top5 TEXT,
    classement_final TEXT,
    miss_france TEXT,
    current_step INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Ajouter la colonne prono_or si elle n'existe pas
try {
  db.exec('ALTER TABLE pronostics ADD COLUMN prono_or TEXT');
  console.log('✅ Colonne prono_or ajoutée à la table pronostics');
} catch (e) {
  // La colonne existe déjà, c'est OK
}

// Migration: Ajouter la colonne culture_g_score si elle n'existe pas
try {
  db.exec('ALTER TABLE scores ADD COLUMN culture_g_score REAL DEFAULT 0');
  console.log('✅ Colonne culture_g_score ajoutée à la table scores');
} catch (e) {
  // La colonne existe déjà, c'est OK
}

// Migration: Ajouter la colonne culture_g_correct pour le nombre de bonnes réponses
try {
  db.exec('ALTER TABLE scores ADD COLUMN culture_g_correct INTEGER DEFAULT 0');
  console.log('✅ Colonne culture_g_correct ajoutée à la table scores');
} catch (e) {
  // La colonne existe déjà, c'est OK
}

// Migration: Ajouter la colonne costume_photo pour les photos de déguisement
try {
  db.exec('ALTER TABLE users ADD COLUMN costume_photo TEXT');
  console.log('✅ Colonne costume_photo ajoutée à la table users');
} catch (e) {
  // La colonne existe déjà, c'est OK
}

// Migration: Ajouter la colonne costume_photo_public pour savoir si la photo est partagée dans la galerie
try {
  db.exec('ALTER TABLE users ADD COLUMN costume_photo_public INTEGER DEFAULT 0');
  console.log('✅ Colonne costume_photo_public ajoutée à la table users');
} catch (e) {
  // La colonne existe déjà, c'est OK
}

// Créer le dossier uploads si nécessaire
const uploadsDir = path.join(uploadsBaseDir, 'costumes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Dossier uploads créé: ${uploadsDir}`);
}

// Configuration Multer pour l'upload de photos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG ou WebP.'));
    }
  }
});

// Initialiser la ligne des résultats officiels si elle n'existe pas
const existingResults = db.prepare('SELECT id FROM official_results WHERE id = 1').get();
if (!existingResults) {
  db.prepare('INSERT INTO official_results (id, current_step) VALUES (1, 0)').run();
  console.log('✅ Table official_results initialisée');
}

// Créer les utilisateurs admin s'ils n'existent pas
const adminUsers = [
  { pseudo: 'Dam admin', password: 'brad' },
  { pseudo: 'lucie admin', password: 'janet' }
];

adminUsers.forEach(admin => {
  const existingAdmin = db.prepare('SELECT * FROM users WHERE pseudo = ?').get(admin.pseudo);
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(admin.password, 10);
    const result = db.prepare('INSERT INTO users (pseudo, password, is_admin) VALUES (?, ?, 1)').run(admin.pseudo, hashedPassword);
    db.prepare('INSERT INTO scores (user_id) VALUES (?)').run(result.lastInsertRowid);
    console.log(`✅ Utilisateur admin créé (pseudo: ${admin.pseudo})`);
  }
});

// Supprimer l'ancien admin "admin" s'il existe
const oldAdmin = db.prepare('SELECT * FROM users WHERE pseudo = ?').get('admin');
if (oldAdmin) {
  db.prepare('DELETE FROM scores WHERE user_id = ?').run(oldAdmin.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(oldAdmin.id);
  console.log('✅ Ancien admin "admin" supprimé');
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

// Sur Railway, servir les uploads depuis le volume /data/uploads
if (isRailway) {
  app.use('/uploads', express.static(uploadsBaseDir));
  console.log(`📂 Uploads servis depuis: ${uploadsBaseDir}`);
}

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

  // Empêcher la création d'un compte admin
  const reservedPseudos = ['admin', 'dam admin', 'lucie admin'];
  if (reservedPseudos.includes(pseudo.toLowerCase())) {
    return res.status(400).json({ error: 'Ce pseudo est réservé' });
  }

  try {
    // Vérifier si le pseudo existe déjà (case-insensitive)
    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(pseudo) = LOWER(?)').get(pseudo);
    if (existingUser) {
      return res.status(400).json({ error: 'Ce pseudo existe déjà' });
    }

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

  // Recherche case-insensitive du pseudo
  const user = db.prepare('SELECT * FROM users WHERE LOWER(pseudo) = LOWER(?)').get(pseudo);

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

// ============================================
// QUESTIONNAIRE CULTURE GÉNÉRALE MISS FRANCE 2026
// Questionnaire officiel passé par les candidates
// ============================================
const cultureGQuestions = {
  actualite: {
    name: "Actualité",
    totalPoints: 10,
    questions: [
      { id: "actu1", question: "Quelle est la capitale de l'Ukraine, pays encore au cœur de l'actualité internationale en 2025 ?", type: "text", correct: ["Kiev", "Kyiv"], points: 1 },
      { id: "actu2", question: "Quel droit fondamental pour les femmes a été inscrit dans la Constitution française le 8 mars 2024 ?", type: "text", correct: ["IVG", "avortement", "le libre recours à l'IVG", "droit à l'avortement", "droit à l'IVG"], points: 1 },
      { id: "actu3", question: "Quel événement organisé par le vidéaste Squeezie a eu lieu sur le circuit Bugatti du Mans en octobre dernier ?", type: "text", correct: ["GP Explorer", "GP Explorer 3", "Grand Prix Explorer"], points: 1 },
      { id: "actu4", question: "À quelle espèce animale Jane Goodall, décédée en octobre dernier, a-t-elle consacré sa carrière ?", type: "text", correct: ["chimpanzés", "chimpanzé", "singes", "singe"], points: 1 },
      { id: "actu5", question: "Quel produit alimentaire à base de framboises congelées est devenu un phénomène viral sur TikTok ?", type: "text", correct: ["Franui", "Franuì"], points: 1 },
      { id: "actu6", question: "Quel club de football a remporté la Ligue des Champions en mai 2025 ?", type: "text", correct: ["PSG", "Paris Saint-Germain", "Paris SG"], points: 1 },
      { id: "actu7", question: "Vrai ou faux : le DSA a été mis en place pour réglementer les services numériques ?", type: "single", answers: ["Vrai", "Faux"], correct: 0, points: 1, bonus: { question: "De quel nom DSA est-il l'acronyme ?", correct: ["Digital Services Act"], points: 0.5 } },
      { id: "actu8", question: "Quelle personnalité décédée en 2024 a fait son entrée au Panthéon le 9 octobre 2025 ?", type: "text", correct: ["Robert Badinter", "Badinter"], points: 1 },
      { id: "actu9", question: "Quelle est la nationalité de María Corina Machado qui a reçu le prix Nobel de la paix en octobre dernier ?", type: "text", correct: ["vénézuélienne", "vénézuelienne", "venezuelienne", "Venezuela"], points: 1 },
      { id: "actu10", question: "Quel joueur a remporté le tournoi de Roland-Garros en juin 2025 ?", type: "text", correct: ["Carlos Alcaraz", "Alcaraz"], points: 1 }
    ]
  },
  histoire_geo: {
    name: "Histoire / Géographie",
    totalPoints: 10,
    questions: [
      { id: "hg1", question: "En quelle année a eu lieu la chute du mur de Berlin ?", type: "single", answers: ["1979", "1981", "1989", "1991"], correct: 2, points: 1 },
      { id: "hg2", question: "Qui était le premier empereur de Rome ?", type: "single", answers: ["Jules César", "Auguste", "Astérix", "Trajan"], correct: 1, points: 1 },
      { id: "hg3", question: "Quel mot est cité en premier dans La Marseillaise ?", type: "single", answers: ["Compagnes", "Campagnes", "Citoyens", "Armes"], correct: 1, points: 1 },
      { id: "hg4", question: "Quel roi a construit le célèbre château de Chambord et est associé à la Renaissance française ?", type: "single", answers: ["François Ier", "Louis XIV", "Henri II", "Louis XV"], correct: 0, points: 1 },
      { id: "hg5", question: "Quel événement historique a-t-on commémoré en France le 8 mai 2025 ?", type: "single", answers: ["Les 80 ans de l'abolition de la peine de mort", "Les 80 ans de la fête du Travail", "Les 80 ans de la fin de la guerre froide", "Les 80 ans de la fin de la Seconde Guerre mondiale en Europe"], correct: 3, points: 1 },
      { id: "hg6", question: "Qui proclame officiellement les résultats de l'élection présidentielle en France ?", type: "single", answers: ["Conseil d'État", "Conseil constitutionnel", "Cour de cassation", "Assemblée nationale"], correct: 1, points: 1, bonus: { question: "Quand aura lieu la prochaine élection présidentielle en France ?", correct: ["2027"], points: 0.5 } },
      { id: "hg7", question: "Lesquels de ces dieux appartiennent à la mythologie égyptienne ?", type: "multiple", answers: ["Râ", "Anubis", "Apollon", "Osiris"], correct: [0, 1, 3], points: 1 },
      { id: "hg8", question: "Laquelle de ces inventions est la plus ancienne ?", type: "single", answers: ["Photographie", "Téléphone", "Radio", "Télévision"], correct: 0, points: 1 },
      { id: "hg9", question: "La Préhistoire prend fin avec :", type: "single", answers: ["La disparition des dinosaures", "L'invention de l'écriture", "La chute de l'empire romain", "L'invention des smartphones"], correct: 1, points: 1 },
      { id: "hg10", question: "Quel est le plus grand désert du monde par sa superficie ?", type: "single", answers: ["Sahara", "Gobi", "Antarctique", "Kalahari"], correct: 2, points: 1 }
    ]
  },
  arts: {
    name: "Arts et Divertissements",
    totalPoints: 12,
    questions: [
      { id: "art1", question: "Quel est l'autre nom donné à la Joconde ?", type: "single", answers: ["Lisa Maria", "Mona Lisa", "Dona Amalia", "Il n'y en a pas d'autre"], correct: 1, points: 1, bonus: { question: "Qui a peint La Joconde ?", correct: ["Léonard de Vinci", "Leonard de Vinci", "De Vinci", "Vinci"], points: 0.5 } },
      { id: "art2", question: "Lesquels de ces films sont l'adaptation d'une œuvre littéraire ?", type: "multiple", answers: ["Le Comte de Monte-Cristo", "Hunger Games", "Harry Potter", "Dune"], correct: [0, 1, 2, 3], points: 1 },
      { id: "art3", question: "Qui a sculpté le Penseur de Rodin ?", type: "single", answers: ["Léonard de Vinci", "Picasso", "Rodin", "Camille Claudel"], correct: 2, points: 1 },
      { id: "art4", question: "Lequel de ces longs métrages de Walt Disney est le plus ancien ?", type: "single", answers: ["La Petite Sirène", "La Belle et la Bête", "Blanche-Neige", "Peter Pan"], correct: 2, points: 1 },
      { id: "art5", question: "Pour quelle série Owen Cooper a-t-il été le plus jeune acteur à recevoir un Emmy Awards à seulement 15 ans ?", type: "single", answers: ["Stranger Things", "La chronique des Bridgerton", "Mercredi", "Adolescence"], correct: 3, points: 1 },
      { id: "art6", question: "Quelle information est fausse concernant la Vénus de Milo ?", type: "single", answers: ["Il lui manque les deux bras", "Il lui manque la tête", "Un drapé lui couvre le bas du corps", "Elle est seins nus"], correct: 1, points: 1 },
      { id: "art7", question: "Quels sont les points communs entre The Voice, Star Academy, NRJ Music Awards ?", type: "multiple", answers: ["Ils sont animés par la même personne", "Ils sont diffusés sur TF1", "Ils sont tournés à Cannes", "Ils sont dédiés à la chanson"], correct: [0, 1, 3], points: 1, bonus: { question: "Qui les présente ?", correct: ["Nikos Aliagas", "Nikos", "Aliagas"], points: 0.5 } },
      { id: "art8", question: "Quel peintre a donné son nom à une couleur ?", type: "single", answers: ["Yves Klein", "Claude Monet", "Gustave Klimt", "Salvador Dalí"], correct: 0, points: 1, bonus: { question: "Quelle est cette couleur ?", correct: ["bleu", "bleu Klein"], points: 0.5 } },
      { id: "art9", question: "Quel écrivain est l'auteur de « Vingt mille lieues sous les mers » ?", type: "single", answers: ["Jules Verne", "Guy de Maupassant", "Émile Zola", "Victor Hugo"], correct: 0, points: 1 },
      { id: "art10", question: "Quelle chanteuse francophone interprète le titre « Ensemble » aux côtés d'Aliocha Schneider ?", type: "single", answers: ["Angèle", "Aya Nakamura", "Charlotte Cardin", "Clara Luciani"], correct: 2, points: 1 },
      { id: "art11", question: "Qui est le nouveau directeur artistique des collections femme et homme chez Dior ?", type: "single", answers: ["Maria Grazia Chiuri", "Jonathan Anderson", "Karl Lagerfeld", "Hedi Slimane"], correct: 1, points: 1 },
      { id: "art12", question: "Quel est le youtubeur français qui cumule à ce jour le plus d'abonnés sur YouTube ?", type: "single", answers: ["Tibo InShape", "Squeezie", "Loft Girl", "Cyprien"], correct: 0, points: 1 }
    ]
  },
  sciences: {
    name: "Sciences",
    totalPoints: 6,
    questions: [
      { id: "sci1", question: "Quel composant du corps humain transporte l'oxygène dans le sang grâce à l'hémoglobine ?", type: "single", answers: ["Les globules blancs", "Les plaquettes", "Le plasma", "Les globules rouges"], correct: 3, points: 1 },
      { id: "sci2", question: "Pourquoi la Lune présente-t-elle des phases (croissant, quartier, pleine Lune) ?", type: "single", answers: ["La Lune change de taille tous les 28 jours", "Les phases varient selon la distance entre la Lune et la Terre", "Elles dépendent de la portion de Lune éclairée par le Soleil et visible depuis la Terre", "Des nuages interstellaires la recouvrent occasionnellement"], correct: 2, points: 1 },
      { id: "sci3", question: "Une année bissextile compte combien de jours ?", type: "text", correct: ["366", "366 jours"], points: 1 },
      { id: "sci4", question: "Quel est l'aliment qui ne pourrit jamais, même après 3000 ans ?", type: "single", answers: ["Le fromage", "Le miel", "Le chocolat", "Un vieux burger oublié sous un lit"], correct: 1, points: 1 },
      { id: "sci5", question: "Sur une bicyclette classique, laquelle des deux roues est motrice ?", type: "single", answers: ["Les deux roues", "La roue avant", "La roue arrière", "Aucune"], correct: 2, points: 1 },
      { id: "sci6", question: "En mathématiques, un nombre premier est un nombre…", type: "single", answers: ["Pair", "Plus grand que 10", "Qui se termine par 1", "Divisible uniquement par 1 et lui-même"], correct: 3, points: 1, bonus: { question: "Quel est le nombre premier qui arrive juste après 17 ?", correct: ["19"], points: 0.5 } }
    ]
  },
  probleme: {
    name: "Problème",
    totalPoints: 3,
    questions: [
      { id: "prob1", question: "Si l'avion qui vous a emmené en Martinique volait à 840 km/h, quelle distance avez-vous parcouru en 2h15 ?", type: "text", correct: ["1890", "1890 km", "1890km", "1 890 km"], points: 3 }
    ]
  },
  miss: {
    name: "Le monde des Miss",
    totalPoints: 4,
    questions: [
      { id: "miss1", question: "Quelle est l'année de règne de la première Miss Martinique élue Miss France ?", type: "text", correct: ["2025"], points: 1 },
      { id: "miss2", question: "Combien de Miss France Jean-Pierre Foucault a-t-il déjà couronnées ?", type: "text", correct: ["30"], points: 1 },
      { id: "miss3", question: "En quelle année Camille Cerf a-t-elle été élue Miss France ?", type: "text", correct: ["2014", "2015", "6 décembre 2014"], points: 1, info: "Elle est Miss France 2015, élue le 6 décembre 2014" },
      { id: "miss4", question: "Dans quelle ville aura lieu l'élection de Miss Univers dans quelques jours ?", type: "text", correct: ["Pak Kret", "Bangkok", "Thaïlande"], points: 1 }
    ]
  },
  francais: {
    name: "Français",
    totalPoints: 10,
    questions: [
      { id: "fr1", question: "Combien pèse un éléphant ?", type: "single", answers: ["Trois cent kilos", "Trois cents kilos"], correct: 1, points: 1 },
      { id: "fr2", question: "Et un hippopotame ?", type: "single", answers: ["Trois cent cinquante kilos", "Trois cents cinquante kilos"], correct: 0, points: 1 },
      { id: "fr3", question: "Pour l'Académie française, que dit-on fréquemment, bien que cela soit une faute ?", type: "single", answers: ["En vélo", "À cheval", "En voiture"], correct: 0, points: 1 },
      { id: "fr4", question: "Quel mot n'est pas du genre masculin ?", type: "single", answers: ["Hémisphère", "Tentacule", "Pétale", "Octave"], correct: 3, points: 1 },
      { id: "fr5", question: "Complétez : \"Il ne faut pas en faire tout un...\"", type: "text", correct: ["fromage"], points: 0.5 },
      { id: "fr5b", question: "Complétez : \"Rira bien qui rira...\"", type: "text", correct: ["le dernier"], points: 0.5 },
      { id: "fr5c", question: "Complétez : \"Il ne faut pas se mettre ... en tête\"", type: "text", correct: ["martel"], points: 0.5 },
      { id: "fr5d", question: "Complétez : \"Ça ne casse pas trois pattes...\"", type: "text", correct: ["à un canard", "a un canard"], points: 0.5 },
      { id: "fr6", question: "Quel mot se termine toujours par un « S » au singulier comme au pluriel ?", type: "multiple", answers: ["Bigoudis", "Canaris", "Soucis"], correct: [0, 1, 2], points: 1 },
      { id: "fr7", question: "Dans quelle phrase y a-t-il une faute ?", type: "single", answers: ["Tu as été élue", "Vous avez été sacrée", "Nous avons été photographié", "Elles ont été sauvées"], correct: 2, points: 1 },
      { id: "fr8", question: "Comment écrire : « je veux faire ……… de la bande » ?", type: "single", answers: ["Parti", "Partis", "Partie", "Partit"], correct: 2, points: 1 },
      { id: "fr9", question: "Lequel de ces mots n'est pas un palindrome ?", type: "single", answers: ["Rêver", "Rire", "Stats", "Coloc"], correct: 1, points: 1 },
      { id: "fr10", question: "Les abeilles sont importantes pour l'agriculture surtout parce qu'elles…", type: "single", answers: ["Pollonisent les plantes", "Pollinisent les plantes", "Pallonisent les plantes", "Polonnisent les plantes"], correct: 1, points: 1 }
    ]
  },
  anglais: {
    name: "Anglais",
    totalPoints: 10,
    questions: [
      { id: "en1", question: "Which letter doesn't appear in the name of any U.S. state?", type: "single", answers: ["Q", "Z", "X", "J"], correct: 0, points: 1 },
      { id: "en2", question: "How many sides are there on a french STOP sign?", type: "single", answers: ["3 sides", "6 sides", "8 sides", "10 sides"], correct: 2, points: 1 },
      { id: "en3", question: "How long is the presidential term in the United States?", type: "single", answers: ["3 years", "4 years", "5 years", "7 years"], correct: 1, points: 1 },
      { id: "en4", question: "A t-shirt costs €16. There is a 25% discount throughout the store. You also get an additional €3 off. How much will you pay for the t-shirt?", type: "text", correct: ["9", "9€", "9 euros", "9 €"], points: 1 },
      { id: "en5", question: "In what year did the first man walk on the Moon?", type: "single", answers: ["1967", "1969", "1971", "1973"], correct: 1, points: 1, bonus: { question: "Who was he?", correct: ["Neil Armstrong", "Armstrong"], points: 0.5 } },
      { id: "en6", question: "Complete: \"Every year, Miss France ... a beautiful crown.\" (Use the verb To wear)", type: "text", correct: ["wears"], points: 1 },
      { id: "en7", question: "Complete: \"I .... to become Miss France when I was a little girl.\" (past tense)", type: "text", correct: ["dreamed", "wished", "wanted"], points: 1 },
      { id: "en8", question: "Complete: \"This is ... amazing opportunity for all the contestants.\"", type: "text", correct: ["an"], points: 1 },
      { id: "en9", question: "Complete: \"The candidates come .... all regions of France.\"", type: "text", correct: ["from"], points: 1 },
      { id: "en10", question: "Complete: \"The crown is .... than last year's.\" (Use shine)", type: "text", correct: ["shinier"], points: 1 }
    ]
  },
  logique: {
    name: "Logique",
    totalPoints: 3,
    questions: [
      { id: "log1", question: "Quel mot peut-on associer à ces trois définitions : Un novice, une combinaison de travail, une couleur.", type: "single", answers: ["Rouge", "Bleu", "Blanc", "Jaune"], correct: 1, points: 1 },
      { id: "log6", question: "3 poissons sont dans un seau. L'un meurt. Combien en reste-t-il ?", type: "text", correct: ["3"], points: 1, info: "Il est mort mais toujours dans le seau !" },
      { id: "log7", question: "Si avant-hier on était mardi, quel jour serons-nous après-demain ?", type: "text", correct: ["samedi", "Samedi"], points: 1 }
    ]
  }
};

// Calculer le total des points du questionnaire Culture G
const cultureGTotalPoints = Object.values(cultureGQuestions).reduce((total, category) => total + category.totalPoints, 0);

app.get('/api/quiz/questions', requireAuth, (req, res) => {
  // Récupérer les questions déjà répondues par l'utilisateur
  const answeredQuestions = db.prepare('SELECT question_id FROM quiz_answers WHERE user_id = ?')
    .all(req.session.userId)
    .map(a => a.question_id);

  // Ne retourner que les questions non répondues
  const unansweredQuestions = quizQuestions.filter(q => !answeredQuestions.includes(q.id));

  res.json({
    questions: unansweredQuestions,
    totalQuestions: quizQuestions.length,
    answeredCount: answeredQuestions.length,
    isCompleted: unansweredQuestions.length === 0
  });
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
  const newTotalScore = newQuizScore + (currentScore.pronostics_score || 0) + (currentScore.defis_score || 0) + (currentScore.culture_g_score || 0);

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

// ============================================
// ROUTES QUESTIONNAIRE CULTURE G OFFICIEL
// ============================================

// Récupérer les questions du questionnaire Culture G
app.get('/api/culture-g/questions', requireAuth, (req, res) => {
  // Récupérer les réponses déjà données par l'utilisateur
  const answeredQuestions = db.prepare('SELECT question_id FROM culture_g_answers WHERE user_id = ?')
    .all(req.session.userId)
    .map(a => a.question_id);

  // Préparer les questions par catégorie
  const questionsWithStatus = {};
  let totalQuestions = 0;

  Object.entries(cultureGQuestions).forEach(([categoryKey, category]) => {
    questionsWithStatus[categoryKey] = {
      name: category.name,
      totalPoints: category.totalPoints,
      questions: category.questions.map(q => ({
        ...q,
        answered: answeredQuestions.includes(q.id)
      }))
    };
    totalQuestions += category.questions.length;
  });

  res.json({
    categories: questionsWithStatus,
    totalQuestions,
    answeredCount: answeredQuestions.length,
    totalPoints: cultureGTotalPoints,
    isCompleted: answeredQuestions.length >= totalQuestions
  });
});

// Récupérer la progression de l'utilisateur
app.get('/api/culture-g/progress', requireAuth, (req, res) => {
  const answers = db.prepare('SELECT * FROM culture_g_answers WHERE user_id = ?').all(req.session.userId);
  const totalPoints = answers.reduce((sum, a) => sum + (a.points || 0), 0);

  // Compter les questions par catégorie
  const categoryProgress = {};
  Object.entries(cultureGQuestions).forEach(([categoryKey, category]) => {
    const categoryAnswers = answers.filter(a => a.question_id.startsWith(categoryKey.substring(0, 3)));
    categoryProgress[categoryKey] = {
      name: category.name,
      answered: categoryAnswers.length,
      total: category.questions.length,
      points: categoryAnswers.reduce((sum, a) => sum + (a.points || 0), 0),
      maxPoints: category.totalPoints
    };
  });

  let totalQuestions = Object.values(cultureGQuestions).reduce((sum, cat) => sum + cat.questions.length, 0);

  res.json({
    totalAnswers: answers.length,
    totalQuestions,
    correctAnswers: answers.filter(a => a.is_correct).length,
    totalPoints,
    maxPoints: cultureGTotalPoints,
    categoryProgress,
    isCompleted: answers.length >= totalQuestions
  });
});

// Soumettre une réponse au questionnaire Culture G
app.post('/api/culture-g/answer', requireAuth, (req, res) => {
  const { questionId, answer, bonusAnswer } = req.body;

  // Trouver la question dans les catégories
  let question = null;
  let categoryKey = null;

  for (const [key, category] of Object.entries(cultureGQuestions)) {
    const found = category.questions.find(q => q.id === questionId);
    if (found) {
      question = found;
      categoryKey = key;
      break;
    }
  }

  if (!question) {
    return res.status(404).json({ error: 'Question non trouvée' });
  }

  // Vérifier si l'utilisateur a déjà répondu à cette question
  const existingAnswer = db.prepare('SELECT id FROM culture_g_answers WHERE user_id = ? AND question_id = ?')
    .get(req.session.userId, questionId);

  if (existingAnswer) {
    return res.status(400).json({ error: 'Tu as déjà répondu à cette question' });
  }

  let isCorrect = false;
  let points = 0;
  let correctAnswer = '';
  let bonusCorrect = false;
  let bonusPoints = 0;

  // Vérifier la réponse selon le type de question
  if (question.type === 'single') {
    isCorrect = answer === question.correct;
    points = isCorrect ? question.points : 0;
    correctAnswer = question.answers[question.correct];
  } else if (question.type === 'multiple') {
    // Pour les questions à choix multiples, vérifier si toutes les bonnes réponses sont sélectionnées
    const userAnswers = Array.isArray(answer) ? answer.sort() : [];
    const correctAnswers = question.correct.sort();
    isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
    points = isCorrect ? question.points : 0;
    correctAnswer = question.correct.map(i => question.answers[i]).join(', ');
  } else if (question.type === 'text') {
    // Pour les questions texte, vérifier si la réponse correspond à l'une des réponses acceptées
    const userAnswer = answer.toString().toLowerCase().trim();
    isCorrect = question.correct.some(c => c.toLowerCase().trim() === userAnswer);
    points = isCorrect ? question.points : 0;
    correctAnswer = question.correct[0];
  }

  // Vérifier le bonus si présent
  if (question.bonus && bonusAnswer) {
    const userBonus = bonusAnswer.toString().toLowerCase().trim();
    bonusCorrect = question.bonus.correct.some(c => c.toLowerCase().trim() === userBonus);
    bonusPoints = bonusCorrect ? question.bonus.points : 0;
    points += bonusPoints;
  }

  // Enregistrer la réponse (on garde les points pour info mais on ne les ajoute pas au total)
  db.prepare('INSERT INTO culture_g_answers (user_id, question_id, answer, is_correct, points) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.userId, questionId, JSON.stringify({ main: answer, bonus: bonusAnswer }), isCorrect ? 1 : 0, points);

  // Mettre à jour le compteur de bonnes réponses (pas le score final)
  if (isCorrect) {
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
    const newCultureGCorrect = (currentScore.culture_g_correct || 0) + 1;
    db.prepare('UPDATE scores SET culture_g_correct = ? WHERE user_id = ?')
      .run(newCultureGCorrect, req.session.userId);
  }

  res.json({
    correct: isCorrect,
    rawPoints: points,
    correctAnswer: correctAnswer,
    bonusCorrect: bonusCorrect,
    bonusPoints: bonusPoints,
    info: question.info || null
  });
});

// Soumettre toutes les réponses d'une catégorie en une fois
app.post('/api/culture-g/submit-category', requireAuth, (req, res) => {
  const { categoryKey, answers } = req.body;

  const category = cultureGQuestions[categoryKey];
  if (!category) {
    return res.status(404).json({ error: 'Catégorie non trouvée' });
  }

  let totalPoints = 0;
  let correctCount = 0;
  const results = [];

  for (const [questionId, answerData] of Object.entries(answers)) {
    // Vérifier si déjà répondu
    const existingAnswer = db.prepare('SELECT id FROM culture_g_answers WHERE user_id = ? AND question_id = ?')
      .get(req.session.userId, questionId);

    if (existingAnswer) continue;

    const question = category.questions.find(q => q.id === questionId);
    if (!question) continue;

    let isCorrect = false;
    let points = 0;
    let correctAnswer = '';

    const answer = answerData.main;
    const bonusAnswer = answerData.bonus;

    // Vérifier la réponse selon le type
    if (question.type === 'single') {
      isCorrect = answer === question.correct;
      points = isCorrect ? question.points : 0;
      correctAnswer = question.answers[question.correct];
    } else if (question.type === 'multiple') {
      const userAnswers = Array.isArray(answer) ? answer.sort() : [];
      const correctAnswers = question.correct.sort();
      isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
      points = isCorrect ? question.points : 0;
      correctAnswer = question.correct.map(i => question.answers[i]).join(', ');
    } else if (question.type === 'text') {
      const userAnswer = (answer || '').toString().toLowerCase().trim();
      isCorrect = question.correct.some(c => c.toLowerCase().trim() === userAnswer);
      points = isCorrect ? question.points : 0;
      correctAnswer = question.correct[0];
    }

    // Bonus
    if (question.bonus && bonusAnswer) {
      const userBonus = bonusAnswer.toString().toLowerCase().trim();
      const bonusCorrect = question.bonus.correct.some(c => c.toLowerCase().trim() === userBonus);
      if (bonusCorrect) points += question.bonus.points;
    }

    // Enregistrer
    db.prepare('INSERT INTO culture_g_answers (user_id, question_id, answer, is_correct, points) VALUES (?, ?, ?, ?, ?)')
      .run(req.session.userId, questionId, JSON.stringify(answerData), isCorrect ? 1 : 0, points);

    totalPoints += points;
    if (isCorrect) correctCount++;

    results.push({ questionId, isCorrect, points, correctAnswer });
  }

  // Mettre à jour le compteur de bonnes réponses (pas le score final - celui-ci sera attribué par l'admin)
  if (correctCount > 0) {
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
    const newCultureGCorrect = (currentScore.culture_g_correct || 0) + correctCount;
    db.prepare('UPDATE scores SET culture_g_correct = ? WHERE user_id = ?')
      .run(newCultureGCorrect, req.session.userId);
  }

  res.json({
    success: true,
    rawPoints: totalPoints,
    correctCount,
    results
  });
});

// Classement Culture G avec scores bruts (pour le leaderboard)
app.get('/api/culture-g/leaderboard', requireAuth, (req, res) => {
  const ranking = db.prepare(`
    SELECT u.id, u.pseudo,
           COALESCE(SUM(cga.points), 0) as raw_score,
           s.culture_g_score as awarded_points
    FROM users u
    LEFT JOIN culture_g_answers cga ON u.id = cga.user_id
    LEFT JOIN scores s ON u.id = s.user_id
    WHERE u.is_admin = 0
    GROUP BY u.id
    ORDER BY raw_score DESC, u.pseudo ASC
  `).all();

  res.json(ranking);
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
  const { top15, bonusTop15, pronoOr } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM pronostics WHERE user_id = ?').get(req.session.userId);

    if (existing) {
      db.prepare(`UPDATE pronostics
        SET top15 = ?, bonus_top15 = ?, prono_or = ?, submitted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`)
        .run(JSON.stringify(top15), bonusTop15, pronoOr || null, req.session.userId);
    } else {
      db.prepare('INSERT INTO pronostics (user_id, top15, bonus_top15, prono_or) VALUES (?, ?, ?, ?)')
        .run(req.session.userId, JSON.stringify(top15), bonusTop15, pronoOr || null);
    }

    res.json({ success: true, message: 'Top 15 et Prono d\'Or enregistrés !' });
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
    pronostics.prono_or = pronostics.prono_or || null;
  }

  res.json(pronostics || null);
});

// Routes Défis
const defis = [
  { id: 1, title: "Couronne improvisée", description: "Fabrique une couronne avec ce que tu trouves", points: 15 }
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

  // Vérifier si déjà complété
  const existing = db.prepare('SELECT id FROM defis WHERE user_id = ? AND defi_id = ?').get(req.session.userId, defiId);
  if (existing) {
    return res.status(400).json({ error: 'Défi déjà complété' });
  }

  db.prepare('INSERT INTO defis (user_id, defi_id, completed, points) VALUES (?, ?, 1, ?)')
    .run(req.session.userId, defiId, defi.points);

  // Mettre à jour le score
  const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.session.userId);
  const newDefisScore = (currentScore.defis_score || 0) + defi.points;
  const newTotalScore = (currentScore.quiz_score || 0) + (currentScore.pronostics_score || 0) + newDefisScore + (currentScore.culture_g_score || 0);

  db.prepare('UPDATE scores SET defis_score = ?, total_score = ? WHERE user_id = ?')
    .run(newDefisScore, newTotalScore, req.session.userId);

  res.json({ success: true, points: defi.points });
});

// ============================================
// VOTE MEILLEUR COSTUME
// ============================================

// Récupérer la liste des joueurs pour la galerie (inclut tout le monde avec photos publiques)
app.get('/api/costume/players', requireAuth, (req, res) => {
  // Retourne tous les joueurs (sauf admin), montre costume_photo que si public
  const players = db.prepare(`
    SELECT id, pseudo,
           CASE WHEN costume_photo_public = 1 THEN costume_photo ELSE NULL END as costume_photo
    FROM users
    WHERE is_admin = 0
    ORDER BY pseudo
  `).all();

  res.json(players);
});

// Récupérer la liste des autres joueurs pour voter (exclut soi-même)
app.get('/api/costume/players-for-vote', requireAuth, (req, res) => {
  const players = db.prepare(`
    SELECT id, pseudo
    FROM users
    WHERE id != ? AND is_admin = 0
    ORDER BY pseudo
  `).all(req.session.userId);

  res.json(players);
});

// Récupérer ma photo de costume
app.get('/api/costume/my-photo', requireAuth, (req, res) => {
  const user = db.prepare('SELECT costume_photo, costume_photo_public FROM users WHERE id = ?').get(req.session.userId);
  res.json({
    photo: user?.costume_photo || null,
    isPublic: user?.costume_photo_public === 1
  });
});

// Uploader une photo de costume
app.post('/api/costume/upload-photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo fournie' });
    }

    const userId = req.session.userId;
    const filename = `costume_${userId}_${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    // Supprimer l'ancienne photo si elle existe
    const oldPhoto = db.prepare('SELECT costume_photo FROM users WHERE id = ?').get(userId);
    if (oldPhoto?.costume_photo) {
      // Construire le chemin physique selon l'environnement
      const relativePath = oldPhoto.costume_photo.replace('/uploads/', '');
      const oldPath = path.join(uploadsBaseDir, relativePath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Redimensionner et compresser l'image avec sharp
    await sharp(req.file.buffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    // Sauvegarder le chemin en base (photo non publique par défaut)
    const photoUrl = `/uploads/costumes/${filename}`;
    db.prepare('UPDATE users SET costume_photo = ?, costume_photo_public = 0 WHERE id = ?').run(photoUrl, userId);

    res.json({ success: true, photo: photoUrl, isPublic: false, message: 'Photo uploadée ! Clique sur "Ajouter à la galerie" pour la partager.' });
  } catch (error) {
    console.error('Erreur upload photo:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload de la photo' });
  }
});

// Supprimer ma photo de costume
app.delete('/api/costume/delete-photo', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const user = db.prepare('SELECT costume_photo FROM users WHERE id = ?').get(userId);

    if (user?.costume_photo) {
      // Construire le chemin physique selon l'environnement
      const relativePath = user.costume_photo.replace('/uploads/', '');
      const photoPath = path.join(uploadsBaseDir, relativePath);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
      db.prepare('UPDATE users SET costume_photo = NULL, costume_photo_public = 0 WHERE id = ?').run(userId);
    }

    res.json({ success: true, message: 'Photo supprimée' });
  } catch (error) {
    console.error('Erreur suppression photo:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Partager/retirer ma photo de la galerie
app.post('/api/costume/toggle-public', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const user = db.prepare('SELECT costume_photo, costume_photo_public FROM users WHERE id = ?').get(userId);

    if (!user?.costume_photo) {
      return res.status(400).json({ error: 'Tu dois d\'abord uploader une photo' });
    }

    const newPublicStatus = user.costume_photo_public === 1 ? 0 : 1;
    db.prepare('UPDATE users SET costume_photo_public = ? WHERE id = ?').run(newPublicStatus, userId);

    const message = newPublicStatus === 1
      ? 'Ta photo est maintenant visible dans la galerie !'
      : 'Ta photo a été retirée de la galerie';

    res.json({ success: true, isPublic: newPublicStatus === 1, message });
  } catch (error) {
    console.error('Erreur toggle public:', error);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// Vérifier si l'utilisateur a déjà voté
app.get('/api/costume/my-vote', requireAuth, (req, res) => {
  const vote = db.prepare(`
    SELECT cv.*, u.pseudo as voted_for_pseudo
    FROM costume_votes cv
    JOIN users u ON cv.voted_for = u.id
    WHERE cv.voter_id = ?
  `).get(req.session.userId);

  res.json(vote || null);
});

// Voter pour un joueur
app.post('/api/costume/vote', requireAuth, (req, res) => {
  const { votedForId } = req.body;

  if (!votedForId) {
    return res.status(400).json({ error: 'Sélectionne un joueur' });
  }

  // Vérifier que le joueur existe et n'est pas soi-même
  const targetPlayer = db.prepare('SELECT id, pseudo FROM users WHERE id = ?').get(votedForId);
  if (!targetPlayer) {
    return res.status(404).json({ error: 'Joueur non trouvé' });
  }

  if (votedForId === req.session.userId) {
    return res.status(400).json({ error: 'Tu ne peux pas voter pour toi-même !' });
  }

  // Vérifier si déjà voté
  const existingVote = db.prepare('SELECT id FROM costume_votes WHERE voter_id = ?').get(req.session.userId);

  if (existingVote) {
    // Mettre à jour le vote existant
    db.prepare('UPDATE costume_votes SET voted_for = ?, voted_at = CURRENT_TIMESTAMP WHERE voter_id = ?')
      .run(votedForId, req.session.userId);
  } else {
    // Créer un nouveau vote
    db.prepare('INSERT INTO costume_votes (voter_id, voted_for) VALUES (?, ?)')
      .run(req.session.userId, votedForId);
  }

  res.json({ success: true, message: `Vote enregistré pour ${targetPlayer.pseudo} !` });
});

// Récupérer les résultats des votes (classement)
app.get('/api/costume/results', requireAuth, (req, res) => {
  const results = db.prepare(`
    SELECT u.id, u.pseudo, COUNT(cv.id) as votes
    FROM users u
    LEFT JOIN costume_votes cv ON u.id = cv.voted_for
    WHERE u.is_admin = 0
    GROUP BY u.id
    ORDER BY votes DESC, u.pseudo ASC
  `).all();

  const totalVotes = db.prepare('SELECT COUNT(*) as count FROM costume_votes').get().count;

  res.json({ results, totalVotes });
});

// Route admin pour attribuer les points du concours costume
app.post('/api/admin/costume-awards', requireAuth, requireAdmin, (req, res) => {
  // Récupérer le classement
  const results = db.prepare(`
    SELECT u.id, u.pseudo, COUNT(cv.id) as votes
    FROM users u
    LEFT JOIN costume_votes cv ON u.id = cv.voted_for
    WHERE u.is_admin = 0
    GROUP BY u.id
    HAVING votes > 0
    ORDER BY votes DESC
  `).all();

  if (results.length === 0) {
    return res.status(400).json({ error: 'Aucun vote enregistré' });
  }

  // Attribuer les points: 1er = 30pts, 2ème = 20pts, 3ème = 10pts
  const pointsTable = [30, 20, 10];
  let awarded = [];

  results.forEach((player, index) => {
    if (index < 3 && player.votes > 0) {
      const points = pointsTable[index];

      // Mettre à jour le score
      const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(player.id);
      const newDefisScore = (currentScore.defis_score || 0) + points;
      const newTotalScore = (currentScore.quiz_score || 0) + (currentScore.pronostics_score || 0) + newDefisScore + (currentScore.culture_g_score || 0);

      db.prepare('UPDATE scores SET defis_score = ?, total_score = ? WHERE user_id = ?')
        .run(newDefisScore, newTotalScore, player.id);

      awarded.push({ pseudo: player.pseudo, votes: player.votes, points });
    }
  });

  res.json({ success: true, message: 'Points attribués !', awarded });
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

// Récupérer les statistiques
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  console.log('🔐 Admin stats requested by:', req.session.pseudo, 'isAdmin:', req.session.isAdmin);
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalPronostics = db.prepare('SELECT COUNT(*) as count FROM pronostics').get().count;

  console.log('📊 Stats:', { totalUsers, totalPronostics });

  res.json({
    totalUsers,
    totalPronostics
  });
});

// Route pour obtenir les résultats officiels validés (accessible à tous les utilisateurs)
app.get('/api/official-results', requireAuth, (req, res) => {
  const results = db.prepare('SELECT * FROM official_results WHERE id = 1').get();

  if (results) {
    results.top15 = results.top15 ? JSON.parse(results.top15) : [];
    results.top5 = results.top5 ? JSON.parse(results.top5) : [];
    results.classement_final = results.classement_final ? JSON.parse(results.classement_final) : [];
  }

  res.json(results || { current_step: 0 });
});

// ============================================
// ROUTES ADMIN - VALIDATION PAR ÉTAPE
// ============================================

// Étape 1: Valider le Top 15
app.post('/api/admin/validate-top15', requireAuth, requireAdmin, (req, res) => {
  const { top15 } = req.body;

  if (!top15 || !Array.isArray(top15) || top15.length !== 15) {
    return res.status(400).json({ error: 'Le top 15 doit contenir exactement 15 candidates' });
  }

  // Sauvegarder les résultats officiels (pas de bonus_top15 à saisir par l'admin)
  db.prepare(`
    UPDATE official_results
    SET top15 = ?, current_step = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(JSON.stringify(top15));

  // Calculer les scores pour tous les utilisateurs
  const allPronostics = db.prepare('SELECT * FROM pronostics').all();
  let usersUpdated = 0;
  let bonusWinners = 0;

  allPronostics.forEach(prono => {
    let pronosticsScore = 0;

    // Points pour le top 15 (5 pts par bonne réponse)
    if (prono.top15) {
      const top15User = JSON.parse(prono.top15);
      if (Array.isArray(top15User)) {
        top15User.forEach(candidate => {
          if (top15.includes(candidate)) {
            pronosticsScore += 5;
          }
        });
      }
    }

    // Bonus top15 (candidate qui ne passe pas) - 10 pts
    // Le joueur gagne si sa candidate bonus n'est PAS dans le top 15 validé
    if (prono.bonus_top15 && !top15.includes(prono.bonus_top15)) {
      pronosticsScore += 10;
      bonusWinners++;
    }

    // Mettre à jour le score
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(prono.user_id);
    const newTotalScore = (currentScore.quiz_score || 0) + pronosticsScore + (currentScore.defis_score || 0) + (currentScore.culture_g_score || 0);

    db.prepare('UPDATE scores SET pronostics_score = ?, total_score = ? WHERE user_id = ?')
      .run(pronosticsScore, newTotalScore, prono.user_id);

    usersUpdated++;
  });

  res.json({
    success: true,
    message: `Top 15 validé ! ${bonusWinners} joueur(s) ont gagné le bonus "pas dans le top 15".`,
    usersUpdated,
    bonusWinners,
    currentStep: 1
  });
});

// Étape 2: Valider le Top 5
app.post('/api/admin/validate-top5', requireAuth, requireAdmin, (req, res) => {
  const { top5 } = req.body;

  if (!top5 || !Array.isArray(top5) || top5.length !== 5) {
    return res.status(400).json({ error: 'Le top 5 doit contenir exactement 5 candidates' });
  }

  // Vérifier que l'étape 1 a été validée
  const currentResults = db.prepare('SELECT current_step, top15 FROM official_results WHERE id = 1').get();
  if (currentResults.current_step < 1) {
    return res.status(400).json({ error: 'Le top 15 doit être validé avant le top 5' });
  }

  // Sauvegarder les résultats officiels (pas de bonus à saisir par l'admin)
  db.prepare(`
    UPDATE official_results
    SET top5 = ?, current_step = 2, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(JSON.stringify(top5));

  // Recalculer les scores pour tous les utilisateurs (top15 + top5)
  const allPronostics = db.prepare('SELECT * FROM pronostics').all();
  const top15Official = JSON.parse(currentResults.top15);
  let usersUpdated = 0;
  let bonusTop15Winners = 0;
  let bonusTop5Winners = 0;

  allPronostics.forEach(prono => {
    let pronosticsScore = 0;

    // Points pour le top 15
    if (prono.top15) {
      const top15User = JSON.parse(prono.top15);
      if (Array.isArray(top15User)) {
        top15User.forEach(candidate => {
          if (top15Official.includes(candidate)) {
            pronosticsScore += 5;
          }
        });
      }
    }

    // Bonus top15 - le joueur gagne si sa candidate n'est PAS dans le top 15
    if (prono.bonus_top15 && !top15Official.includes(prono.bonus_top15)) {
      pronosticsScore += 10;
      bonusTop15Winners++;
    }

    // Points pour le top 5 (8 pts par bonne réponse)
    if (prono.top5) {
      const top5User = JSON.parse(prono.top5);
      if (Array.isArray(top5User)) {
        top5User.forEach(candidate => {
          if (top5.includes(candidate)) {
            pronosticsScore += 8;
          }
        });
      }
    }

    // Bonus top5 - le joueur gagne si sa candidate n'est PAS dans le top 5
    if (prono.bonus_top5 && !top5.includes(prono.bonus_top5)) {
      pronosticsScore += 20;
      bonusTop5Winners++;
    }

    // Mettre à jour le score
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(prono.user_id);
    const newTotalScore = (currentScore.quiz_score || 0) + pronosticsScore + (currentScore.defis_score || 0) + (currentScore.culture_g_score || 0);

    db.prepare('UPDATE scores SET pronostics_score = ?, total_score = ? WHERE user_id = ?')
      .run(pronosticsScore, newTotalScore, prono.user_id);

    usersUpdated++;
  });

  res.json({
    success: true,
    message: `Top 5 validé ! ${bonusTop5Winners} joueur(s) ont gagné le bonus "pas dans le top 5".`,
    usersUpdated,
    bonusTop5Winners,
    currentStep: 2
  });
});

// Étape 3: Valider le classement final
app.post('/api/admin/validate-final', requireAuth, requireAdmin, (req, res) => {
  const { classementFinal } = req.body;

  if (!classementFinal || !Array.isArray(classementFinal) || classementFinal.length !== 5) {
    return res.status(400).json({ error: 'Le classement final doit contenir exactement 5 candidates (1ère à 5ème)' });
  }

  // Vérifier que l'étape 2 a été validée
  const currentResults = db.prepare('SELECT * FROM official_results WHERE id = 1').get();
  if (currentResults.current_step < 2) {
    return res.status(400).json({ error: 'Le top 5 doit être validé avant le classement final' });
  }

  const missFramce2026 = classementFinal[0];

  // Sauvegarder les résultats officiels
  db.prepare(`
    UPDATE official_results
    SET classement_final = ?, miss_france = ?, current_step = 3, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(JSON.stringify(classementFinal), missFramce2026);

  // Recalculer les scores pour tous les utilisateurs (top15 + top5 + final + prono d'or)
  const allPronostics = db.prepare('SELECT * FROM pronostics').all();
  const top15Official = currentResults.top15 ? JSON.parse(currentResults.top15) : [];
  const top5Official = currentResults.top5 ? JSON.parse(currentResults.top5) : [];
  let usersUpdated = 0;
  let pronoOrWinners = 0;

  allPronostics.forEach(prono => {
    let pronosticsScore = 0;

    // Points pour le top 15
    if (prono.top15) {
      const top15User = JSON.parse(prono.top15);
      if (Array.isArray(top15User)) {
        top15User.forEach(candidate => {
          if (top15Official.includes(candidate)) {
            pronosticsScore += 5;
          }
        });
      }
    }

    // Bonus top15 - le joueur gagne si sa candidate n'est PAS dans le top 15
    if (prono.bonus_top15 && !top15Official.includes(prono.bonus_top15)) {
      pronosticsScore += 10;
    }

    // Points pour le top 5
    if (prono.top5) {
      const top5User = JSON.parse(prono.top5);
      if (Array.isArray(top5User)) {
        top5User.forEach(candidate => {
          if (top5Official.includes(candidate)) {
            pronosticsScore += 8;
          }
        });
      }
    }

    // Bonus top5 - le joueur gagne si sa candidate n'est PAS dans le top 5
    if (prono.bonus_top5 && !top5Official.includes(prono.bonus_top5)) {
      pronosticsScore += 20;
    }

    // Points pour le classement final (8 pts par position exacte)
    if (prono.classement_final) {
      const classementUser = JSON.parse(prono.classement_final);
      if (Array.isArray(classementUser)) {
        classementUser.forEach((candidate, index) => {
          if (classementFinal[index] === candidate) {
            pronosticsScore += 8;
          }
        });
      }
    }

    // PRONO D'OR - Miss France 2026 - 80 pts
    if (prono.prono_or && prono.prono_or === missFramce2026) {
      pronosticsScore += 80;
      pronoOrWinners++;
    }

    // Mettre à jour le score
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(prono.user_id);
    const newTotalScore = (currentScore.quiz_score || 0) + pronosticsScore + (currentScore.defis_score || 0) + (currentScore.culture_g_score || 0);

    db.prepare('UPDATE scores SET pronostics_score = ?, total_score = ? WHERE user_id = ?')
      .run(pronosticsScore, newTotalScore, prono.user_id);

    usersUpdated++;
  });

  res.json({
    success: true,
    message: `Classement final validé ! ${missFramce2026} est Miss France 2026 ! ${pronoOrWinners} joueur(s) ont gagné le Prono d'Or !`,
    usersUpdated,
    pronoOrWinners,
    currentStep: 3,
    missFramce2026
  });
});

// ============================================
// VALIDATION CULTURE G - Attribution des points 15/10/5
// ============================================

// Route pour voir le classement Culture G
app.get('/api/admin/culture-g-ranking', requireAuth, requireAdmin, (req, res) => {
  // Récupérer tous les utilisateurs avec leur nombre de bonnes réponses Culture G
  const rankings = db.prepare(`
    SELECT u.id, u.pseudo, s.culture_g_correct, s.culture_g_score,
           (SELECT COUNT(*) FROM culture_g_answers WHERE user_id = u.id) as total_answered
    FROM users u
    JOIN scores s ON u.id = s.user_id
    WHERE u.is_admin = 0
    ORDER BY s.culture_g_correct DESC, total_answered DESC
  `).all();

  res.json({
    rankings,
    isValidated: rankings.some(r => r.culture_g_score > 0)
  });
});

// Route pour valider et attribuer les points Culture G (15/10/5)
app.post('/api/admin/validate-culture-g', requireAuth, requireAdmin, (req, res) => {
  // Vérifier si déjà validé
  const alreadyValidated = db.prepare('SELECT id FROM scores WHERE culture_g_score > 0').get();
  if (alreadyValidated) {
    return res.status(400).json({ error: 'Culture G déjà validé ! Les points ont déjà été attribués.' });
  }

  // Récupérer le classement des joueurs par nombre de bonnes réponses
  const rankings = db.prepare(`
    SELECT u.id, u.pseudo, s.culture_g_correct
    FROM users u
    JOIN scores s ON u.id = s.user_id
    WHERE u.is_admin = 0 AND s.culture_g_correct > 0
    ORDER BY s.culture_g_correct DESC
  `).all();

  if (rankings.length === 0) {
    return res.status(400).json({ error: 'Aucun joueur n\'a participé au questionnaire Culture G' });
  }

  const pointsToAward = [15, 10, 5];
  const winners = [];

  // Attribuer les points aux 3 premiers
  for (let i = 0; i < Math.min(3, rankings.length); i++) {
    const user = rankings[i];
    const points = pointsToAward[i];

    // Mettre à jour le score
    const currentScore = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(user.id);
    const newCultureGScore = points;
    const newTotalScore = (currentScore.quiz_score || 0) + (currentScore.pronostics_score || 0) +
                          (currentScore.defis_score || 0) + newCultureGScore;

    db.prepare('UPDATE scores SET culture_g_score = ?, total_score = ? WHERE user_id = ?')
      .run(newCultureGScore, newTotalScore, user.id);

    winners.push({
      rank: i + 1,
      pseudo: user.pseudo,
      correctAnswers: user.culture_g_correct,
      pointsAwarded: points
    });
  }

  res.json({
    success: true,
    message: 'Culture G validé ! Points attribués aux 3 meilleurs.',
    winners
  });
});

// Route admin pour valider les résultats réels (LEGACY - conservée pour compatibilité)
app.post('/api/admin/validate-results', requireAuth, requireAdmin, (req, res) => {
  const { top15Real, bonusTop15Real, top5Real, bonusTop5Real, classementFinalReal } = req.body;

  // Récupérer tous les pronostics
  const allPronostics = db.prepare('SELECT * FROM pronostics').all();

  // La Miss France est la première du classement final
  const missFramce2026 = classementFinalReal && classementFinalReal[0] ? classementFinalReal[0] : null;

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

    // Bonus top15 (candidate qui ne passe pas) - 10 pts
    if (prono.bonus_top15 && prono.bonus_top15 === bonusTop15Real) {
      score += 10;
    }

    // PRONO D'OR - Miss France 2026 - 80 pts
    if (prono.prono_or && missFramce2026 && prono.prono_or === missFramce2026) {
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
    const newTotalScore = (currentScore.quiz_score || 0) + score + (currentScore.defis_score || 0) + (currentScore.culture_g_score || 0);

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
