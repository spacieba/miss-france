/* ============================================================
   Admin : résultats officiels étape par étape, jeux, joueurs
   ============================================================ */

const Admin = { users: [] };

function adminCheckList(names, type, checked, disabled) {
    return `<ul class="admin-list">${names.map(name => `
        <li><label class="admin-check">
            <img src="${escapeHtml(photoOf(name))}" alt="" loading="lazy">
            <span class="serif">${escapeHtml(regionOf(name))}</span>
            <input type="checkbox" data-admin="${type}" value="${escapeHtml(name)}" ${checked.includes(name) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        </label></li>`).join('')}</ul>`;
}

const statusTag = (text, cls) => `<span class="status ${cls}">${escapeHtml(text)}</span>`;

function renderAdmin() {
    const o = App.official;
    const s = o.current_step || 0;
    $('admin-step-label').textContent = [`En attente du Top ${SEMI()}`, `Top ${SEMI()} publié`, 'Top 5 publié', 'Miss France élue'][s];
    document.querySelectorAll('#admin-steps li').forEach(li => {
        const n = Number(li.dataset.step);
        li.className = n <= s ? 'done' : n === s + 1 ? 'current' : '';
    });

    // Ouverture aux joueurs
    const open = Boolean(o.app_open);
    $('admin-open').innerHTML = `
        ${statusTag(open ? 'Ouverte aux joueurs' : 'Fermée : couverture seule', open ? 'ok' : 'wait')}
        <h3>L'<em>ouverture</em></h3>
        <p class="hint">${open
            ? 'Les joueurs peuvent entrer avec leur pseudo et le code de soirée.'
            : "Les invités ne voient que la page de couverture (thème, règles, compte à rebours). Ouvre quand tu veux qu'ils puissent entrer et jouer."}</p>
        <button type="button" class="btn ${open ? 'btn-ghost' : 'btn-blue'} btn-block" id="admin-toggle-open">${open ? "Refermer l'appli" : "Ouvrir l'appli aux joueurs"}</button>`;
    $('admin-toggle-open').addEventListener('click', async () => {
        if (!confirm(open ? "Refermer l'appli ?\n\nLes joueurs ne pourront plus entrer tant que tu ne la rouvres pas. Rien n'est effacé." : "Ouvrir l'appli aux joueurs ?\n\nIls pourront entrer avec leur pseudo et le code de soirée.")) return;
        try {
            const data = await api('/api/admin/app-open', { method: 'POST', body: { open: !open } });
            toast(data.message, 'success');
            await refreshOfficial();
            renderAdmin();
        } catch (err) { toast(err.message, 'error'); }
    });

    renderAdminBlind().catch(() => {});
    renderAdminTeams().catch(() => {});

    const all = App.candidates.map(c => c.name);

    // Étape 1 : Top 15
    $('admin-step1').innerHTML = `
        ${statusTag(s >= 1 ? 'Publié' : 'À publier', s >= 1 ? 'ok' : 'wait')}
        <h3>Le <em>Top ${SEMI()}</em></h3>
        <p class="hint">Coche les ${SEMI()} qualifiées, puis publie : tous les téléphones affichent la révélation. Bonus automatique de 10 pts pour « la recalée ».</p>
        <p class="kicker" id="count-top15"></p>
        ${adminCheckList(all, 'top15', o.top15 || [], s >= 1)}
        <div class="admin-actions">
            ${s >= 1 ? '' : `<button type="button" class="btn btn-blue btn-block btn-between" data-act="top15"><span>Publier le Top ${SEMI()}</span>${ARROW}</button>`}
            ${s >= 1 ? `<button type="button" class="btn btn-ghost btn-block" data-reset="0">Annuler le Top ${SEMI()}</button>` : ''}
        </div>`;

    // Étape 2 : Top 5
    const pool5 = s >= 1 ? o.top15 : [];
    $('admin-step2').innerHTML = `
        ${statusTag(s >= 2 ? 'Publié' : s >= 1 ? 'À publier' : 'Bloqué', s >= 2 ? 'ok' : s >= 1 ? 'wait' : '')}
        <h3>Le <em>Top 5</em></h3>
        ${s < 1 ? `<p class="hint">Publie d'abord le Top ${SEMI()}.</p>` : `
            <p class="hint">Coche les 5 finalistes parmi les qualifiées. Bonus automatique de 20 pts pour « la déception ».</p>
            <p class="kicker" id="count-top5"></p>
            ${adminCheckList(pool5, 'top5', o.top5 || [], s >= 2)}
            <div class="admin-actions">
                ${s >= 2 ? '<button type="button" class="btn btn-ghost btn-block" data-reset="1">Annuler le Top 5</button>'
                    : `<button type="button" class="btn btn-blue btn-block btn-between" data-act="top5"><span>Publier le Top 5</span>${ARROW}</button>`}
            </div>`}`;

    // Étape 3 : podium
    const labels = [`Miss France ${App.edition.year}`, '1re dauphine', '2e dauphine', '3e dauphine', '4e dauphine'];
    $('admin-step3').innerHTML = `
        ${statusTag(s >= 3 ? 'Publié' : s >= 2 ? 'À publier' : 'Bloqué', s >= 3 ? 'ok' : s >= 2 ? 'wait' : '')}
        <h3>Le <em>podium</em></h3>
        ${s < 2 ? '<p class="hint">Publie d\'abord le Top 5.</p>' : `
            <p class="hint">Saisis le classement final : le Prono d'or (80 pts) est calculé à la publication.</p>
            <ol class="rank-list">${labels.map((label, i) => `
                <li class="rank-row"><span class="n">${i + 1}</span>
                    <div class="grow"><span class="lbl">${escapeHtml(label)}</span>
                    <select class="select" data-admin-rank="${i}" ${s >= 3 ? 'disabled' : ''}></select></div>
                </li>`).join('')}</ol>
            <div class="admin-actions" style="margin-top: 14px;">
                ${s >= 3 ? '<button type="button" class="btn btn-ghost btn-block" data-reset="2">Annuler le podium</button>'
                    : `<button type="button" class="btn btn-blue btn-block btn-between" data-act="final"><span>Couronner Miss France</span>${ARROW}</button>`}
            </div>`}`;
    $('admin-step3').querySelectorAll('select[data-admin-rank]').forEach(sel => {
        const i = Number(sel.dataset.adminRank);
        fillCandidateSelect(sel, o.top5 || [], 'Choisir');
        if (o.classement_final?.[i]) sel.value = o.classement_final[i];
    });
    updateAdminCounts();
}

function updateAdminCounts() {
    const c15 = document.querySelectorAll('input[data-admin="top15"]:checked').length;
    const c5 = document.querySelectorAll('input[data-admin="top5"]:checked').length;
    if ($('count-top15')) $('count-top15').textContent = `${c15} / ${SEMI()} cochées`;
    if ($('count-top5')) $('count-top5').textContent = `${c5} / 5 cochées`;
}

async function renderAdminGames() {
    const [cg, costume] = await Promise.all([api('/api/admin/culture-g-ranking'), api('/api/costume/results')]);
    const top = (rows, val, unit) => rows.slice(0, 3).map((r, i) => `<li><span>${i + 1}. ${escapeHtml(r.pseudo)}</span><strong>${val(r)} ${unit}</strong></li>`).join('')
        || '<li><span class="muted">Personne pour l\'instant</span></li>';
    $('admin-games').innerHTML = `
        <h3>Les <em>jeux</em></h3>
        <p class="hint">Les points du quiz, de la Culture G et du costume sont recalculés automatiquement à chaque réponse ou vote.</p>
        <p class="kicker">Culture G (bonnes réponses)</p>
        <ul class="rules">${top(cg.rankings, r => r.culture_g_correct || 0, '✓')}</ul>
        <p class="kicker" style="margin-top: 14px;">Costume (${costume.totalVotes} votes)</p>
        <ul class="rules">${top(costume.results.filter(r => Number(r.votes) > 0), r => r.votes, 'votes')}</ul>
        <button type="button" class="btn btn-ghost btn-block" style="margin-top: 14px;" id="admin-recompute">Recalculer les points des jeux</button>`;
}

async function loadAdmin() {
    if (!App.user?.isAdmin) return;
    await refreshOfficial();
    renderAdmin();
    const [stats] = await Promise.all([api('/api/admin/stats'), renderAdminGames()]);
    $('admin-users').textContent = stats.totalUsers;
    $('admin-pronos').textContent = stats.totalPronostics;
}
App.loaders.admin = loadAdmin;

async function afterAdminChange() {
    await loadAdmin();
    refreshScore().catch(() => {});
    if (window.Live) window.Live.check(true);
}

async function adminAct(act) {
    try {
        if (act === 'top15') {
            const top15 = [...document.querySelectorAll('input[data-admin="top15"]:checked')].map(i => i.value);
            if (top15.length !== SEMI()) return toast(`Coche exactement ${SEMI()} candidates (${top15.length} pour l'instant).`, 'error');
            if (!confirm(`Publier le Top ${SEMI()} ?\n\n${top15.map(regionOf).join(', ')}\n\nLes scores de tous les joueurs seront mis à jour et la révélation s'affichera sur leurs téléphones.`)) return;
            const data = await api('/api/admin/validate-top15', { method: 'POST', body: { top15 } });
            toast(data.message, 'success');
        } else if (act === 'top5') {
            const top5 = [...document.querySelectorAll('input[data-admin="top5"]:checked')].map(i => i.value);
            if (top5.length !== 5) return toast(`Coche exactement 5 candidates (${top5.length} pour l'instant).`, 'error');
            if (!confirm(`Publier le Top 5 ?\n\n${top5.map(regionOf).join(', ')}`)) return;
            const data = await api('/api/admin/validate-top5', { method: 'POST', body: { top5 } });
            toast(data.message, 'success');
        } else if (act === 'final') {
            const classementFinal = [...document.querySelectorAll('select[data-admin-rank]')].map(s => s.value);
            if (classementFinal.some(v => !v) || new Set(classementFinal).size !== 5) return toast('Remplis les 5 places avec 5 finalistes différentes.', 'error');
            if (!confirm(`Couronner ${classementFinal[0]} Miss France ${App.edition.year} ?\n\n2. ${classementFinal[1]}\n3. ${classementFinal[2]}\n4. ${classementFinal[3]}\n5. ${classementFinal[4]}`)) return;
            const data = await api('/api/admin/validate-final', { method: 'POST', body: { classementFinal } });
            toast(data.message, 'success');
        }
        await afterAdminChange();
    } catch (err) { toast(err.message, 'error'); }
}

async function adminReset(targetStep) {
    const what = [`le Top ${SEMI()} (retour au début)`, 'le Top 5', 'le podium'][targetStep];
    if (!confirm(`Annuler ${what} ? Les scores de tous les joueurs seront recalculés.`)) return;
    try {
        const data = await api('/api/admin/reset-step', { method: 'POST', body: { targetStep } });
        toast(data.message, 'success');
        await afterAdminChange();
    } catch (err) { toast(err.message, 'error'); }
}

async function loadAdminUsers() {
    Admin.users = await api('/api/admin/users');
    const box = $('admin-users-list');
    if (!Admin.users.length) { box.innerHTML = '<p class="empty">Aucun joueur.</p>'; return; }
    box.innerHTML = Admin.users.map(u => `
        <div class="user-row" data-user="${u.id}">
            ${u.costume_photo ? `<img src="${escapeHtml(u.costume_photo)}" alt="">` : ''}
            <span class="serif" data-name>${escapeHtml(u.pseudo)}${u.is_admin ? ' <span class="small muted">(admin)</span>' : ` <span class="small muted">· ${u.location === 'home' ? `sur place${teamInfo(u.team) ? ` · ${teamInfo(u.team).short}` : ''}` : u.location === 'away' ? 'à distance' : 'lieu non indiqué'}</span>`}</span>
            <span class="small">${u.total_score || 0} pts</span>
            ${u.is_admin ? '' : `
                <button type="button" class="icon-btn" data-user-act="rename">Renommer</button>
                <button type="button" class="icon-btn" data-user-act="where">${u.location === 'home' ? '→ À distance' : '→ Sur place'}</button>
                ${u.location === 'home' && (App.edition.teams || []).length > 1 ? '<button type="button" class="icon-btn" data-user-act="team">Changer d\'équipe</button>' : ''}
                ${u.costume_photo ? '<button type="button" class="icon-btn" data-user-act="photo">Photo ✕</button>' : ''}
                <button type="button" class="icon-btn danger" data-user-act="delete">Supprimer</button>`}
        </div>`).join('') + `<p class="hint" style="margin-top: 10px;">${Admin.users.length} compte(s).</p>`;
}

async function adminUserAct(id, act) {
    const user = Admin.users.find(u => u.id === id);
    if (!user) return;
    try {
        if (act === 'rename') {
            const pseudo = prompt(`Nouveau pseudo pour ${user.pseudo} :`, user.pseudo);
            if (!pseudo || pseudo.trim() === user.pseudo) return;
            const data = await api(`/api/admin/users/${id}`, { method: 'PUT', body: { pseudo: pseudo.trim() } });
            toast(data.message, 'success');
        } else if (act === 'team') {
            const teams = App.edition.teams || [];
            const other = teams[(teams.findIndex(t => t.key === user.team) + 1) % teams.length];
            const data = await api(`/api/admin/users/${id}/team`, { method: 'PUT', body: { team: other.key } });
            toast(data.message, 'success');
            renderAdminTeams().catch(() => {});
        } else if (act === 'where') {
            const data = await api(`/api/admin/users/${id}/location`, { method: 'PUT', body: { location: user.location === 'home' ? 'away' : 'home' } });
            toast(data.message, 'success');
        } else if (act === 'photo') {
            if (!confirm(`Supprimer la photo de costume de ${user.pseudo} ?`)) return;
            const data = await api(`/api/admin/users/${id}/photo`, { method: 'DELETE' });
            toast(data.message, 'success');
        } else if (act === 'delete') {
            if (!confirm(`Supprimer définitivement ${user.pseudo} et toutes ses données (scores, pronostics, votes, photo) ?`)) return;
            const data = await api(`/api/admin/users/${id}`, { method: 'DELETE' });
            toast(data.message, 'success');
        }
        await loadAdminUsers();
        loadAdmin().catch(() => {});
    } catch (err) { toast(err.message, 'error'); }
}

async function adminResetAll() {
    if (!confirm('Tout réinitialiser ?\n\nTous les joueurs (sauf les admins), scores, pronostics, réponses, photos et résultats officiels seront supprimés. Impossible de revenir en arrière.')) return;
    if (!confirm('Dernière confirmation : tout supprimer maintenant ?')) return;
    try {
        const data = await api('/api/admin/reset-all-data', { method: 'POST' });
        toast(data.message, 'success');
        $('admin-users-list').innerHTML = '';
        await afterAdminChange();
    } catch (err) { toast(err.message, 'error'); }
}

document.addEventListener('app:ready', () => {
    if (!App.user?.isAdmin) return;
    const section = $('admin');
    section.addEventListener('change', (e) => {
        const box = e.target.closest('input[data-admin]');
        if (!box) return;
        const max = box.dataset.admin === 'top15' ? SEMI() : 5;
        const checked = document.querySelectorAll(`input[data-admin="${box.dataset.admin}"]:checked`).length;
        if (checked > max) { box.checked = false; toast(`Maximum ${max} candidates.`, 'error'); }
        updateAdminCounts();
    });
    section.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (act) return adminAct(act.dataset.act);
        const reset = e.target.closest('[data-reset]');
        if (reset) return adminReset(Number(reset.dataset.reset));
        const userBtn = e.target.closest('[data-user-act]');
        if (userBtn) return adminUserAct(Number(userBtn.closest('[data-user]').dataset.user), userBtn.dataset.userAct);
        if (e.target.closest('#admin-recompute')) {
            Promise.all([
                api('/api/admin/validate-culture-g', { method: 'POST' }).catch(() => null),
                api('/api/admin/costume-awards', { method: 'POST' }).catch(() => null)
            ]).then(() => { toast('Points des jeux recalculés.', 'success'); afterAdminChange(); });
        }
    });
    $('admin-load-users').addEventListener('click', () => loadAdminUsers().catch(err => toast(err.message, 'error')));
    $('admin-reset-all').addEventListener('click', adminResetAll);
});


