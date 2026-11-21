'use strict';

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const QRCode = require('qrcode');
const sql = require('./db');

// ============================================
// ÉDITION (contenu : candidates, quiz, Culture G)
// require statiques pour que Vercel embarque les fichiers
// ============================================

const EDITIONS = {
  2027: require('../editions/2027.js')
};
const EDITION_ID = String(process.env.EDITION || '2027');
const edition = EDITIONS[EDITION_ID];
if (!edition) throw new Error(`Édition inconnue : ${EDITION_ID}`);

const { candidates, quizQuestions, cultureGQuestions } = edition;
const YEAR = edition.year;
const SEMI = Number(edition.semiFinalists) || 15; // nombre de qualifiées au premier tour
const candidateNames = new Set(candidates.map(c => c.name));

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum).');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-change-me-dev-only-secret';

// ============================================
// INITIALISATION (une fois par démarrage à froid)
// Comptes admin : ADMIN_USERS="pseudo1:motdepasse1,pseudo2:motdepasse2"
// ============================================

function parseAdminUsers() {
  return String(process.env.ADMIN_USERS || '').split(',').map(entry => {
    const idx = entry.indexOf(':');
    return idx > 0 ? { pseudo: entry.slice(0, idx).trim(), password: entry.slice(idx + 1) } : null;
  }).filter(a => a && a.pseudo && a.password);
}

async function init() {
  const admins = parseAdminUsers();
  if (admins.length === 0) {
    console.warn('⚠️  ADMIN_USERS non défini : aucun compte admin synchronisé.');
  }
  for (const a of admins) {
    const [existing] = await sql`select id, password, is_admin from users where pseudo = ${a.pseudo}`;
    if (existing && existing.is_admin && await bcrypt.compare(a.password, existing.password)) continue;
    const hash = await bcrypt.hash(a.password, 11);
    if (existing) {
      await sql`update users set password = ${hash}, is_admin = true where id = ${existing.id}`;
    } else {
      await sql.begin(async tx => {
        const [u] = await tx`insert into users (pseudo, password, is_admin) values (${a.pseudo}, ${hash}, true) returning id`;
        await tx`insert into scores (user_id) values (${u.id})`;
      });
    }
    console.log(`🔐 Compte admin synchronisé : ${a.pseudo}`);
  }
}

let readyPromise = null;
const ready = () => {
  if (!readyPromise) readyPromise = init().catch(e => { readyPromise = null; throw e; });
  return readyPromise;
};

// ============================================
// SESSIONS (table Postgres)
// ============================================

class PgStore extends session.Store {
  expiry(sess) {
    return sess?.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 86400000);
  }
  get(sid, cb) {
    sql`select sess from sessions where sid = ${sid} and expires > now()`
      .then(([row]) => cb(null, row ? row.sess : null), cb);
  }
  set(sid, sess, cb) {
    sql`insert into sessions (sid, sess, expires) values (${sid}, ${sql.json(sess)}, ${this.expiry(sess)})
        on conflict (sid) do update set sess = excluded.sess, expires = excluded.expires`
      .then(() => cb?.(null), e => cb?.(e));
  }
  destroy(sid, cb) {
    sql`delete from sessions where sid = ${sid}`.then(() => cb?.(null), e => cb?.(e));
  }
  touch(sid, sess, cb) {
    sql`update sessions set expires = ${this.expiry(sess)} where sid = ${sid}`.then(() => cb?.(null), e => cb?.(e));
  }
}

// ============================================
// APPLICATION
// ============================================

const app = express();
app.set('trust proxy', isProduction ? 1 : false);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { if (!req.body || typeof req.body !== 'object') req.body = {}; next(); });

app.use(async (req, res, next) => {
  try { await ready(); next(); } catch (e) { next(e); }
});

app.use(session({
  store: new PgStore(),
  name: 'mf.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: isProduction,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
}));

// Protection CSRF : les requêtes qui modifient des données doivent venir du site lui-même
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Origine non autorisée' });
  }
  next();
});

// Limiteur de débit partagé entre les instances (stocké en base)
function rateLimit(name, { windowMs, max }) {
  return async (req, res, next) => {
    try {
      const key = `${name}:${req.ip}`;
      const resetAt = new Date(Date.now() + windowMs);
      const [row] = await sql`
        insert into rate_limits (key, count, reset_at) values (${key}, 1, ${resetAt})
        on conflict (key) do update set
          count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
          reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
        returning count`;
      if (row.count > max) return res.status(429).json({ error: 'Trop de tentatives, réessaie dans quelques minutes.' });
      if (Math.random() < 0.02) sql`delete from rate_limits where reset_at < now()`.catch(() => {});
      next();
    } catch (e) { next(e); }
  };
}
const authLimiter = rateLimit('auth', { windowMs: 15 * 60 * 1000, max: 80 });
const uploadLimiter = rateLimit('upload', { windowMs: 10 * 60 * 1000, max: 15 });

// Ouverture aux joueurs : tant que l'admin n'a pas ouvert l'appli (official_results.app_open),
// seule la page de couverture est visible et seuls les admins peuvent se connecter.
let openCache = { value: false, at: 0 };
async function isAppOpen() {
  if (Date.now() - openCache.at < 5000) return openCache.value;
  const [row] = await sql`select app_open from official_results where id = 1`;
  openCache = { value: Boolean(row?.app_open), at: Date.now() };
  return openCache.value;
}
const CLOSED_MESSAGE = "L'appli n'est pas encore ouverte : rendez-vous bientôt !";

// Authentification : utilisateur rechargé depuis la base à chaque requête
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });
    const [user] = await sql`select id, pseudo::text as pseudo, is_admin from users where id = ${req.session.userId}`;
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    if (!user.is_admin && !await isAppOpen()) return res.status(401).json({ error: CLOSED_MESSAGE });
    req.user = user;
    next();
  } catch (e) { next(e); }
};
const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Accès non autorisé' });
  next();
};

// ============================================
// HELPERS
// ============================================

const PSEUDO_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,23}$/u;
function validatePseudo(pseudo) {
  if (typeof pseudo !== 'string') return 'Pseudo requis';
  if (!PSEUDO_REGEX.test(pseudo.trim().normalize('NFC'))) {
    return 'Pseudo invalide : 2 à 24 caractères (lettres, chiffres, espace, - _ .)';
  }
  return null;
}
const cleanPseudo = p => p.trim().normalize('NFC');

const normalizeText = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

function validateCandidateList(list, size, { exact = false, allowed = candidateNames } = {}) {
  if (!Array.isArray(list)) return null;
  const unique = [...new Set(list)];
  if (unique.length !== list.length) return null;
  if (unique.some(n => typeof n !== 'string' || !allowed.has(n))) return null;
  if (exact ? unique.length !== size : unique.length > size) return null;
  return unique;
}
// null si vide, undefined si invalide
const validCandidateOrNull = (name, allowed = candidateNames) =>
  (typeof name === 'string' && allowed.has(name)) ? name : (name ? undefined : null);

