/* ============================================================
   Le blind test en direct
   L'admin lance la chanson et ouvre les réponses ; chacun répond sur son téléphone ;
   l'admin révèle. À la fin, tout le monde tente de deviner le thème caché.
   ============================================================ */

const Blind = { data: null, key: '', timer: null, sending: false, lastPhaseKey: '' };

const BLIND_ASK = { title: 'Quel est le <em>titre</em> ?', artist: 'Qui <em>chante</em> ?' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function blindRankingHtml(ranking, { limit = 5, final = false } = {}) {
    if (!ranking || !ranking.length) return '';
    let rank = 0;
    const rows = ranking.map((r, i) => {
        if (i === 0 || r.points !== ranking[i - 1].points) rank = i + 1;
        return { ...r, rank };
    });
    const shown = rows.filter((r, i) => i < limit || r.me);
    return `
        <div class="blind-ranking">
            <p class="kicker">${final ? 'Le podium du blind test' : 'Le classement du blind test'}</p>
            <ol class="blind-rank-list">${shown.map(r => `
                <li class="${r.me ? 'me' : ''}">
                    <span class="r">${r.rank}</span>
                    <span class="n">${escapeHtml(r.pseudo)}${r.me ? ' <small>(toi)</small>' : ''}</span>
                    <span class="p">${r.points} pt${r.points > 1 ? 's' : ''}${final && r.awarded ? `<small> · +${r.awarded} au général</small>` : ''}</span>
                </li>`).join('')}</ol>
        </div>`;
}

function renderBlind() {
    const d = Blind.data;
    const box = $('blind-body');
    if (!d || !d.enabled) { box.innerHTML = '<p class="empty">Pas de blind test cette année.</p>'; return; }
    if (d.away) {
        $('blind-kicker').textContent = 'Sur place uniquement';
        box.innerHTML = `<div class="blind-wait"><h2 class="subhead">Le blind test se joue <em>à ${escapeHtml(placeName())}</em></h2>
            <p class="hint">Il est lancé en direct pendant la soirée, avec la musique dans le salon : impossible d'y jouer à distance. Les pronostics, les quiz et le concours de tenues, eux, comptent pour tout le monde.</p></div>`;
        return;
    }

    $('blind-kicker').textContent = d.phase === 'idle' ? 'En attente' : d.phase === 'theme' ? 'La question finale' : d.phase === 'done' ? 'Terminé' : `Chanson ${d.index + 1} / ${d.total}`;
    $('blind-score').textContent = `${d.myPoints || 0} pt${d.myPoints > 1 ? 's' : ''}`;

    if (d.phase === 'idle') {
        box.innerHTML = `
            <div class="blind-wait">
                <div class="blind-pulse" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
                <h2 class="subhead">Le blind test n'a pas <em>commencé</em></h2>
                <p class="hint">Garde cet écran ouvert : dès que la première chanson démarre, les propositions s'affichent ici toutes seules.</p>
                <ul class="rules">
                    <li><span>Par bonne réponse</span><strong>1 pt</strong></li>
                    <li><span>Deviner le thème caché, à la fin</span><strong>+${d.themeBonus} pts</strong></li>
                    <li><span>Les 3 premiers, au classement général</span><strong>${(d.awards || []).join(' · ')}</strong></li>
                </ul>
            </div>`;
        return;
    }

    if (d.phase === 'open' || d.phase === 'revealed') {
        const q = d.question;
        const revealed = d.phase === 'revealed';
        const answers = q.options.map((opt, i) => {
            const cls = ['answer'];
            if (revealed) {
                if (i === d.reveal.correct) cls.push('correct');
                else if (i === d.myAnswer) cls.push('wrong');
            } else if (i === d.myAnswer) cls.push('picked');
            return `<button type="button" class="${cls.join(' ')}" data-blind-answer="${i}" ${revealed ? 'disabled' : ''} aria-pressed="${i === d.myAnswer}">
                <span class="letter">${LETTERS[i]}</span><span>${escapeHtml(opt)}</span></button>`;
        }).join('');
        let footer;
        if (!revealed) {
            footer = d.myAnswer === null
                ? '<p class="hint blind-status">Écoute… et touche ta réponse.</p>'
                : '<p class="hint blind-status ok">Réponse enregistrée. Tu peux encore changer d\'avis jusqu\'à la révélation.</p>';
        } else {
            const verdict = d.myAnswer === null ? ['Pas de réponse', 'miss'] : d.reveal.isCorrect ? ['Bien joué, +1 point', 'good'] : ['Raté', 'bad'];
            footer = `
                <div class="blind-reveal ${verdict[1]}">
                    <p class="blind-verdict">${verdict[0]}</p>
                    <p class="blind-song"><span class="serif">${escapeHtml(d.reveal.title)}</span><span>${escapeHtml(d.reveal.artist)}</span></p>
                </div>
                ${blindRankingHtml(d.ranking)}
                <p class="hint blind-status">${d.reveal.last ? 'C\'était la dernière chanson : la question finale arrive.' : 'La chanson suivante arrive…'}</p>`;
        }
        box.innerHTML = `
            <h2 class="q-text blind-q">${BLIND_ASK[q.ask] || BLIND_ASK.title}</h2>
            <div class="answers" id="blind-answers">${answers}</div>
            ${footer}`;
        return;
    }

    if (d.phase === 'theme') {
        const guess = d.theme.myGuess;
        box.innerHTML = `
            <h2 class="q-text blind-q">${escapeHtml(d.theme.question)}</h2>
            <p class="hint">Une dernière réponse, en toutes lettres, pour <strong>${d.themeBonus} points de plus</strong>.</p>
            <form id="blind-theme-form" class="blind-theme-form">
                <input type="text" class="input" id="blind-theme-input" maxlength="80" placeholder="Le thème caché" autocomplete="off" value="${escapeHtml(guess || '')}">
                <button type="submit" class="btn btn-blue btn-block btn-between"><span>${guess ? 'Modifier ma réponse' : 'Valider'}</span>${ARROW}</button>
            </form>
            ${guess ? `<p class="hint blind-status ok">Réponse enregistrée : « ${escapeHtml(guess)} ». Tu peux encore la changer.</p>` : ''}`;
        return;
    }

    // Terminé : le thème, le podium, puis la liste des chansons avec le lien caché
    const t = d.theme;
    const verdict = t.myGuess === null ? ['Tu n\'as pas répondu', 'miss'] : t.isCorrect ? [`Bien vu, +${d.themeBonus} points`, 'good'] : ['Pas tout à fait', 'bad'];
    box.innerHTML = `
        <div class="blind-reveal ${verdict[1]}">
            <p class="kicker">Le thème caché était…</p>
            <p class="blind-theme-answer serif">${escapeHtml(t.answer)}</p>
            <p class="blind-verdict">${verdict[0]}${t.myGuess ? ` <small>(ta réponse : « ${escapeHtml(t.myGuess)} »)</small>` : ''}</p>
            <p class="hint">${escapeHtml(t.explanation || '')}</p>
        </div>
        ${blindRankingHtml(d.ranking, { limit: 10, final: true })}
        <h2 class="subhead">Les <em>chansons</em></h2>
        <ol class="blind-songs">${(d.songs || []).map((s, i) => `
            <li class="${s.ok ? 'ok' : ''}">
                <span class="dress-num">${String(i + 1).padStart(2, '0')}</span>
                <span class="dress-body"><span class="dress-title">${escapeHtml(s.title)}</span><span class="small muted">${escapeHtml(s.artist)}${s.ok ? ' · trouvée' : ''}</span><span class="dress-text">${escapeHtml(s.link || '')}</span></span>
            </li>`).join('')}</ol>`;
}

async function refreshBlind({ force = false } = {}) {
    const d = await api('/api/blind');
    // On ne redessine que si quelque chose a changé (sinon on effacerait une saisie en cours)
    const key = JSON.stringify([d.phase, d.index, d.myAnswer, d.theme?.myGuess, d.ranking?.length, d.myPoints]);
    const phaseKey = `${d.phase}:${d.index}`;
    const phaseChanged = phaseKey !== Blind.lastPhaseKey;
    Blind.data = d;
    if (force || key !== Blind.key) {
        Blind.key = key;
        renderBlind();
    }
    if (phaseChanged && Blind.lastPhaseKey) {
        if (d.phase === 'open' || d.phase === 'theme') { MFX.ding(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        if (d.phase === 'revealed') { if (d.reveal.isCorrect) MFX.good(); else MFX.bad(); refreshScore().catch(() => {}); }
        if (d.phase === 'done') { MFX.fanfare(); if (d.theme.isCorrect) confetti(70); refreshScore().catch(() => {}); }
    }
    Blind.lastPhaseKey = phaseKey;
    updateBlindBanner(d);
}

// Bandeau « blind test en cours » sur les autres rubriques
function updateBlindBanner(state) {
    const banner = $('blind-banner');
    if (!banner) return;
    const live = state && (state.phase === 'open' || state.phase === 'revealed' || state.phase === 'theme');
    banner.hidden = !live || App.current === 'blind' || App.current === 'admin';
    if (live) $('blind-banner-text').textContent = state.phase === 'theme' ? 'Blind test : la question finale' : `Blind test en cours · chanson ${state.index + 1}/${state.total}`;
}

function loadBlind() {
    // L'admin pilote d'ici : la télécommande s'affiche au-dessus de l'écran des joueurs
    const admin = App.user.isAdmin;
    $('blind-remote').hidden = !admin;
    $('blind-players-view').hidden = !admin;
    if (admin && typeof renderAdminBlind === 'function') renderAdminBlind().catch(() => {});
    return refreshBlind({ force: true });
}

App.loaders.blind = loadBlind;

document.addEventListener('app:ready', () => {
    // Réponse à une chanson
    $('blind-body').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-blind-answer]');
        if (!btn || btn.disabled || Blind.sending) return;
        const d = Blind.data;
        if (!d || d.phase !== 'open') return;
        const answer = Number(btn.dataset.blindAnswer);
        Blind.sending = true;
        MFX.tap();
        try {
            await api('/api/blind/answer', { method: 'POST', body: { questionId: d.question.id, answer } });
        } catch (err) { toast(err.message, 'error'); }
        Blind.sending = false;
        refreshBlind({ force: true }).catch(() => {});
    });
    // Réponse au thème
    $('blind-body').addEventListener('submit', async (e) => {
        if (e.target.id !== 'blind-theme-form') return;
        e.preventDefault();
        const answer = $('blind-theme-input').value.trim();
        if (!answer) return toast('Écris ta réponse.', 'error');
        try {
            await api('/api/blind/answer', { method: 'POST', body: { questionId: 'theme', answer } });
            toast('Réponse enregistrée', 'success');
        } catch (err) { toast(err.message, 'error'); }
        refreshBlind({ force: true }).catch(() => {});
    });

    // Rafraîchissement : rapide sur l'écran du blind test, plus lent ailleurs (pour le bandeau)
    let tick = 0;
    setInterval(() => {
        if (document.visibilityState !== 'visible' || App.current === 'admin' || isAway() || isPreview()) return;
        tick++;
        const typing = document.activeElement && document.activeElement.id === 'blind-theme-input';
        if (App.current === 'blind') { if (!typing) refreshBlind().catch(() => {}); }
        else if (tick % 4 === 0) api('/api/blind').then(d => { Blind.data = d; Blind.lastPhaseKey = `${d.phase}:${d.index}`; updateBlindBanner(d); }).catch(() => {});
    }, 2500);
    if (!isPreview()) api('/api/blind').then(d => { Blind.data = d; Blind.lastPhaseKey = `${d.phase}:${d.index}`; updateBlindBanner(d); }).catch(() => {});
});
