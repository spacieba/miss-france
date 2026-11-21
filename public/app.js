/* ============================================================
   Miss France — Comité parallèle : cœur de l'appli
   (navigation, état partagé, La Une, outils communs)
   ============================================================ */

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"'`]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
    }[c]));
}

const ARROW = '<svg class="arrow" viewBox="0 0 22 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M0 7h20M14 1l6 6-6 6"/></svg>';
const ARROW_LEFT = '<svg class="arrow" viewBox="0 0 22 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M22 7H2M8 1L2 7l6 6"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PLACEHOLDER = '/img/candidate-placeholder.svg';

// État partagé entre les écrans
const App = {
    user: null,
    score: null,
    edition: { year: 2027 },
    candidates: [],
    official: { current_step: 0, top15: [], top5: [], classement_final: [] },
    leaderboard: [],
    pronos: null,
    current: 'une',
    loaders: {}
};

// ---------- Appels serveur ----------

async function api(url, options = {}) {
    const opts = { ...options };
    if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
        opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url, opts);
    if (response.status === 401) {
        location.href = '/';
        throw new Error('Session expirée');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Une erreur est survenue');
    return data;
}

// ---------- Toasts ----------

function toast(message, type = '') {
    const zone = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    zone.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 3200);
}

// ---------- Candidates ----------

const candByName = (name) => App.candidates.find(c => c.name === name);
const regionOf = (name) => String(name || '').replace(/^Miss /, '');
const photoOf = (name) => candByName(name)?.photo || PLACEHOLDER;
const personOf = (name) => candByName(name)?.person || '';

function fillCandidateSelect(select, names, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + names.map(name => {
        const person = personOf(name);
        return `<option value="${escapeHtml(name)}">${escapeHtml(regionOf(name))}${person ? ` — ${escapeHtml(person)}` : ''}</option>`;
    }).join('');
    if (names.includes(current)) select.value = current;
}

// ---------- Modales ----------

function openModal(html, { onClose, className = '' } = {}) {
    const modal = document.createElement('div');
    modal.className = `modal ${className}`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<div class="modal-inner">${html}</div>`;
    const previousFocus = document.activeElement;
    const close = () => {
        modal.remove();
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        if (onClose) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    const first = modal.querySelector('[data-close], button');
    if (first) first.focus();
    return { el: modal, close };
}

const modalTop = (kicker) => `
    <div class="modal-top">
        <p class="kicker">${escapeHtml(kicker)}</p>
        <button type="button" class="modal-close" data-close aria-label="Fermer">${CLOSE_ICON}</button>
    </div>`;

// Galerie d'une candidate (photos en grand, flèches, balayage)
// options.action = { label(selected), isSelected(), toggle() } pour ajouter/retirer de sa sélection
function openCandidateGallery(name, options = {}) {
    const cand = candByName(name);
    if (!cand) return;
    const photos = cand.photos && cand.photos.length ? cand.photos : [cand.photo];
    let index = 0;
    const action = options.action;
    const bioHtml = candidateBioHtml(cand);
    const { el } = openModal(`
        ${modalTop(regionOf(name) === name ? 'Portfolio' : `Miss ${regionOf(name)}`)}
        <div class="gallery-stage"><img alt="${escapeHtml(name)}"></div>
        <div class="gallery-head">
            <span class="serif">${escapeHtml(cand.person || regionOf(name))}</span>
            <span class="gallery-counter"></span>
        </div>
        <div class="gallery-controls">
            <button type="button" class="square-btn" data-dir="-1" aria-label="Photo précédente">${ARROW_LEFT}</button>
            <button type="button" class="square-btn" data-dir="1" aria-label="Photo suivante">${ARROW}</button>
            ${action ? '<button type="button" class="btn btn-blue" data-action></button>' : ''}
        </div>
        ${bioHtml}
    `, { className: bioHtml ? 'has-bio' : '' });
    const img = el.querySelector('.gallery-stage img');
    const counter = el.querySelector('.gallery-counter');
    const pad = (n) => String(n).padStart(2, '0');
    const show = (i) => {
        index = (i + photos.length) % photos.length;
        img.src = photos[index];
        counter.innerHTML = `${pad(index + 1)}<small>/${pad(photos.length)}</small>`;
    };
    el.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => show(index + Number(b.dataset.dir))));
    if (photos.length < 2) el.querySelectorAll('[data-dir]').forEach(b => { b.hidden = true; });
    const actionBtn = el.querySelector('[data-action]');
    const refreshAction = () => { if (actionBtn) actionBtn.textContent = action.label(action.isSelected()); };
    if (actionBtn) {
        if (action.disabled) actionBtn.disabled = true;
        actionBtn.addEventListener('click', () => { action.toggle(); refreshAction(); });
        refreshAction();
    }
    let touchX = null;
    const stage = el.querySelector('.gallery-stage');
    stage.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
        touchX = null;
    });
    el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') show(index - 1);
        if (e.key === 'ArrowRight') show(index + 1);
    });
    show(0);
}

// ---------- Navigation ----------

function go(section, { push = true } = {}) {
    if (!$(section)) section = 'une';
    if (section === 'admin' && !App.user?.isAdmin) section = 'une';
    App.current = section;
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === section));
    document.querySelectorAll('.nav-btn').forEach(b => {
        const on = b.dataset.go === section;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const bar = $('prono-bar');
    if (bar && section !== 'pronostics') bar.hidden = true;
    window.scrollTo({ top: 0 });
    if (push && location.hash !== `#${section}`) history.pushState({ section }, '', `#${section}`);
    const loader = App.loaders[section];
    if (loader) Promise.resolve(loader()).catch(err => toast(err.message, 'error'));
}

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-go]');
    if (target) { e.preventDefault(); go(target.dataset.go); }
});
window.addEventListener('popstate', () => go((location.hash || '#une').slice(1), { push: false }));