const publicQuizQuestion = ({ correct, ...q }) => q;
const publicCultureGQuestion = (q) => {
  const { correct, info, bonus, ...rest } = q;
  return bonus ? { ...rest, bonus: { question: bonus.question, points: bonus.points } } : rest;
};

const cultureGIndex = new Map();
Object.entries(cultureGQuestions).forEach(([key, cat]) =>
  cat.questions.forEach(q => cultureGIndex.set(q.id, { question: q, categoryKey: key })));
const cultureGTotalQuestions = cultureGIndex.size;
const cultureGTotalPoints = Object.values(cultureGQuestions).reduce((t, c) => t + c.totalPoints, 0);

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// URL de la photo costume (versionnée pour le cache)
const photoUrl = (userId, version) => (version ? `/api/photos/${userId}?v=${version}` : null);

// ============================================
// CALCUL DES SCORES
// ============================================

const SCORING = { top15: 5, bonusTop15: 10, top5: 8, bonusTop5: 20, finalPosition: 8, pronoOr: 80 };

const recomputeTotals = (tx) => tx`update scores set total_score = quiz_score + culture_g_score + pronostics_score + defis_score + blind_points`;

function computePronoScore(prono, official) {
  const step = official.current_step || 0;
  const top15 = official.top15 || [];
  const top5 = official.top5 || [];
  const final = official.classement_final || [];
  const stats = { bonusTop15: false, bonusTop5: false, pronoOr: false };
  let score = 0;
  if (step >= 1) {
    (prono.top15 || []).forEach(c => { if (top15.includes(c)) score += SCORING.top15; });
    if (prono.bonus_top15 && !top15.includes(prono.bonus_top15)) { score += SCORING.bonusTop15; stats.bonusTop15 = true; }
  }
  if (step >= 2) {
    (prono.top5 || []).forEach(c => { if (top5.includes(c)) score += SCORING.top5; });
    if (prono.bonus_top5 && !top5.includes(prono.bonus_top5)) { score += SCORING.bonusTop5; stats.bonusTop5 = true; }
  }
  if (step >= 3) {
    (prono.classement_final || []).forEach((c, i) => { if (final[i] === c) score += SCORING.finalPosition; });
    if (prono.prono_or && prono.prono_or === final[0]) { score += SCORING.pronoOr; stats.pronoOr = true; }
  }
  return { score, stats };
}

const recomputePronostics = () => sql.begin(async tx => {
  const [official] = await tx`select * from official_results where id = 1`;
  const counts = { usersUpdated: 0, bonusTop15: 0, bonusTop5: 0, pronoOr: 0 };
  await tx`update scores set pronostics_score = 0`;
  for (const prono of await tx`select * from pronostics`) {
    const { score, stats } = computePronoScore(prono, official);
    await tx`update scores set pronostics_score = ${score} where user_id = ${prono.user_id}`;
    counts.usersUpdated++;
    if (stats.bonusTop15) counts.bonusTop15++;
    if (stats.bonusTop5) counts.bonusTop5++;
    if (stats.pronoOr) counts.pronoOr++;
  }
  await recomputeTotals(tx);
  return counts;
});

// Points aux 3 premiers ; les ex-aequo partagent le même rang.
async function awardByRank(tx, rows, column, pointsTable) {
  await tx`update scores set ${tx(column)} = 0`;
  const awarded = [];
  let rank = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i === 0 || rows[i].v !== rows[i - 1].v) rank = i;
    if (rank >= pointsTable.length) break;
    await tx`update scores set ${tx(column)} = ${pointsTable[rank]} where user_id = ${rows[i].id}`;
    awarded.push({ pseudo: rows[i].pseudo, rank: rank + 1, value: rows[i].v, points: pointsTable[rank] });
  }
  await recomputeTotals(tx);
  return awarded;
}

const recalculateQuizPoints = () => sql.begin(async tx => awardByRank(tx, await tx`
  select u.id, u.pseudo::text as pseudo, s.quiz_correct as v from users u join scores s on u.id = s.user_id
  where not u.is_admin and s.quiz_correct > 0 order by s.quiz_correct desc`, 'quiz_score', [15, 10, 5]));

const recalculateCultureGPoints = () => sql.begin(async tx => awardByRank(tx, await tx`
  select u.id, u.pseudo::text as pseudo, s.culture_g_correct as v from users u join scores s on u.id = s.user_id
  where not u.is_admin and s.culture_g_correct > 0 order by s.culture_g_correct desc`, 'culture_g_score', [15, 10, 5]));

const recalculateCostumePoints = () => sql.begin(async tx => awardByRank(tx, await tx`
  select u.id, u.pseudo::text as pseudo, count(cv.voter_id) as v from users u join costume_votes cv on u.id = cv.voted_for
  where not u.is_admin group by u.id order by v desc`, 'defis_score', [30, 20, 10]));

// ============================================
// ROUTES : ÉDITION & AUTHENTIFICATION
// ============================================

app.get('/api/edition', wrap(async (req, res) => {
  res.json({
    open: await isAppOpen(),
    theme: edition.theme || null,
    year: YEAR,
    semiFinalists: SEMI,
    electionDate: edition.electionDate,
    venue: edition.venue,
    cultureGLabel: edition.cultureGLabel,
    candidatesCount: candidates.length,
    quizCount: quizQuestions.length,
    cultureGCount: cultureGTotalQuestions,
    cultureGMaxPoints: cultureGTotalPoints
  });
}));

function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save(e => (e ? reject(e) : resolve()));
    });
  });
}

// Connexion : un joueur entre avec son pseudo + le code de soirée (variable PARTY_CODE,
// insensible à la casse) ; son compte est créé à la première connexion.
// Les admins, eux, gardent leur mot de passe (ADMIN_USERS), saisi dans le même champ.
// Tant que l'appli est fermée, un joueur identifié ne voit que la page de couverture
// (requireAuth lui refuse toutes les routes de l'appli).
const PARTY_CODE = String(process.env.PARTY_CODE || '').trim().toUpperCase();
if (!PARTY_CODE) console.warn('⚠️  PARTY_CODE non défini : les joueurs ne peuvent pas se connecter.');
const NO_PASSWORD = '!'; // les joueurs n'ont pas de mot de passe (valeur qu'aucun hash bcrypt ne peut égaler)

const findUser = async (p) => (await sql`select id, pseudo::text as pseudo, password, is_admin from users where pseudo = ${p}`)[0];

