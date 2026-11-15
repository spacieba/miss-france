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
    $('admin-step-label').textContent = ['En attente du Top 15', 'Top 15 publié', 'Top 5 publié', 'Miss France élue'][s];
    document.querySelectorAll('#admin-steps li').forEach(li => {
        const n = Number(li.dataset.step);
        li.className = n <= s ? 'done' : n === s + 1 ? 'current' : '';
    });

    const all = App.candidates.map(c => c.name);

    // Étape 1 : Top 15
    $('admin-step1').innerHTML = `
        ${statusTag(s >= 1 ? 'Publié' : 'À publier', s >= 1 ? 'ok' : 'wait')}
        <h3>Le <em>Top 15</em></h3>
        <p class="hint">Coche les 15 qualifiées, puis publie : tous les téléphones affichent la révélation. Bonus automatique de 10 pts pour « la recalée ».</p>
        <p class="kicker" id="count-top15"></p>
        ${adminCheckList(all, 'top15', o.top15 || [], s >= 1)}
        <div class="admin-actions">
            ${s >= 1 ? '' : `<button type="button" class="btn btn-blue btn-block btn-between" data-act="top15"><span>Publier le Top 15</span>${ARROW}</button>`}
            ${s >= 1 ? '<button type="button" class="btn btn-ghost btn-block" data-reset="0">Annuler le Top 15</button>' : ''}
        </div>`;

    // Étape 2 : Top 5
    const pool5 = s >= 1 ? o.top15 : [];
    $('admin-step2').innerHTML = `
        ${statusTag(s >= 2 ? 'Publié' : s >= 1 ? 'À publier' : 'Bloqué', s >= 2 ? 'ok' : s >= 1 ? 'wait' : '')}
        <h3>Le <em>Top 5</em></h3>
        ${s < 1 ? '<p class="hint">Publie d\'abord le Top 15.</p>' : `
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
    if ($('count-top15')) $('count-top15').textContent = `${c15} / 15 cochées`;
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
            if (top15.length !== 15) return toast(`Coche exactement 15 candidates (${top15.length} pour l'instant).`, 'error');
            if (!confirm(`Publier le Top 15 ?\n\n${top15.map(regionOf).join(', ')}\n\nLes scores de tous les joueurs seront mis à jour et la révélation s'affichera sur leurs téléphones.`)) return;
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
    const what = ['le Top 15 (retour au début)', 'le Top 5', 'le podium'][targetStep];
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
            <span class="serif" data-name>${escapeHtml(u.pseudo)}${u.is_admin ? ' <span class="small muted">(admin)</span>' : ''}</span>
            <span class="small">${u.total_score || 0} pts</span>
            ${u.is_admin ? '' : `
                <button type="button" class="icon-btn" data-user-act="rename">Renommer</button>
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
        const max = box.dataset.admin === 'top15' ? 15 : 5;
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