// ---------- Score, rang, en-tête ----------

const plural = (n, word) => `${n} ${word}${Math.abs(n) > 1 ? 's' : ''}`;
const SEMI = () => Number(App.edition.semiFinalists) || 15;
const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);

async function refreshScore() {
    const [me, board] = await Promise.all([api('/api/me'), api('/api/leaderboard')]);
    App.user = me.user;
    App.score = me.score || {};
    App.leaderboard = board;
    const total = App.score.total_score || 0;
    const index = board.findIndex(p => p.user_id === App.user.id);
    const rank = index >= 0 ? index + 1 : null;
    $('header-score').textContent = `${total} pt${total > 1 ? 's' : ''}`;
    $('header-rank').textContent = rank ? `· ${ordinal(rank)}` : '';
    $('une-score').textContent = total;
    $('une-rank').textContent = rank ? ordinal(rank) : '–';
    return { total, rank };
}

async function refreshOfficial() {
    App.official = await api('/api/official-results');
    return App.official;
}

// ---------- La Une ----------

function electionDate() {
    const day = App.edition.electionDate || '2026-12-12';
    return new Date(`${day}T21:10:00+01:00`);
}

function renderCountdown() {
    const diff = electionDate() - Date.now();
    const v = $('une-countdown');
    const l = $('une-countdown-label');
    if (App.official.current_step >= 3) { v.textContent = '👑'; l.textContent = 'Couronnée'; return; }
    if (diff <= 0) { v.textContent = 'Live'; l.textContent = 'Ce soir'; return; }
    const days = Math.floor(diff / 86400000);
    if (days >= 1) { v.textContent = days; l.textContent = days > 1 ? 'Jours' : 'Jour'; return; }
    const hours = Math.floor(diff / 3600000);
    v.textContent = hours >= 1 ? `${hours}h` : `${Math.max(1, Math.floor(diff / 60000))}'`;
    l.textContent = 'Avant le show';
}