app.post('/api/login', authLimiter, wrap(async (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code : '';
  const pseudoError = validatePseudo(req.body.pseudo);
  if (pseudoError) return res.status(400).json({ error: pseudoError });
  if (!code.trim()) return res.status(400).json({ error: 'Mot de passe requis' });
  const p = cleanPseudo(req.body.pseudo);

  let user = await findUser(p);
  let created = false;
  if (user?.is_admin) {
    if (!await bcrypt.compare(code.slice(0, 72), user.password)) {
      return res.status(401).json({ error: 'Mot de passe organisateur incorrect' });
    }
  } else {
    if (!PARTY_CODE) return res.status(503).json({ error: "Le mot de passe de la soirée n'est pas encore configuré." });
    if (code.trim().toUpperCase() !== PARTY_CODE) return res.status(401).json({ error: 'Mot de passe de la soirée incorrect' });
    if (!user) {
      if (/^admin/i.test(p)) return res.status(400).json({ error: 'Ce pseudo est réservé' });
      try {
        user = await sql.begin(async tx => {
          const [u] = await tx`insert into users (pseudo, password) values (${p}, ${NO_PASSWORD}) returning id, pseudo::text as pseudo, is_admin`;
          await tx`insert into scores (user_id) values (${u.id})`;
          return u;
        });
        created = true;
      } catch (e) {
        if (e.code !== '23505') throw e;
        user = await findUser(p); // créé au même instant depuis un autre téléphone
        if (!user || user.is_admin) return res.status(409).json({ error: 'Réessaie dans un instant.' });
      }
    }
  }

  await startSession(req, user.id);
  res.json({ success: true, userId: user.id, pseudo: user.pseudo, isAdmin: user.is_admin, created, open: await isAppOpen() });
}));

app.get('/api/session', wrap(async (req, res) => {
  const open = await isAppOpen();
  if (!req.session.userId) return res.json({ loggedIn: false, open });
  const [user] = await sql`select pseudo::text as pseudo, is_admin from users where id = ${req.session.userId}`;
  if (!user) return res.json({ loggedIn: false, open });
  res.json({ loggedIn: true, pseudo: user.pseudo, isAdmin: user.is_admin, open });
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('mf.sid');
    res.json({ success: true });
  });
});

app.get('/api/me', requireAuth, wrap(async (req, res) => {
  const [score] = await sql`select * from scores where user_id = ${req.user.id}`;
  res.json({
    user: { id: req.user.id, pseudo: req.user.pseudo, is_admin: req.user.is_admin ? 1 : 0, isAdmin: req.user.is_admin, avatar: null },
    partyCode: PARTY_CODE || null,
    score
  });
}));

// ============================================
// ROUTES : QUIZ
// ============================================

app.get('/api/quiz/questions', requireAuth, wrap(async (req, res) => {
  const answered = new Set((await sql`select question_id from quiz_answers where user_id = ${req.user.id}`).map(a => a.question_id));
  const unanswered = quizQuestions.filter(q => !answered.has(q.id));
  res.json({
    questions: unanswered.map(publicQuizQuestion),
    totalQuestions: quizQuestions.length,
    answeredCount: answered.size,
    isCompleted: unanswered.length === 0
  });
}));

app.post('/api/quiz/answer', requireAuth, wrap(async (req, res) => {
  const questionId = Number(req.body.questionId);
  const answer = Number(req.body.answer);
  const question = quizQuestions.find(q => q.id === questionId);
  if (!question) return res.status(404).json({ error: 'Question non trouvée' });
  const isCorrect = Number.isInteger(answer) && answer === question.correct;

  const inserted = await sql.begin(async tx => {
    const r = await tx`insert into quiz_answers (user_id, question_id, answer, is_correct, points)
      values (${req.user.id}, ${questionId}, ${String(answer)}, ${isCorrect}, ${isCorrect ? 1 : 0})
      on conflict do nothing`;
    if (r.count === 0) return false;
    if (isCorrect) await tx`update scores set quiz_correct = quiz_correct + 1 where user_id = ${req.user.id}`;
    return true;
  });
  if (!inserted) return res.status(400).json({ error: 'Tu as déjà répondu à cette question' });

  await recalculateQuizPoints();
  res.json({ correct: isCorrect, correctAnswer: question.answers[question.correct] });
}));

app.get('/api/quiz/score', requireAuth, wrap(async (req, res) => {
  const answers = await sql`select is_correct, points from quiz_answers where user_id = ${req.user.id}`;
  res.json({
    totalAnswers: answers.length,
    correctAnswers: answers.filter(a => a.is_correct).length,
    totalPoints: answers.reduce((s, a) => s + (a.points || 0), 0)
  });
}));

// ============================================
// ROUTES : QUESTIONNAIRE CULTURE G
// ============================================

function gradeCultureG(question, answer, bonusAnswer) {
  let isCorrect = false;
  let correctAnswer = '';
  if (question.type === 'single') {
    isCorrect = answer !== null && answer !== '' && Number(answer) === question.correct;
    correctAnswer = question.answers[question.correct];
  } else if (question.type === 'multiple') {
    const user = Array.isArray(answer) ? [...new Set(answer.map(Number))].sort((a, b) => a - b) : [];
    const expected = [...question.correct].sort((a, b) => a - b);
    isCorrect = user.length === expected.length && user.every((v, i) => v === expected[i]);
    correctAnswer = question.correct.map(i => question.answers[i]).join(', ');
  } else if (question.type === 'text') {
    const user = normalizeText(answer);
    isCorrect = user !== '' && question.correct.some(c => normalizeText(c) === user);
    correctAnswer = question.correct[0];
  }
  let points = isCorrect ? question.points : 0;
  let bonusCorrect = false;
  if (question.bonus && bonusAnswer) {
    bonusCorrect = question.bonus.correct.some(c => normalizeText(c) === normalizeText(bonusAnswer));
    if (bonusCorrect) points += question.bonus.points;
  }
  return { isCorrect, points, correctAnswer, bonusCorrect, bonusPoints: bonusCorrect ? question.bonus.points : 0 };
}

const limitAnswer = (a) => {
  if (Array.isArray(a)) return a.slice(0, 20).map(Number);
  if (typeof a === 'number') return a;
  if (typeof a === 'string') return a.slice(0, 200);
  return null;
};

app.get('/api/culture-g/questions', requireAuth, wrap(async (req, res) => {
  const answered = new Set((await sql`select question_id from culture_g_answers where user_id = ${req.user.id}`).map(a => a.question_id));
  const categories = {};
  Object.entries(cultureGQuestions).forEach(([key, cat]) => {
    categories[key] = {
      name: cat.name,
      totalPoints: cat.totalPoints,
      questions: cat.questions.map(q => ({ ...publicCultureGQuestion(q), answered: answered.has(q.id) }))
    };
  });
  res.json({
    categories,
    totalQuestions: cultureGTotalQuestions,
    answeredCount: answered.size,
    totalPoints: cultureGTotalPoints,
    isCompleted: answered.size >= cultureGTotalQuestions
  });
}));

app.get('/api/culture-g/progress', requireAuth, wrap(async (req, res) => {
  const answers = await sql`select question_id, is_correct, points from culture_g_answers where user_id = ${req.user.id}`;
  const categoryProgress = {};
  Object.entries(cultureGQuestions).forEach(([key, cat]) => {
    const catAnswers = answers.filter(a => cultureGIndex.get(a.question_id)?.categoryKey === key);
    categoryProgress[key] = {
      name: cat.name,
      answered: catAnswers.length,
      total: cat.questions.length,
      points: catAnswers.reduce((s, a) => s + (a.points || 0), 0),
      maxPoints: cat.totalPoints
    };
  });
  res.json({
    totalAnswers: answers.length,
    totalQuestions: cultureGTotalQuestions,
    correctAnswers: answers.filter(a => a.is_correct).length,
    totalPoints: answers.reduce((s, a) => s + (a.points || 0), 0),
    maxPoints: cultureGTotalPoints,
    categoryProgress,
    isCompleted: answers.length >= cultureGTotalQuestions
  });
}));