// ---------- Télécommande du blind test ----------

const BLIND_ASK_ADMIN = { title: 'on demande le titre', artist: 'on demande l\'artiste' };

async function renderAdminBlind(data) {
    const box = $('admin-blind');
    if (!box) return;
    const d = data || await api('/api/admin/blind');
    Admin.blind = d;
    if (!d.enabled) { box.innerHTML = ''; return; }
    const song = (x) => (x ? `<p class="blind-admin-song"><span class="serif">${escapeHtml(x.title)}</span><span>${escapeHtml(x.artist)} · ${BLIND_ASK_ADMIN[x.ask] || ''}</span><span class="small muted">Passage : ${escapeHtml(x.cue || '')}</span></p>` : '');
    const count = `<p class="kicker" id="admin-blind-count">${d.answered} réponse${d.answered > 1 ? 's' : ''} sur ${d.players} joueur${d.players > 1 ? 's' : ''}</p>`;
    const btn = (action, label, cls = 'btn-blue') => `<button type="button" class="btn ${cls} btn-block btn-between" data-blind-act="${action}"><span>${label}</span>${ARROW}</button>`;
    let status, body;
    if (d.phase === 'idle') {
        status = statusTag('Pas commencé', 'wait');
        body = `<p class="hint">Lance la première chanson sur ton enceinte, puis ouvre les réponses : les propositions s'affichent sur tous les téléphones.</p>
            <p class="kicker">À lancer en premier</p>${song(d.next)}${btn('next', 'Ouvrir les réponses · chanson 1')}`;
    } else if (d.phase === 'open') {
        status = statusTag(`Chanson ${d.index + 1}/${d.total} · réponses ouvertes`, 'wait');
        body = `<p class="kicker">En cours</p>${song(d.current)}${count}${btn('reveal', 'Révéler la réponse')}`;
    } else if (d.phase === 'revealed') {
        status = statusTag(`Chanson ${d.index + 1}/${d.total} · révélée`, 'ok');
        body = d.next
            ? `<p class="hint">Lance la chanson suivante sur ton enceinte, puis ouvre les réponses.</p><p class="kicker">À lancer maintenant</p>${song(d.next)}${btn('next', `Ouvrir les réponses · chanson ${d.index + 2}`)}`
            : `<p class="hint">Toutes les chansons sont passées. Dernière étape : chacun tente de deviner le thème caché (réponse attendue : « ${escapeHtml(d.theme.answer)} »).</p>${btn('next', 'Poser la question du thème')}`;
    } else if (d.phase === 'theme') {
        status = statusTag('Question finale : le thème', 'wait');
        body = `<p class="hint">« ${escapeHtml(d.theme.question)} » Réponse attendue : « ${escapeHtml(d.theme.answer)} ».</p>${count}${btn('reveal', 'Révéler le thème et le podium')}`;
    } else {
        status = statusTag('Terminé · points attribués', 'ok');
        body = '<p class="hint">Le podium est affiché sur les téléphones et les points sont ajoutés au classement général.</p>';
    }
    box.innerHTML = `${status}<h3>Le <em>blind test</em></h3>${body}
        <button type="button" class="btn-link" data-go="blind" style="margin-top: 12px; display: block;">Voir l'écran des joueurs</button>
        ${d.phase === 'idle' ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-blind-act="reset" style="margin-top: 12px;">Recommencer le blind test à zéro</button>'}`;
}

