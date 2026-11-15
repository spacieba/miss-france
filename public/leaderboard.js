/* ============================================================
   Le palmarès : classement général et par jeu
   ============================================================ */

const Board = { tab: 'total', culture: null, costume: null };

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
            <span class="who"><span class="kicker">En tête</span><span class="serif">${escapeHtml(first.pseudo)}</span></span>
            <span class="pts">${fmt(value(first))}</span>
        </div>
        <ol class="board">
            ${rest.map(r => `
                <li class="board-row ${isMe(r) ? 'me' : ''}">
                    <span class="n">${String(r.rank).padStart(2, '0')}</span>
                    <span class="name">${escapeHtml(r.pseudo)}${detail ? `<span class="detail">${escapeHtml(detail(r))}</span>` : ''}</span>
                    <span class="pts">${value(r)} ${unit}</span>
                </li>`).join('')}
        </ol>
        ${isMe(first) ? '<p class="hint" style="margin-top: 12px;">C\'est toi qui mènes la danse.</p>' : ''}`;
}

async function renderTab() {
    const me = (id) => id === App.user.id;
    const box = $('lb-content');
    const t = Board.tab;
    if (t === 'total' || t === 'pronostics' || t === 'quiz') {
        const key = { total: 'total_score', pronostics: 'pronostics_score', quiz: 'quiz_score' }[t];
        const rows = [...App.leaderboard].sort((a, b) => (b[key] || 0) - (a[key] || 0) || a.pseudo.localeCompare(b.pseudo));
        box.innerHTML = renderBoard(rows, {
            value: r => r[key] || 0,
            isMe: r => me(r.user_id),
            detail: t === 'total' ? r => `Pronos ${r.pronostics_score} · Quiz ${r.quiz_score} · Culture G ${r.culture_g_score || 0} · Costume ${r.defis_score}` : null
        });
    } else if (t === 'culture') {
        Board.culture = await api('/api/culture-g/leaderboard');
        box.innerHTML = renderBoard(Board.culture, {
            value: r => r.raw_score,
            unit: `/ ${Board.culture[0]?.max_score ?? ''}`,
            isMe: r => me(r.id),
            detail: r => (r.awarded_points ? `+${r.awarded_points} pts au général` : '')
        }) + '<p class="hint" style="margin-top: 12px;">Score brut du questionnaire. Les 3 premiers gagnent 15, 10 et 5 points.</p>';
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
    const { rank } = await refreshScore();
    $('lb-kicker').textContent = rank ? `Tu es ${ordinal(rank)} sur ${App.leaderboard.length}` : 'Le classement';
    await renderTab();
}
App.loaders.leaderboard = loadLeaderboard;

document.addEventListener('app:ready', () => {
    document.querySelectorAll('.lb-tab').forEach(b => b.addEventListener('click', () => {
        Board.tab = b.dataset.lb;
        document.querySelectorAll('.lb-tab').forEach(x => x.classList.toggle('active', x === b));
        renderTab().catch(err => toast(err.message, 'error'));
    }));
});