app.post('/api/culture-g/answer', requireAuth, wrap(async (req, res) => {
  const entry = cultureGIndex.get(req.body.questionId);
  if (!entry) return res.status(404).json({ error: 'Question non trouvée' });
  const answer = limitAnswer(req.body.answer);
  const bonusAnswer = limitAnswer(req.body.bonusAnswer);
  const r = gradeCultureG(entry.question, answer, bonusAnswer);

  const inserted = await sql.begin(async tx => {
    const ins = await tx`insert into culture_g_answers (user_id, question_id, answer, is_correct, points)
      values (${req.user.id}, ${entry.question.id}, ${tx.json({ main: answer, bonus: bonusAnswer })}, ${r.isCorrect}, ${r.points})
      on conflict do nothing`;
    if (ins.count === 0) return false;
    if (r.isCorrect) await tx`update scores set culture_g_correct = culture_g_correct + 1 where user_id = ${req.user.id}`;
    return true;
  });
  if (!inserted) return res.status(400).json({ error: 'Tu as déjà répondu à cette question' });

  await recalculateCultureGPoints();
  res.json({
    correct: r.isCorrect, rawPoints: r.points, correctAnswer: r.correctAnswer,
    bonusCorrect: r.bonusCorrect, bonusPoints: r.bonusPoints, info: entry.question.info || null
  });
}));

app.post('/api/culture-g/submit-category', requireAuth, wrap(async (req, res) => {
  const { categoryKey, answers } = req.body;
  const category = Object.hasOwn(cultureGQuestions, categoryKey) ? cultureGQuestions[categoryKey] : null;
  if (!category) return res.status(404).json({ error: 'Catégorie non trouvée' });
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ error: 'Réponses invalides' });
  }

  const results = [];
  let totalPoints = 0;
  let correctCount = 0;
  await sql.begin(async tx => {
    for (const question of category.questions) {
      if (!Object.hasOwn(answers, question.id)) continue;
      const data = answers[question.id] || {};
      const main = limitAnswer(data.main);
      const bonus = limitAnswer(data.bonus);
      const r = gradeCultureG(question, main, bonus);
      const ins = await tx`insert into culture_g_answers (user_id, question_id, answer, is_correct, points)
        values (${req.user.id}, ${question.id}, ${tx.json({ main, bonus })}, ${r.isCorrect}, ${r.points})
        on conflict do nothing`;
      if (ins.count === 0) continue;
      totalPoints += r.points;
      if (r.isCorrect) correctCount++;
      results.push({ questionId: question.id, question: question.question, isCorrect: r.isCorrect, points: r.points, correctAnswer: r.correctAnswer, info: question.info || null });
    }
    if (correctCount > 0) await tx`update scores set culture_g_correct = culture_g_correct + ${correctCount} where user_id = ${req.user.id}`;
  });

  await recalculateCultureGPoints();
  res.json({ success: true, rawPoints: totalPoints, totalPoints, correctCount, results });
}));

app.get('/api/culture-g/leaderboard', requireAuth, wrap(async (req, res) => {
  const rows = await sql`
    select u.id, u.pseudo::text as pseudo,
           coalesce((select sum(points) from culture_g_answers where user_id = u.id), 0) as raw_score,
           s.culture_g_score as awarded_points
    from users u left join scores s on u.id = s.user_id
    where not u.is_admin
    order by raw_score desc, u.pseudo asc`;
  res.json(rows.map(r => ({ ...r, raw_score: Number(r.raw_score), max_score: cultureGTotalPoints })));
}));

// ============================================
// ROUTES : PRONOSTICS
// ============================================

app.get('/api/candidates', requireAuth, (req, res) => res.json(candidates));

const getOfficial = async () => (await sql`select * from official_results where id = 1`)[0];

async function upsertProno(userId, fields) {
  const row = { user_id: userId, ...fields, submitted_at: new Date() };
  const cols = Object.keys(row);
  await sql`insert into pronostics ${sql(row, cols)}
    on conflict (user_id) do update set ${sql(row, cols.filter(c => c !== 'user_id'))}`;
}

app.post('/api/pronostics/top15', requireAuth, wrap(async (req, res) => {
  const official = await getOfficial();
  if (official.current_step >= 1) {
    return res.status(403).json({ error: `Le Top ${SEMI} officiel a été validé, tu ne peux plus modifier tes pronostics.` });
  }
  const top15 = validateCandidateList(req.body.top15, SEMI);
  const bonusTop15 = validCandidateOrNull(req.body.bonusTop15);
  const pronoOr = validCandidateOrNull(req.body.pronoOr);
  if (!top15 || bonusTop15 === undefined || pronoOr === undefined) {
    return res.status(400).json({ error: `Sélection invalide (${SEMI} candidates maximum, sans doublon).` });
  }
  await upsertProno(req.user.id, { top15: sql.json(top15), bonus_top15: bonusTop15, prono_or: pronoOr });
  res.json({ success: true, message: `Top ${SEMI} et Prono d'Or enregistrés !` });
}));

app.post('/api/pronostics/top5', requireAuth, wrap(async (req, res) => {
  const official = await getOfficial();
  if (official.current_step >= 2) {
    return res.status(403).json({ error: 'Le Top 5 officiel a été validé, tu ne peux plus modifier tes pronostics.' });
  }
  const allowed = official.current_step >= 1 ? new Set(official.top15 || []) : candidateNames;
  const top5 = validateCandidateList(req.body.top5, 5, { allowed });
  const bonusTop5 = validCandidateOrNull(req.body.bonusTop5, allowed);
  if (!top5 || bonusTop5 === undefined) {
    return res.status(400).json({ error: 'Sélection invalide (5 candidates maximum, sans doublon).' });
  }
  await upsertProno(req.user.id, { top5: sql.json(top5), bonus_top5: bonusTop5 });
  res.json({ success: true, message: 'Top 5 enregistré !' });
}));

app.post('/api/pronostics/final', requireAuth, wrap(async (req, res) => {
  const official = await getOfficial();
  if (official.current_step >= 3) {
    return res.status(403).json({ error: 'Le classement final officiel a été validé, tu ne peux plus modifier tes pronostics.' });
  }
  const allowed = official.current_step >= 2 ? new Set(official.top5 || []) : candidateNames;
  const classement = validateCandidateList(req.body.classementFinal, 5, { exact: true, allowed });
  if (!classement) return res.status(400).json({ error: 'Classement invalide : 5 candidates différentes requises.' });
  await upsertProno(req.user.id, { classement_final: sql.json(classement) });
  res.json({ success: true, message: 'Classement final enregistré !' });
}));

app.get('/api/pronostics', requireAuth, wrap(async (req, res) => {
  const [p] = await sql`select * from pronostics where user_id = ${req.user.id}`;
  if (!p) return res.json(null);
  res.json({ ...p, top15: p.top15 || [], top5: p.top5 || [], classement_final: p.classement_final || [], prono_or: p.prono_or || null });
}));