document.addEventListener('app:ready', () => {
    const box = $('admin-blind');
    if (!box) return;
    box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-blind-act]');
        if (!b || b.disabled) return;
        const action = b.dataset.blindAct;
        if (action === 'reset' && !confirm('Recommencer le blind test à zéro ?\n\nToutes les réponses et les points du blind test seront effacés.')) return;
        b.disabled = true;
        try {
            await renderAdminBlind(await api('/api/admin/blind', { method: 'POST', body: { action } }));
        } catch (err) {
            toast(err.message, 'error');
            renderAdminBlind().catch(() => {});
        }
    });
    // Compteur de réponses en direct pendant qu'une question est ouverte
    setInterval(() => {
        if (App.current !== 'admin' || document.visibilityState !== 'visible' || !Admin.blind) return;
        if (Admin.blind.phase !== 'open' && Admin.blind.phase !== 'theme') return;
        api('/api/admin/blind').then(d => {
            if (d.phase !== Admin.blind.phase || d.index !== Admin.blind.index) return renderAdminBlind(d);
            Admin.blind = d;
            const el = $('admin-blind-count');
            if (el) el.textContent = `${d.answered} réponse${d.answered > 1 ? 's' : ''} sur ${d.players} joueur${d.players > 1 ? 's' : ''}`;
        }).catch(() => {});
    }, 3000);
});


