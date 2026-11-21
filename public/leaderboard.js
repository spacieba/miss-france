/* ============================================================
   Le palmarès : classement général et par jeu
   ============================================================ */

// Trois classements (tout le monde, sur place, équipes), chacun en « toutes les épreuves » ou « pronostics seuls »
const Board = { tab: 'total', mode: 'all', culture: null, costume: null };
const awayTag = (r) => {
    if (r.location === 'away') return ' <span class="away-tag">à distance</span>';
    const t = typeof teamInfo === 'function' ? teamInfo(r.team) : null;
    return t ? ` <span class="away-tag team-tag team-${t.key}">${escapeHtml(t.short || t.name)}</span>` : '';
};

// Duel des équipes. Toutes les épreuves : moyenne des joueurs + épreuves collectives.
// Pronostics seuls : moyenne des points de pronostics des joueurs.
function renderTeams(data, mode) {
    const pronos = mode === 'pronos';
    const teams = (data.teams || []).map(t => ({ ...t, score: pronos ? t.averagePronos : t.total }));
    if (!teams.length) return '<p class="empty">Pas d\'équipes cette année.</p>';
    const best = Math.max(...teams.map(t => t.score));
    const tied = teams.filter(t => t.score === best).length > 1;
    const lead = (t) => !tied && t.score === best && best > 0;
    const events = pronos ? [] : teams.flatMap(t => t.events.map(e => ({ ...e, team: t }))).sort((x, y) => x.id - y.id);
    return `
        <div class="team-duel">${teams.map(t => `
            <div class="team-col team-${t.key} ${lead(t) ? 'lead' : ''}">
                <span class="kicker">${lead(t) ? 'En tête' : data.myTeam === t.key ? 'Ton équipe' : '&nbsp;'}</span>
                <span class="team-name">${escapeHtml(t.short || t.name)}</span>
                <span class="team-total">${t.score}<small> pts</small></span>
                <span class="small">${pronos ? 'Moyenne des pronostics' : `Moyenne ${t.average} · Épreuves ${t.bonus > 0 ? '+' : ''}${t.bonus}`}</span>
                <span class="small muted">${t.size} joueur${t.size > 1 ? 's' : ''}${lead(t) && data.myTeam === t.key ? ' · ton équipe' : ''}</span>
            </div>`).join('')}
        </div>
        ${events.length ? `<h2 class="subhead">Les <em>épreuves</em></h2><ul class="rules">${events.map(e => `
            <li><span>${escapeHtml(e.label)} <span class="away-tag team-tag team-${e.team.key}">${escapeHtml(e.team.short || e.team.name)}</span></span><strong>${e.points > 0 ? '+' : ''}${e.points}</strong></li>`).join('')}</ul>` : ''}
        ${teams.map(t => {
            const members = [...t.members].sort((x, y) => (pronos ? y.pronos - x.pronos : y.points - x.points) || x.pseudo.localeCompare(y.pseudo));
            return `
            <h2 class="subhead">${escapeHtml(t.name)}</h2>
            ${members.length ? `<ol class="board">${members.map((m, i) => `
                <li class="board-row ${m.id === App.user.id ? 'me' : ''}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="name">${escapeHtml(m.pseudo)}</span><span class="pts">${pronos ? m.pronos : m.points} pts</span></li>`).join('')}</ol>` : '<p class="empty">Personne pour l\'instant.</p>'}`;
        }).join('')}
        <p class="hint" style="margin-top: 14px;">${pronos
            ? 'Score d\'équipe = moyenne des points de pronostics de ses joueurs.'
            : 'Score d\'équipe = moyenne des points de ses joueurs + points des épreuves collectives.'} Les équipes ne concernent que les joueurs sur place.</p>`;
}

// Rangs partagés pour les ex-æquo (1, 2, 2, 4…)
function withRanks(rows, value) {
    let rank = 0;
    return rows.map((r, i) => {
        if (i === 0 || value(r) !== value(rows[i - 1])) rank = i + 1;
        return { ...r, rank };
    });
}

function renderBoard(rows, { value, unit = 'pts', detail, isMe }) {
    if (!rows.length) return '<p class="empty">Personne au classement pour l\'instant.</p>';
    const ranked = withRanks(rows, value);
    const [first, ...rest] = ranked;
    const fmt = (v) => `${v}<small> ${unit}</small>`;
    return `
        <div class="leader">
            <span class="n">${String(first.rank).padStart(2, '0')}</span>
            <span class="who"><span class="kicker">En tête</span><span class="serif">${escapeHtml(first.pseudo)}${awayTag(first)}</span></span>
            <span class="pts">${fmt(value(first))}</span>
        </div>
        <ol class="board">
            ${rest.map(r => `
                <li class="board-row ${isMe(r) ? 'me' : ''}">
                    <span class="n">${String(r.rank).padStart(2, '0')}</span>
                    <span class="name">${escapeHtml(r.pseudo)}${awayTag(r)}${detail ? `<span class="detail">${escapeHtml(detail(r))}</span>` : ''}</span>
                    <span class="pts">${value(r)} ${unit}</span>
                </li>`).join('')}
        </ol>
        ${isMe(first) ? '<p class="hint" style="margin-top: 12px;">C\'est toi qui mènes la danse.</p>' : ''}`;
}

async function renderTab() {
    const me = (id) => id === App.user.id;
    const box = $('lb-content');
    const t = Board.tab;
    const pronos = Board.mode === 'pronos';
    // Le choix « toutes les épreuves / pronostics seuls » ne concerne que les trois grands classements
    $('lb-mode').hidden = !(t === 'total' || t === 'home' || t === 'teams');
    if (t === 'teams') { box.innerHTML = renderTeams(await api('/api/teams'), Board.mode); return; }
    if (t === 'total' || t === 'home') {
        const key = pronos ? 'pronostics_score' : 'total_score';
        const pool = t === 'home' ? App.leaderboard.filter(r => r.location === 'home') : App.leaderboard;
        const rows = [...pool].sort((a, b) => (b[key] || 0) - (a[key] || 0) || a.pseudo.localeCompare(b.pseudo));
        box.innerHTML = renderBoard(rows, {
            value: r => r[key] || 0,
            isMe: r => me(r.user_id),
            detail: pronos ? null : r => `Pronos ${r.pronostics_score} · Quiz ${r.quiz_score} · Culture G ${r.culture_g_score || 0} · Blind test ${r.blind_points || 0} · Costume ${r.defis_score}`
        }) + `<p class="hint" style="margin-top: 12px;">${t === 'home' ? `Uniquement les joueurs présents à ${escapeHtml(placeName())}.` : 'Tous les joueurs, sur place et à distance.'} ${pronos ? 'Points des pronostics uniquement.' : 'Toutes les épreuves comptent.'}</p>`;
    } else if (t === 'culture') {
        Board.culture = await api('/api/culture-g/leaderboard');
        box.innerHTML = renderBoard(Board.culture, {
            value: r => r.raw_score,
            unit: `/ ${Board.culture[0]?.max_score ?? ''}`,
            isMe: r => me(r.id),
            detail: r => (r.awarded_points ? `+${r.awarded_points} pts au général` : '')
        }) + '<p class="hint" style="margin-top: 12px;">Score brut du questionnaire. Les 3 premiers gagnent 15, 10 et 5 points.</p>';
    } else if (t === 'blind') {
        const data = await api('/api/blind');
        const rows = data.ranking || [];
        box.innerHTML = (rows.length ? renderBoard(rows, {
            value: r => r.points,
            isMe: r => r.me,
            detail: r => (r.awarded ? `+${r.awarded} pts au général` : '')
        }) : '<p class="empty">Le classement du blind test s\'affiche après chaque chanson révélée.</p>')
            + '<p class="hint" style="margin-top: 12px;">1 point par bonne réponse, plus un bonus pour le thème caché. Les 3 premiers gagnent 15, 10 et 5 points.</p>';
    } else {
        const data = await api('/api/costume/results');
        const rows = data.results.map(r => ({ ...r, votes: Number(r.votes) }));
        box.innerHTML = renderBoard(rows, {
            value: r => r.votes,
            unit: 'votes',
            isMe: r => me(r.id)
        }) + `<p class="hint" style="margin-top: 12px;">${data.totalVotes} vote(s) au total. Les 3 premiers gagnent 30, 20 et 10 points.</p>`;
    }
}

async function loadLeaderboard() {
    $('lb-tab-teams').hidden = !(App.edition.teams || []).length;
    $('lb-tab-home').hidden = !App.edition.place;
    const { rank } = await refreshScore();
    $('lb-kicker').textContent = rank ? `Tu es ${ordinal(rank)} sur ${App.leaderboard.length}` : 'Le classement';
    await renderTab();
}
App.loaders.leaderboard = loadLeaderboard;

document.addEventListener('app:ready', () => {
    document.querySelectorAll('[data-lb-mode]').forEach(b => b.addEventListener('click', () => {
        Board.mode = b.dataset.lbMode;
        document.querySelectorAll('[data-lb-mode]').forEach(x => x.classList.toggle('active', x === b));
        renderTab().catch(err => toast(err.message, 'error'));
    }));
    document.querySelectorAll('.lb-tab').forEach(b => b.addEventListener('click', () => {
        Board.tab = b.dataset.lb;
        document.querySelectorAll('.lb-tab').forEach(x => x.classList.toggle('active', x === b));
        renderTab().catch(err => toast(err.message, 'error'));
    }));
});