// Défis : fonctionnalité désactivée (aucun défi défini)
app.get('/api/defis', requireAuth, (req, res) => res.json(null));
app.post('/api/defis/complete', requireAuth, (req, res) => res.status(404).json({ error: 'Défi non trouvé' }));

// ============================================
// ROUTES : CONCOURS DU MEILLEUR COSTUME
// Photos stockées en base (bytea), ré-encodées en JPEG 800 px sans métadonnées
// ============================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 }, // limite Vercel : 4,5 Mo par requête
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Type de fichier non supporté. Utilise JPG, PNG ou WebP.'), { status: 400 }));
  }
});

app.get('/api/photos/:userId', requireAuth, wrap(async (req, res) => {
  const userId = Number(req.params.userId);
  const [photo] = await sql`
    select p.data, p.mime, u.costume_photo_public from costume_photos p join users u on u.id = p.user_id
    where p.user_id = ${userId}`;
  if (!photo || !(photo.costume_photo_public || userId === req.user.id || req.user.is_admin)) {
    return res.status(404).json({ error: 'Photo introuvable' });
  }
  res.setHeader('Content-Type', photo.mime);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(photo.data);
}));

app.get('/api/costume/players', requireAuth, wrap(async (req, res) => {
  const rows = await sql`
    select u.id, u.pseudo::text as pseudo, case when u.costume_photo_public then p.version end as version
    from users u left join costume_photos p on p.user_id = u.id order by u.pseudo`;
  res.json(rows.map(r => ({ id: r.id, pseudo: r.pseudo, costume_photo: photoUrl(r.id, r.version) })));
}));

app.get('/api/costume/players-for-vote', requireAuth, wrap(async (req, res) => {
  res.json(await sql`select id, pseudo::text as pseudo from users where id <> ${req.user.id} and not is_admin order by pseudo`);
}));

app.get('/api/costume/my-photo', requireAuth, wrap(async (req, res) => {
  const [r] = await sql`select u.costume_photo_public, p.version from users u left join costume_photos p on p.user_id = u.id where u.id = ${req.user.id}`;
  res.json({ photo: photoUrl(req.user.id, r?.version), isPublic: Boolean(r?.version && r.costume_photo_public) });
}));

app.post('/api/costume/upload-photo', requireAuth, uploadLimiter, upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune photo fournie' });
  let data;
  try {
    data = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    return res.status(400).json({ error: 'Image illisible. Essaie avec une photo JPG ou PNG.' });
  }
  const version = Date.now();
  await sql.begin(async tx => {
    await tx`insert into costume_photos (user_id, version, mime, data) values (${req.user.id}, ${version}, 'image/jpeg', ${data})
      on conflict (user_id) do update set version = excluded.version, mime = excluded.mime, data = excluded.data, updated_at = now()`;
    await tx`update users set costume_photo_public = false where id = ${req.user.id}`;
  });
  res.json({ success: true, photo: photoUrl(req.user.id, version), isPublic: false, message: 'Photo uploadée ! Clique sur "Ajouter à la galerie" pour la partager.' });
}));

app.delete('/api/costume/delete-photo', requireAuth, wrap(async (req, res) => {
  await sql.begin(async tx => {
    await tx`delete from costume_photos where user_id = ${req.user.id}`;
    await tx`update users set costume_photo_public = false where id = ${req.user.id}`;
  });
  res.json({ success: true, message: 'Photo supprimée' });
}));

app.post('/api/costume/toggle-public', requireAuth, wrap(async (req, res) => {
  const [r] = await sql`select u.costume_photo_public, p.version from users u left join costume_photos p on p.user_id = u.id where u.id = ${req.user.id}`;
  if (!r?.version) return res.status(400).json({ error: 'Tu dois d\'abord uploader une photo' });
  const isPublic = !r.costume_photo_public;
  await sql`update users set costume_photo_public = ${isPublic} where id = ${req.user.id}`;
  res.json({ success: true, isPublic, message: isPublic ? 'Ta photo est maintenant visible dans la galerie !' : 'Ta photo a été retirée de la galerie' });
}));

app.get('/api/costume/my-vote', requireAuth, wrap(async (req, res) => {
  const [v] = await sql`select cv.voted_for, cv.voted_at, u.pseudo::text as voted_for_pseudo
    from costume_votes cv join users u on cv.voted_for = u.id where cv.voter_id = ${req.user.id}`;
  res.json(v || null);
}));