async function loadUne() {
    const [pronos, quiz, cg, myPhoto] = await Promise.all([
        api('/api/pronostics'),
        api('/api/quiz/score'),
        api('/api/culture-g/progress'),
        api('/api/costume/my-photo')
    ]);
    App.pronos = pronos;
    await refreshScore().catch(() => {});
    const s = App.score || {};

    $('une-pseudo').textContent = App.user.pseudo;

    // Couverture : ma future Miss France, sinon une candidate au hasard (fixe pour la journée)
    const or = pronos?.prono_or;
    const featured = or ? candByName(or) : App.candidates[new Date().getDate() % Math.max(1, App.candidates.length)];
    if (featured) $('une-cover-photo').src = featured.photo;
    $('une-cover-line').textContent = or
        ? `Mon pronostic d'or : Miss ${regionOf(or)}`
        : `${App.candidates.length} candidates, une seule couronne`;
    const step = App.official.current_step;
    $('une-cover-tag').textContent = ['Le jeu du comité', `Top ${SEMI()} dévoilé`, 'Top 5 dévoilé', 'Miss France est élue'][step] || 'Le jeu du comité';
    if (step >= 3 && App.official.classement_final[0]) {
        const winner = candByName(App.official.classement_final[0]);
        if (winner) $('une-cover-photo').src = winner.photo;
        $('une-cover-line').textContent = `${App.official.classement_final[0]}, Miss France ${App.edition.year}`;
    }
    renderCountdown();
    $('replay-reveal').hidden = step === 0;

    const top15Count = pronos?.top15?.length || 0;
    const items = [
        { go: 'candidates', title: 'Les candidates', sub: `${App.candidates.length} portraits : photos et biographies`, pts: null },
        { go: 'pronostics', title: 'Les pronostics', sub: step >= 1 ? 'Résultats en cours' : (top15Count ? `Top ${SEMI()} : ${top15Count}/${SEMI()}${pronos.prono_or ? ' · prono d\'or choisi' : ''}` : 'Pas encore commencé'), pts: s.pronostics_score },
        { go: 'quiz', title: 'Le quiz Miss France', sub: quiz.totalAnswers ? `${quiz.totalAnswers}/${App.edition.quizCount} réponses · ${quiz.correctAnswers} justes` : `${App.edition.quizCount} questions`, pts: s.quiz_score },
        { go: 'culture-g', title: 'La Culture G', sub: cg.totalAnswers ? `${cg.totalAnswers}/${cg.totalQuestions} réponses` : 'Le vrai test des candidates', pts: s.culture_g_score },
        { go: 'costume', title: 'Le meilleur costume', sub: myPhoto.photo ? (myPhoto.isPublic ? 'Mon look est en ligne' : 'Mon look est privé') : 'Poster mon look', pts: s.defis_score },
        { go: 'leaderboard', title: 'Le palmarès', sub: 'Le classement du comité', pts: null }
    ];
    $('une-toc').innerHTML = items.map((it, i) => `
        <li><button type="button" class="toc-item" data-go="${it.go}">
            <span class="toc-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="toc-body"><span class="toc-title">${escapeHtml(it.title)}</span><span class="toc-sub">${escapeHtml(it.sub)}</span></span>
            <span class="toc-pts">${it.pts === null || it.pts === undefined ? ARROW : `${it.pts} pts`}</span>
        </button></li>`).join('');
}
App.loaders.une = loadUne;

// ---------- Inviter (QR code) ----------

function openInvite() {
    const url = `${location.origin}/`;
    const { el } = openModal(`
        ${modalTop('Inviter au comité')}
        <h2 class="headline">Rejoins le <em>jury</em></h2>
        <div class="qr-box">
            <img src="/api/invite-qr.svg" alt="QR code vers ${escapeHtml(url)}" width="300" height="300">
            <span class="qr-url">${escapeHtml(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span>
            ${App.partyCode ? `<p class="qr-code-line">Mot de passe de la soirée : <strong>${escapeHtml(App.partyCode)}</strong></p>` : ''}
            <p class="hint">Fais scanner ce code avec l'appareil photo du téléphone, ou envoie le lien. Chacun entre son nom ou un pseudo, puis le mot de passe de la soirée.</p>
        </div>
        <button type="button" class="btn btn-blue btn-block btn-between" data-share><span>Envoyer le lien</span>${ARROW}</button>
    `);
    el.querySelector('[data-share]').addEventListener('click', async () => {
        const text = `Rejoins le comité parallèle Miss France ${App.edition.year} : pronostics, quiz et costumes !${App.partyCode ? ` Mot de passe : ${App.partyCode}` : ''}`;
        if (navigator.share) {
            try { await navigator.share({ title: 'Miss France — Comité parallèle', text, url }); } catch { /* annulé */ }
        } else {
            try { await navigator.clipboard.writeText(url); toast('Lien copié !', 'success'); } catch { toast(url); }
        }
    });
}

// ---------- Installer l'appli (PWA) ----------

let installPrompt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('open-install').hidden = false;
});
window.addEventListener('appinstalled', () => { $('open-install').hidden = true; toast('Appli installée !', 'success'); });