// ---------- Équipes : effectifs et épreuves collectives ----------

async function renderAdminTeams(data) {
    const box = $('admin-teams');
    if (!box) return;
    const teams = (data || await api('/api/teams')).teams || [];
    if (!teams.length) { box.innerHTML = ''; return; }
    const events = teams.flatMap(t => t.events.map(e => ({ ...e, team: t }))).sort((a, b) => a.id - b.id);
    box.innerHTML = `
        <h3>Les <em>équipes</em></h3>
        <p class="hint">Les joueurs sur place sont répartis au hasard, à effectifs égaux. Score d'équipe = moyenne des points des joueurs + épreuves ci-dessous.</p>
        <ul class="rules">${teams.map(t => `<li><span>${escapeHtml(t.name)} · ${t.size} joueur${t.size > 1 ? 's' : ''}</span><strong>${t.total} pts</strong></li>`).join('')}</ul>
        <p class="kicker" style="margin-top: 14px;">Ajouter une épreuve d'équipe</p>
        <form id="admin-team-form" class="team-form">
            <input type="text" class="input" id="team-event-label" maxlength="60" placeholder="Nom de l'épreuve (ex. Karaoké)" autocomplete="off">
            <div class="team-form-row">
                <select class="input" id="team-event-team" aria-label="Équipe gagnante">${teams.map(t => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.short || t.name)}</option>`).join('')}</select>
                <input type="number" class="input" id="team-event-points" value="10" step="1" aria-label="Points">
                <button type="submit" class="btn btn-blue">Ajouter</button>
            </div>
        </form>
        ${events.length ? `<ul class="rules" style="margin-top: 12px;">${events.map(e => `
            <li><span>${escapeHtml(e.label)} · ${escapeHtml(e.team.short || e.team.name)} · ${e.points > 0 ? '+' : ''}${e.points}</span><button type="button" class="icon-btn danger" data-team-event="${e.id}">Supprimer</button></li>`).join('')}</ul>` : ''}`;
}

document.addEventListener('app:ready', () => {
    const box = $('admin-teams');
    if (!box) return;
    box.addEventListener('submit', async (e) => {
        if (e.target.id !== 'admin-team-form') return;
        e.preventDefault();
        try {
            const data = await api('/api/admin/team-events', { method: 'POST', body: {
                label: $('team-event-label').value, team: $('team-event-team').value, points: Number($('team-event-points').value)
            } });
            toast(data.message, 'success');
            renderAdminTeams(data);
        } catch (err) { toast(err.message, 'error'); }
    });
    box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-team-event]');
        if (!b || !confirm('Supprimer cette épreuve et ses points ?')) return;
        try {
            const data = await api(`/api/admin/team-events/${b.dataset.teamEvent}`, { method: 'DELETE' });
            toast(data.message, 'success');
            renderAdminTeams(data);
        } catch (err) { toast(err.message, 'error'); }
    });
});