app.post('/api/costume/vote', requireAuth, wrap(async (req, res) => {
  const votedForId = Number(req.body.votedForId);
  if (!Number.isInteger(votedForId)) return res.status(400).json({ error: 'Sélectionne un joueur' });
  if (votedForId === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas voter pour toi-même !' });
  const [target] = await sql`select id, pseudo::text as pseudo from users where id = ${votedForId} and not is_admin`;
  if (!target) return res.status(404).json({ error: 'Joueur non trouvé' });

  await sql`insert into costume_votes (voter_id, voted_for) values (${req.user.id}, ${votedForId})
    on conflict (voter_id) do update set voted_for = excluded.voted_for, voted_at = now()`;
  await recalculateCostumePoints();
  res.json({ success: true, message: `Vote enregistré pour ${target.pseudo} !` });
}));

app.get('/api/costume/results', requireAuth, wrap(async (req, res) => {
  const results = await sql`
    select u.id, u.pseudo::text as pseudo, count(cv.voter_id) as votes
    from users u left join costume_votes cv on u.id = cv.voted_for
    where not u.is_admin group by u.id order by votes desc, u.pseudo asc`;
  const [{ c }] = await sql`select count(*) as c from costume_votes`;
  res.json({ results, totalVotes: c });
}));

// ============================================
// BLIND TEST en direct : l'admin ouvre une chanson, les joueurs répondent, l'admin révèle.
// État dans official_results.blind = { phase, index } ; phases : idle → open ⇄ revealed → theme → done.
// La bonne réponse et le thème ne sont envoyés aux téléphones qu'une fois révélés.
// ============================================

const BLIND = edition.blindTest && edition.blindTest.songs?.length ? edition.blindTest : null;
const blindState = (official) => ({ phase: 'idle', index: -1, ...(official?.blind || {}) });
const blindThemeOk = (text) => {
  const t = normalizeText(text);
  return Boolean(t) && (BLIND.theme.keywords || []).some(k => t.includes(k));
};
const blindRanking = () => sql`
  select u.id, u.pseudo::text as pseudo, coalesce(sum(a.points), 0)::int as points, s.blind_points as awarded
  from users u join scores s on s.user_id = u.id join blind_answers a on a.user_id = u.id
  where not u.is_admin group by u.id, s.blind_points order by points desc, u.pseudo asc`;

const recalculateBlindPoints = () => sql.begin(async tx => awardByRank(tx, await tx`
  select u.id, u.pseudo::text as pseudo, sum(a.points)::int as v from users u join blind_answers a on a.user_id = u.id
  where not u.is_admin group by u.id having sum(a.points) > 0 order by v desc`, 'blind_points', BLIND.awards || [15, 10, 5]));

app.get('/api/blind', requireAuth, wrap(async (req, res) => {
  if (!BLIND) return res.json({ enabled: false });
  const st = blindState(await getOfficial());
  const mine = await sql`select question_id, answer, is_correct, points from blind_answers where user_id = ${req.user.id}`;
  const out = {
    enabled: true, phase: st.phase, index: st.index, total: BLIND.songs.length,
    themeBonus: BLIND.themeBonus, awards: BLIND.awards
  };
  const song = BLIND.songs[st.index];
  if ((st.phase === 'open' || st.phase === 'revealed') && song) {
    const a = mine.find(m => m.question_id === song.id);
    out.question = { id: song.id, number: st.index + 1, ask: song.ask, options: song.options };
    out.myAnswer = a ? Number(a.answer) : null;
    if (st.phase === 'revealed') {
      out.reveal = { correct: song.correct, title: song.title, artist: song.artist, isCorrect: Boolean(a?.is_correct), last: st.index === BLIND.songs.length - 1 };
    }
  }
  if (st.phase === 'theme' || st.phase === 'done') {
    const g = mine.find(m => m.question_id === 'theme');
    out.theme = { question: BLIND.theme.question, myGuess: g ? g.answer : null };
    if (st.phase === 'done') {
      out.theme.answer = BLIND.theme.answer;
      out.theme.explanation = BLIND.theme.explanation;
      out.theme.isCorrect = Boolean(g?.is_correct);
      out.songs = BLIND.songs.map(x => ({ title: x.title, artist: x.artist, link: x.link, ok: Boolean(mine.find(m => m.question_id === x.id)?.is_correct) }));
    }
  }
  // Le score ne compte que les chansons déjà révélées (la réponse en cours reste secrète)
  const hidden = st.phase === 'open' && song ? song.id : st.phase === 'theme' ? 'theme' : null;
  out.myPoints = mine.filter(m => m.question_id !== hidden).reduce((n, m) => n + m.points, 0);
  if (st.phase === 'revealed' || st.phase === 'done') {
    out.ranking = (await blindRanking()).map(r => ({ pseudo: r.pseudo, points: r.points, awarded: st.phase === 'done' ? r.awarded : 0, me: r.id === req.user.id }));
  }
  res.json(out);
}));

app.post('/api/blind/answer', requireAuth, wrap(async (req, res) => {
  if (!BLIND) return res.status(404).json({ error: 'Pas de blind test' });
  const st = blindState(await getOfficial());
  const { questionId, answer } = req.body;
  let stored, isCorrect, points;
  if (st.phase === 'open' && BLIND.songs[st.index]?.id === questionId) {
    const song = BLIND.songs[st.index];
    const idx = Number(answer);
    if (!Number.isInteger(idx) || idx < 0 || idx >= song.options.length) return res.status(400).json({ error: 'Réponse invalide' });
    stored = String(idx);
    isCorrect = idx === song.correct;
    points = isCorrect ? (BLIND.pointsPerSong || 1) : 0;
  } else if (st.phase === 'theme' && questionId === 'theme') {
    if (typeof answer !== 'string' || !answer.trim()) return res.status(400).json({ error: 'Écris ta réponse' });
    stored = answer.trim().slice(0, 80);
    isCorrect = blindThemeOk(stored);
    points = isCorrect ? (BLIND.themeBonus || 0) : 0;
  } else {
    return res.status(409).json({ error: 'Trop tard : les réponses sont fermées.' });
  }
  await sql`insert into blind_answers (user_id, question_id, answer, is_correct, points)
    values (${req.user.id}, ${questionId}, ${stored}, ${isCorrect}, ${points})
    on conflict (user_id, question_id) do update set answer = excluded.answer, is_correct = excluded.is_correct, points = excluded.points, created_at = now()`;
  res.json({ success: true });
}));

// ============================================
// ROUTES : CLASSEMENT
// ============================================

app.get('/api/leaderboard', requireAuth, wrap(async (req, res) => {
  res.json(await sql`
    select u.pseudo::text as pseudo, s.user_id, s.quiz_score, s.culture_g_score, s.pronostics_score, s.defis_score, s.blind_points, s.total_score
    from scores s join users u on s.user_id = u.id
    where not u.is_admin order by s.total_score desc, u.pseudo asc`);
}));

app.get('/api/official-results', requireAuth, wrap(async (req, res) => {
  const r = await getOfficial();
  res.json({
    top15: r.top15 || [], top5: r.top5 || [], classement_final: r.classement_final || [],
    miss_france: r.miss_france, current_step: r.current_step, updated_at: r.updated_at,
    app_open: Boolean(r.app_open),
    blind: BLIND ? { phase: blindState(r).phase, index: blindState(r).index, total: BLIND.songs.length } : null
  });
}));

// ============================================
// RÉVÉLATIONS EN DIRECT : ce que chaque joueur a gagné à l'étape validée
// + statistiques des pronostics du groupe (uniquement pour les étapes déjà validées)
// ============================================

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

app.get('/api/reveal', requireAuth, wrap(async (req, res) => {
  const official = await getOfficial();
  const step = official.current_step || 0;
  const base = {
    step, year: YEAR, updated_at: official.updated_at,
    official: { top15: official.top15 || [], top5: official.top5 || [], classement_final: official.classement_final || [] }
  };
  if (step === 0) return res.json(base);

  const pronos = await sql`select p.* from pronostics p join users u on u.id = p.user_id where not u.is_admin`;
  const mine = (await sql`select * from pronostics where user_id = ${req.user.id}`)[0] || null;
  const at = (s) => ({ ...official, current_step: s });

  // Ce que j'ai gagné à cette étape
  let me = { hasProno: Boolean(mine), gained: 0, total: 0 };
  if (mine) {
    const now = computePronoScore(mine, at(step)).score;
    const before = computePronoScore(mine, at(step - 1)).score;
    me = { hasProno: true, gained: now - before, total: now };
    if (step === 1) {
      const picks = mine.top15 || [];
      me.correct = picks.filter(c => base.official.top15.includes(c));
      me.picks = picks.length;
      me.bonus = mine.bonus_top15 ? { name: mine.bonus_top15, won: !base.official.top15.includes(mine.bonus_top15) } : null;
    } else if (step === 2) {
      const picks = mine.top5 || [];
      me.correct = picks.filter(c => base.official.top5.includes(c));
      me.picks = picks.length;
      me.bonus = mine.bonus_top5 ? { name: mine.bonus_top5, won: !base.official.top5.includes(mine.bonus_top5) } : null;
    } else {
      const picks = mine.classement_final || [];
      me.correct = picks.filter((c, i) => base.official.classement_final[i] === c);
      me.picks = picks.length;
      me.pronoOr = mine.prono_or ? { name: mine.prono_or, won: mine.prono_or === base.official.classement_final[0] } : null;
    }
  }

  // Statistiques du groupe
  const count = (list) => {
    const m = new Map();
    list.forEach(n => { if (n) m.set(n, (m.get(n) || 0) + 1); });
    return m;
  };
  let stats;
  if (step === 1 || step === 2) {
    const key = step === 1 ? 'top15' : 'top5';
    const officialList = base.official[key];
    const players = pronos.filter(p => (p[key] || []).length > 0);
    const counts = count(players.flatMap(p => p[key] || []));
    const scores = players.map(p => (p[key] || []).filter(c => officialList.includes(c)).length);
    stats = {
      players: players.length,
      qualified: officialList.map(name => ({ name, pct: pct(counts.get(name) || 0, players.length) }))
        .sort((a, b) => a.pct - b.pct),
      favorites: [...counts.entries()].map(([name, n]) => ({ name, pct: pct(n, players.length), qualified: officialList.includes(name) }))
        .sort((a, b) => b.pct - a.pct).slice(0, 5),
      best: scores.length ? Math.max(...scores) : 0,
      bestCount: scores.length ? scores.filter(s => s === Math.max(...scores)).length : 0,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0
    };
  } else {
    const winner = base.official.classement_final[0];
    const withOr = pronos.filter(p => p.prono_or);
    const orCounts = count(withOr.map(p => p.prono_or));
    const withFinal = pronos.filter(p => (p.classement_final || []).length === 5);
    stats = {
      players: withOr.length,
      winner,
      winnerPct: pct(orCounts.get(winner) || 0, withOr.length),
      pronoOrWinners: orCounts.get(winner) || 0,
      favorites: [...orCounts.entries()].map(([name, n]) => ({ name, pct: pct(n, withOr.length) }))
        .sort((a, b) => b.pct - a.pct).slice(0, 3),
      exactPodium: withFinal.filter(p => p.classement_final.every((c, i) => c === base.official.classement_final[i])).length
    };
  }
  res.json({ ...base, me, stats });
}));

// QR code d'invitation (adresse publique de l'appli)
app.get('/api/invite-qr.svg', wrap(async (req, res) => {
  const url = `${req.protocol}://${req.get('host')}/`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14121A', light: '#F7F2EE' } });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
}));

// ============================================
// ROUTES ADMIN
// ============================================

const admin = express.Router();
admin.use(requireAuth, requireAdmin);

admin.get('/candidates', (req, res) => res.json(candidates));

// Télécommande du blind test
const adminBlindView = async () => {
  const st = blindState(await getOfficial());
  const song = BLIND.songs[st.index];
  const next = BLIND.songs[st.index + 1];
  const qid = st.phase === 'theme' ? 'theme' : song?.id;
  const [{ n }] = qid ? await sql`select count(*) as n from blind_answers a join users u on u.id = a.user_id where a.question_id = ${qid} and not u.is_admin` : [{ n: 0 }];
  const [{ players }] = await sql`select count(*) as players from users where not is_admin`;
  const brief = (x) => (x ? { title: x.title, artist: x.artist, ask: x.ask, cue: x.cue } : null);
  return {
    enabled: true, phase: st.phase, index: st.index, total: BLIND.songs.length,
    current: brief(song), next: brief(next), answered: n, players,
    theme: { question: BLIND.theme.question, answer: BLIND.theme.answer }
  };
};

admin.get('/blind', wrap(async (req, res) => res.json(BLIND ? await adminBlindView() : { enabled: false })));

admin.post('/blind', wrap(async (req, res) => {
  if (!BLIND) return res.status(404).json({ error: 'Pas de blind test' });
  const st = blindState(await getOfficial());
  const last = st.index >= BLIND.songs.length - 1;
  const action = req.body.action;
  let next = null;
  if (action === 'next' && (st.phase === 'idle' || st.phase === 'revealed')) {
    next = last && st.phase === 'revealed' ? { phase: 'theme', index: st.index } : { phase: 'open', index: st.index + 1 };
  } else if (action === 'reveal' && st.phase === 'open') {
    next = { phase: 'revealed', index: st.index };
  } else if (action === 'reveal' && st.phase === 'theme') {
    next = { phase: 'done', index: st.index };
  } else if (action === 'reset') {
    next = { phase: 'idle', index: -1 };
  }
  if (!next) return res.status(409).json({ error: "Action impossible à cette étape (l'écran n'était peut-être plus à jour)." });
  if (action === 'reset') await sql`delete from blind_answers`;
  await sql`update official_results set blind = ${sql.json(next)} where id = 1`;
  if (next.phase === 'done' || action === 'reset') await recalculateBlindPoints();
  res.json(await adminBlindView());
}));

admin.post('/app-open', wrap(async (req, res) => {
  const open = req.body.open === true;
  await sql`update official_results set app_open = ${open} where id = 1`;
  openCache = { value: open, at: Date.now() };
  res.json({ success: true, open, message: open ? "L'appli est ouverte aux joueurs." : "L'appli est refermée : seule la couverture est visible." });
}));

admin.get('/stats', wrap(async (req, res) => {
  const [{ users }] = await sql`select count(*) as users from users where not is_admin`;
  const [{ pronos }] = await sql`select count(*) as pronos from pronostics`;
  res.json({ totalUsers: users, totalPronostics: pronos });
}));

admin.get('/users', wrap(async (req, res) => {
  const rows = await sql`
    select u.id, u.pseudo::text as pseudo, u.is_admin, u.costume_photo_public, p.version,
           s.total_score, s.quiz_score, s.pronostics_score, s.culture_g_score, s.defis_score
    from users u left join scores s on u.id = s.user_id left join costume_photos p on p.user_id = u.id
    order by u.pseudo`;
  res.json(rows.map(({ version, ...r }) => ({ ...r, is_admin: r.is_admin ? 1 : 0, costume_photo: photoUrl(r.id, version) })));
}));

admin.put('/users/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const error = validatePseudo(req.body.pseudo);
  if (error) return res.status(400).json({ error });
  const pseudo = cleanPseudo(req.body.pseudo);
  try {
    const r = await sql`update users set pseudo = ${pseudo} where id = ${id}`;
    if (r.count === 0) return res.status(404).json({ error: 'Joueur non trouvé' });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ce pseudo est déjà utilisé' });
    throw e;
  }
  res.json({ success: true, message: `Pseudo modifié en "${pseudo}"` });
}));