async function openInstall() {
    if (installPrompt) {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice.catch(() => null);
        if (choice?.outcome === 'accepted') $('open-install').hidden = true;
        installPrompt = null;
        return;
    }
    openModal(`
        ${modalTop("Installer l'appli")}
        <h2 class="headline">Sur ton <em>écran d'accueil</em></h2>
        <ol class="rules">
            <li><span>1. Touche le bouton <strong>Partager</strong> de Safari (le carré avec une flèche)</span></li>
            <li><span>2. Choisis <strong>Sur l'écran d'accueil</strong></span></li>
            <li><span>3. Touche <strong>Ajouter</strong> : l'icône Miss France apparaît</span></li>
        </ol>
    `);
}

// ---------- Son & vibrations (réglage) ----------

function fxEnabled() {
    try { return localStorage.getItem('mf-fx') !== 'off'; } catch { return true; }
}
function renderFxToggle() {
    $('sound-toggle').textContent = `Son & vibrations : ${fxEnabled() ? 'activés' : 'coupés'}`;
}

// ---------- Démarrage ----------

async function loadEdition() {
    try { App.edition = await api('/api/edition'); } catch { /* valeurs par défaut */ }
    const e = App.edition;
    document.querySelectorAll('.edition-year').forEach(el => { el.textContent = e.year; });
    const semi = Number(e.semiFinalists) || 15;
    document.querySelectorAll('.semi-n').forEach(el => { el.textContent = semi; });
    document.querySelectorAll('.rules-max').forEach(el => { el.textContent = semi * 5 + 250; });
    document.querySelectorAll('.quiz-count').forEach(el => { el.textContent = e.quizCount; });
    document.querySelectorAll('.culture-g-label').forEach(el => { el.textContent = e.cultureGLabel; });
    if (e.electionDate) {
        const d = new Date(`${e.electionDate}T12:00:00`);
        $('une-date').textContent = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    document.title = `Miss France ${e.year} — Comité parallèle`;
    renderTheme(e.theme);
}

// Thème de la soirée : carte sur la Une, dress code au règlement, rappel dans les looks
function renderTheme(t) {
    if (!t) return;
    document.querySelectorAll('.theme-name').forEach(el => { el.textContent = t.name; });
    document.querySelectorAll('.theme-inline').forEach(el => { el.hidden = false; });
    $('une-theme-name').textContent = t.name;
    $('une-theme-tagline').textContent = t.tagline || '';
    $('une-theme').hidden = false;
    $('rules-theme-intro').textContent = t.intro || '';
    $('rules-theme-list').innerHTML = (t.rules || []).map((r, i) => `
        <li><span class="dress-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="dress-body"><span class="dress-title">${escapeHtml(r.title)}</span><span class="dress-text">${escapeHtml(r.text)}</span></span></li>`).join('');
    $('rules-theme').hidden = false;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadEdition();
        const me = await api('/api/me');
        App.user = me.user;
        App.score = me.score;
        App.partyCode = me.partyCode;
        $('admin-btn').hidden = !App.user.isAdmin;
        [App.candidates] = await Promise.all([api('/api/candidates'), refreshOfficial()]);
    } catch (err) {
        if (err.message !== 'Session expirée') toast(err.message, 'error');
        return;
    }

    $('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' }).catch(() => {});
        location.href = '/';
    });
    $('open-invite').addEventListener('click', openInvite);
    $('replay-reveal').addEventListener('click', () => window.Live && window.Live.replay().catch(err => toast(err.message, 'error')));
    $('open-install').addEventListener('click', openInstall);
    $('open-cover').addEventListener('click', () => window.openCoverStudio && window.openCoverStudio());
    $('sound-toggle').addEventListener('click', () => {
        try { localStorage.setItem('mf-fx', fxEnabled() ? 'off' : 'on'); } catch { /* stockage indisponible */ }
        renderFxToggle();
        if (fxEnabled() && window.MFX) window.MFX.ding();
    });
    renderFxToggle();
    if (isIOS() && !isStandalone()) $('open-install').hidden = false;
    setInterval(renderCountdown, 30000);

    refreshScore().catch(() => {});
    go((location.hash || '#une').slice(1), { push: false });
    document.dispatchEvent(new CustomEvent('app:ready'));

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
});