admin.delete('/users/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await sql`select pseudo::text as pseudo, is_admin from users where id = ${id}`;
  if (!user) return res.status(404).json({ error: 'Joueur non trouvé' });
  if (user.is_admin) return res.status(403).json({ error: 'Impossible de supprimer un administrateur' });
  await sql`delete from users where id = ${id}`; // cascade : scores, pronos, réponses, votes, photo
  await sql`delete from sessions where (sess->>'userId')::bigint = ${id}`;
  await recalculateQuizPoints();
  await recalculateCultureGPoints();
  await recalculateCostumePoints();
  res.json({ success: true, message: `Joueur "${user.pseudo}" supprimé` });
}));

admin.delete('/users/:id/photo', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const r = await sql`delete from costume_photos where user_id = ${id}`;
  if (r.count === 0) return res.status(400).json({ error: 'Ce joueur n\'a pas de photo' });
  await sql`update users set costume_photo_public = false where id = ${id}`;
  res.json({ success: true, message: 'Photo supprimée' });
}));

admin.post('/costume-awards', wrap(async (req, res) => {
  const awarded = await recalculateCostumePoints();
  if (awarded.length === 0) return res.status(400).json({ error: 'Aucun vote enregistré' });
  res.json({ success: true, message: 'Points attribués !', awarded: awarded.map(a => ({ pseudo: a.pseudo, votes: a.value, points: a.points })) });
}));

admin.post('/validate-top15', wrap(async (req, res) => {
  const top15 = validateCandidateList(req.body.top15, SEMI, { exact: true });
  if (!top15) return res.status(400).json({ error: `Le top ${SEMI} doit contenir exactement ${SEMI} candidates différentes` });
  await sql`update official_results set top15 = ${sql.json(top15)}, top5 = null, classement_final = null,
    miss_france = null, current_step = 1, updated_at = now() where id = 1`;
  const c = await recomputePronostics();
  res.json({ success: true, message: `Top ${SEMI} validé ! ${c.bonusTop15} joueur(s) ont gagné le bonus "pas dans le top ${SEMI}".`, usersUpdated: c.usersUpdated, bonusWinners: c.bonusTop15, currentStep: 1 });
}));

admin.post('/validate-top5', wrap(async (req, res) => {
  const official = await getOfficial();
  if (official.current_step < 1) return res.status(400).json({ error: `Le top ${SEMI} doit être validé avant le top 5` });
  const top5 = validateCandidateList(req.body.top5, 5, { exact: true, allowed: new Set(official.top15 || []) });
  if (!top5) return res.status(400).json({ error: `Le top 5 doit contenir exactement 5 candidates différentes issues du top ${SEMI}` });
  await sql`update official_results set top5 = ${sql.json(top5)}, classement_final = null, miss_france = null,
    current_step = 2, updated_at = now() where id = 1`;
  const c = await recomputePronostics();
  res.json({ success: true, message: `Top 5 validé ! ${c.bonusTop5} joueur(s) ont gagné le bonus "pas dans le top 5".`, usersUpdated: c.usersUpdated, bonusTop5Winners: c.bonusTop5, currentStep: 2 });
}));

admin.post('/validate-final', wrap(async (req, res) => {
  const official = await getOfficial();
  if (official.current_step < 2) return res.status(400).json({ error: 'Le top 5 doit être validé avant le classement final' });
  const classement = validateCandidateList(req.body.classementFinal, 5, { exact: true, allowed: new Set(official.top5 || []) });
  if (!classement) return res.status(400).json({ error: 'Le classement final doit contenir les 5 finalistes, chacune une seule fois' });
  const missFrance = classement[0];
  await sql`update official_results set classement_final = ${sql.json(classement)}, miss_france = ${missFrance},
    current_step = 3, updated_at = now() where id = 1`;
  const c = await recomputePronostics();
  res.json({
    success: true,
    message: `Classement final validé ! ${missFrance} est Miss France ${YEAR} ! ${c.pronoOr} joueur(s) ont gagné le Prono d'Or !`,
    usersUpdated: c.usersUpdated, pronoOrWinners: c.pronoOr, currentStep: 3, missFrance
  });
}));

admin.post('/reset-step', wrap(async (req, res) => {
  const targetStep = Number(req.body.targetStep);
  if (![0, 1, 2].includes(targetStep)) return res.status(400).json({ error: 'Étape cible invalide (doit être 0, 1 ou 2)' });
  const official = await getOfficial();
  if (official.current_step <= targetStep) return res.status(400).json({ error: 'Impossible de revenir à cette étape' });
  if (targetStep === 0) await sql`update official_results set top15 = null, top5 = null, classement_final = null, miss_france = null, current_step = 0, updated_at = now() where id = 1`;
  if (targetStep === 1) await sql`update official_results set top5 = null, classement_final = null, miss_france = null, current_step = 1, updated_at = now() where id = 1`;
  if (targetStep === 2) await sql`update official_results set classement_final = null, miss_france = null, current_step = 2, updated_at = now() where id = 1`;
  const c = await recomputePronostics();
  const stepNames = ['Aucune validation', `Top ${SEMI} validé`, 'Top 5 validé'];
  res.json({ success: true, message: `Retour effectué ! État actuel : ${stepNames[targetStep]}`, currentStep: targetStep, usersUpdated: c.usersUpdated });
}));

admin.post('/reset-all-data', wrap(async (req, res) => {
  const result = await sql.begin(async tx => {
    const [{ photos }] = await tx`select count(*) as photos from costume_photos`;
    const del = await tx`delete from users where not is_admin`;
    await tx`delete from pronostics`;
    await tx`delete from quiz_answers`;
    await tx`delete from culture_g_answers`;
    await tx`delete from costume_votes`;
    await tx`delete from costume_photos`;
    await tx`update users set costume_photo_public = false`;
    await tx`update scores set quiz_score = 0, quiz_correct = 0, culture_g_score = 0, culture_g_correct = 0,
      pronostics_score = 0, defis_score = 0, blind_points = 0, total_score = 0`;
    await tx`delete from blind_answers`;
    await tx`update official_results set blind = ${tx.json({ phase: 'idle', index: -1 })} where id = 1`;
    await tx`update official_results set top15 = null, top5 = null, classement_final = null, miss_france = null,
      current_step = 0, updated_at = now() where id = 1`;
    await tx`delete from sessions where sid <> ${req.sessionID}`;
    const [{ admins }] = await tx`select count(*) as admins from users`;
    return { usersDeleted: del.count, photosDeleted: photos, adminsKept: admins };
  });
  res.json({
    success: true,
    message: `Reset complet effectué ! ${result.usersDeleted} joueur(s) supprimé(s), ${result.photosDeleted} photo(s) supprimée(s). Les comptes admin sont vierges.`,
    ...result
  });
}));

admin.get('/culture-g-ranking', wrap(async (req, res) => {
  const rankings = await sql`
    select u.id, u.pseudo::text as pseudo, s.culture_g_correct, s.culture_g_score,
           (select count(*) from culture_g_answers where user_id = u.id) as total_answered
    from users u join scores s on u.id = s.user_id
    where not u.is_admin order by s.culture_g_correct desc, total_answered desc`;
  res.json({ rankings, isValidated: rankings.some(r => r.culture_g_score > 0) });
}));

admin.post('/validate-culture-g', wrap(async (req, res) => {
  const awarded = await recalculateCultureGPoints();
  if (awarded.length === 0) return res.status(400).json({ error: 'Aucun joueur n\'a participé au questionnaire Culture G' });
  res.json({
    success: true,
    message: 'Points Culture G attribués aux 3 meilleurs.',
    awarded: awarded.map(a => ({ pseudo: a.pseudo, points: a.points, correctAnswers: a.value }))
  });
}));

app.use('/api/admin', admin);

// ============================================
// ERREURS
// ============================================

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (4 Mo maximum)' : 'Upload invalide' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide' });
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Erreur serveur:', err);
  res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : err.message });
});

module.exports = app;
module.exports.staticDir = path.join(__dirname, '..', 'public');
