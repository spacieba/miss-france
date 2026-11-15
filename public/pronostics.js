/* ============================================================
   Pronostics : Top 15, Top 5, podium — enregistrement automatique
   ============================================================ */

const Prono = {
    panel: 'p-top15',
    top15: [], bonus15: '', or: '',
    top5: [], bonus5: '',
    final: ['', '', '', '', ''],
    timers: {},
    status: {}
};

const ZOOM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="14" height="14"/><path d="M7 3h14v14"/></svg>';
const RANK_LABELS = () => [`Miss France ${App.edition.year}`, '1re dauphine', '2e dauphine', '3e dauphine', '4e dauphine'];

const step = () => App.official.current_step || 0;
const lockedPanel = (panel) => ({ 'p-top15': step() >= 1, 'p-top5': step() >= 2, 'p-final': step() >= 3 }[panel]);

function candidatesForTop5() {
    return step() >= 1 && App.official.top15.length ? App.official.top15 : App.candidates.map(c => c.name);
}
function candidatesForFinal() {
    return step() >= 2 && App.official.top5.length ? App.official.top5 : App.candidates.map(c => c.name);
}

// ---------- Cartes ----------

function candCard(name, { selected, order, locked, verdict, verdictClass }) {
    const c = candByName(name) || { name, photo: PLACEHOLDER, photos: [] };
    const nPhotos = (c.photos || []).length;
    const classes = ['cand-card'];
    if (selected) classes.push('selected');
    if (locked) classes.push('locked');
    if (verdictClass) classes.push(verdictClass);
    return `
        <div class="${classes.join(' ')}" data-name="${escapeHtml(name)}">
            <img class="cand-photo" src="${escapeHtml(c.photo)}" alt="" loading="lazy">
            <button type="button" class="cand-hit" aria-pressed="${selected ? 'true' : 'false'}" ${locked ? 'disabled' : ''}
                aria-label="${escapeHtml(name)}${c.person ? `, ${escapeHtml(c.person)}` : ''}${selected ? ' (sélectionnée)' : ''}"></button>
            ${nPhotos > 1 ? `<button type="button" class="cand-zoom" data-zoom="${escapeHtml(name)}" aria-label="Voir les ${nPhotos} photos de ${escapeHtml(name)}">${ZOOM_ICON}${nPhotos}</button>` : ''}
            ${verdict ? `<span class="verdict">${escapeHtml(verdict)}</span>` : `<span class="cand-num" aria-hidden="true">${order || ''}</span>`}
            <span class="cand-cap"><span class="cand-region">${escapeHtml(regionOf(name))}</span><span class="cand-person">${escapeHtml(c.person || '')}</span></span>
        </div>`;
}

function renderGrid(gridId, names, list, officialList, isLocked) {
    $(gridId).innerHTML = names.map(name => {
        const selected = list.includes(name);
        let verdict = '', verdictClass = '';
        if (isLocked) {
            const qualified = officialList.includes(name);
            if (selected && qualified) { verdict = '✓ Bien vu'; verdictClass = 'result-ok'; }
            else if (selected) { verdict = 'Raté'; verdictClass = 'result-ko'; }
            else if (qualified) { verdictClass = 'official'; }
        }
        return candCard(name, { selected, order: list.indexOf(name) + 1, locked: isLocked, verdict, verdictClass });
    }).join('');
}

function syncSelectPhoto(selectId, imgId) {
    const v = $(selectId).value;
    $(imgId).src = v ? photoOf(v) : PLACEHOLDER;
}

// ---------- Rendu des panneaux ----------

function renderTop15() {
    const locked = lockedPanel('p-top15');
    renderGrid('top15-grid', App.candidates.map(c => c.name), Prono.top15, App.official.top15, locked);
    $('top15-banner').innerHTML = locked
        ? `<div class="banner success"><span>Le Top 15 officiel est tombé : tu en avais trouvé <strong>${Prono.top15.filter(n => App.official.top15.includes(n)).length}</strong> sur ${Prono.top15.length || 15}. Les qualifiées sont en couleur.</span></div>`
        : '';
    const all = App.candidates.map(c => c.name);
    fillCandidateSelect($('prono-or'), all, 'Choisir ma future Miss France');
    fillCandidateSelect($('bonus-top15'), all, 'Choisir une candidate');
    $('prono-or').value = Prono.or;
    $('bonus-top15').value = Prono.bonus15;
    $('prono-or').disabled = locked;
    $('bonus-top15').disabled = locked;
    syncSelectPhoto('prono-or', 'or-photo');
    syncSelectPhoto('bonus-top15', 'bonus15-photo');
}

function renderTop5() {
    const locked = lockedPanel('p-top5');
    const names = candidatesForTop5();
    Prono.top5 = Prono.top5.filter(n => names.includes(n));
    renderGrid('top5-grid', names, Prono.top5, App.official.top5, locked);
    let banner = '';
    if (locked) {
        banner = `<div class="banner success"><span>Le Top 5 officiel est tombé : <strong>${Prono.top5.filter(n => App.official.top5.includes(n)).length}</strong> finaliste(s) trouvée(s).</span></div>`;
    } else if (step() >= 1) {
        banner = '<div class="banner blue"><span>Le Top 15 est connu : choisis tes 5 finalistes parmi les qualifiées.</span></div>';
    }
    $('top5-banner').innerHTML = banner;
    fillCandidateSelect($('bonus-top5'), names, 'Choisir une candidate');
    $('bonus-top5').value = names.includes(Prono.bonus5) ? Prono.bonus5 : '';
    $('bonus-top5').disabled = locked;
    syncSelectPhoto('bonus-top5', 'bonus5-photo');
}

function renderFinal() {
    const locked = lockedPanel('p-final');
    const names = candidatesForFinal();
    const labels = RANK_LABELS();
    $('final-list').innerHTML = labels.map((label, i) => {
        const pick = names.includes(Prono.final[i]) ? Prono.final[i] : '';
        let verdict = '';
        if (locked) verdict = pick && App.official.classement_final[i] === pick ? ' ✓' : (pick ? ' ✗' : '');
        return `
            <li class="rank-row">
                <span class="n">${i + 1}</span>
                ${pick ? `<img src="${escapeHtml(photoOf(pick))}" alt="">` : '<span class="pick-empty"></span>'}
                <div class="grow">
                    <span class="lbl">${escapeHtml(label)}${verdict}</span>
                    <select class="select" data-rank="${i}" aria-label="${escapeHtml(label)}" ${locked ? 'disabled' : ''}></select>
                </div>
            </li>`;
    }).join('');
    $('final-list').querySelectorAll('select').forEach(sel => {
        const i = Number(sel.dataset.rank);
        fillCandidateSelect(sel, names, 'Choisir');
        sel.value = names.includes(Prono.final[i]) ? Prono.final[i] : '';
    });
    let banner = '';
    if (locked) {
        const ok = Prono.final.filter((n, i) => n && App.official.classement_final[i] === n).length;
        banner = `<div class="banner success"><span>Le classement officiel est connu : <strong>${ok}</strong> place(s) exacte(s).</span></div>`;
    } else if (step() >= 2) {
        banner = '<div class="banner blue"><span>Le Top 5 est connu : classe les 5 finalistes.</span></div>';
    }
    $('final-banner').innerHTML = banner;
}

// ---------- En-tête et barre du bas ----------

function updateHeader() {
    const panel = Prono.panel;
    const titles = { 'p-top15': '15', 'p-top5': '5', 'p-final': '' };
    $('pronos-title').innerHTML = panel === 'p-final' ? 'Le <em>podium</em>' : `Top <em>${titles[panel]}</em>`;
    let n, max;
    if (panel === 'p-top15') { n = Prono.top15.length; max = 15; }
    else if (panel === 'p-top5') { n = Prono.top5.length; max = 5; }
    else { n = Prono.final.filter(Boolean).length; max = 5; }
    $('prono-count').innerHTML = `${String(n).padStart(2, '0')}<small>sur ${max}</small>`;
    $('done-top15').textContent = Prono.top15.length === 15 ? '✓' : '';
    $('done-top5').textContent = Prono.top5.length === 5 ? '✓' : '';
    $('done-final').textContent = Prono.final.every(Boolean) ? '✓' : '';

    const bar = $('prono-bar');
    const locked = lockedPanel(panel);
    bar.hidden = App.current !== 'pronostics' || locked;
    $('bar-count').innerHTML = `${n}<small>/${max}</small>`;
    const st = Prono.status[panel];
    const label = st === 'saving' ? 'Enregistrement…'
        : st === 'saved' ? (n === max ? 'Enregistré ✓' : `Enregistré · encore ${max - n}`)
        : st === 'error' ? 'Réessayer'
        : (n === max ? 'Enregistrer' : `Encore ${max - n} à choisir`);
    $('bar-label').textContent = label;
}

// ---------- Enregistrement (automatique, avec délai) ----------

async function savePanel(panel) {
    if (lockedPanel(panel)) return;
    Prono.status[panel] = 'saving';
    updateHeader();
    try {
        if (panel === 'p-top15') {
            await api('/api/pronostics/top15', { method: 'POST', body: { top15: Prono.top15, bonusTop15: Prono.bonus15 || null, pronoOr: Prono.or || null } });
        } else if (panel === 'p-top5') {
            await api('/api/pronostics/top5', { method: 'POST', body: { top5: Prono.top5, bonusTop5: Prono.bonus5 || null } });
        } else {
            const filled = Prono.final.filter(Boolean);
            if (filled.length < 5 || new Set(filled).size < 5) {
                Prono.status[panel] = '';
                updateHeader();
                if (filled.length === 5) toast('Chaque finaliste ne peut apparaître qu\'une fois.', 'error');
                return;
            }
            await api('/api/pronostics/final', { method: 'POST', body: { classementFinal: Prono.final } });
        }
        Prono.status[panel] = 'saved';
    } catch (err) {
        Prono.status[panel] = 'error';
        toast(err.message, 'error');
        if (/verrouill|validé/i.test(err.message)) loadPronostics();
    }
    updateHeader();
}

function scheduleSave(panel, delay = 700) {
    clearTimeout(Prono.timers[panel]);
    Prono.status[panel] = '';
    updateHeader();
    Prono.timers[panel] = setTimeout(() => savePanel(panel), delay);
}

// ---------- Interactions ----------

function toggleIn(listKey, name, max, panel) {
    const list = Prono[listKey];
    const i = list.indexOf(name);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= max) { toast(`Tu as déjà ${max} candidates : retires-en une d'abord.`); return false; }
    else list.push(name);
    if (window.MFX) window.MFX.tap();
    scheduleSave(panel);
    return true;
}

function refreshCard(gridId, listKey, name) {
    const list = Prono[listKey];
    const grid = $(gridId);
    grid.querySelectorAll('.cand-card').forEach(card => {
        const n = card.dataset.name;
        const selected = list.includes(n);
        card.classList.toggle('selected', selected);
        const hit = card.querySelector('.cand-hit');
        hit.setAttribute('aria-pressed', String(selected));
        const num = card.querySelector('.cand-num');
        if (num) num.textContent = selected ? list.indexOf(n) + 1 : '';
    });
    updateHeader();
}

function bindGrid(gridId, listKey, max, panel) {
    $(gridId).addEventListener('click', (e) => {
        const zoom = e.target.closest('[data-zoom]');
        if (zoom) {
            const name = zoom.dataset.zoom;
            const locked = lockedPanel(panel);
            openCandidateGallery(name, {
                action: {
                    disabled: locked,
                    isSelected: () => Prono[listKey].includes(name),
                    label: (sel) => locked ? (sel ? 'Dans ma sélection' : 'Sélection verrouillée') : (sel ? `Retirer de mon ${panel === 'p-top15' ? 'Top 15' : 'Top 5'}` : `Ajouter à mon ${panel === 'p-top15' ? 'Top 15' : 'Top 5'}`),
                    toggle: () => { if (toggleIn(listKey, name, max, panel)) refreshCard(gridId, listKey, name); }
                }
            });
            return;
        }
        const hit = e.target.closest('.cand-hit');
        if (!hit || hit.disabled) return;
        const name = hit.closest('.cand-card').dataset.name;
        if (toggleIn(listKey, name, max, panel)) refreshCard(gridId, listKey, name);
    });
}

function showPanel(panel) {
    Prono.panel = panel;
    document.querySelectorAll('#pronostics .seg-btn').forEach(b => {
        const on = b.dataset.panel === panel;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('#pronostics .panel').forEach(p => p.classList.toggle('active', p.id === panel));
    updateHeader();
}

// ---------- Chargement ----------

async function loadPronostics() {
    const [pronos] = await Promise.all([api('/api/pronostics'), refreshOfficial()]);
    App.pronos = pronos;
    Prono.top15 = [...(pronos?.top15 || [])];
    Prono.bonus15 = pronos?.bonus_top15 || '';
    Prono.or = pronos?.prono_or || '';
    Prono.top5 = [...(pronos?.top5 || [])];
    Prono.bonus5 = pronos?.bonus_top5 || '';
    const f = pronos?.classement_final || [];
    Prono.final = [0, 1, 2, 3, 4].map(i => f[i] || '');
    Prono.status = {};
    renderTop15();
    renderTop5();
    renderFinal();
    // Ouvre directement l'étape en cours
    const s = step();
    if (!Prono.opened) {
        Prono.opened = true;
        showPanel(s >= 2 ? 'p-final' : s >= 1 ? 'p-top5' : 'p-top15');
    } else {
        showPanel(Prono.panel);
    }
}
App.loaders.pronostics = loadPronostics;

document.addEventListener('app:ready', () => {
    bindGrid('top15-grid', 'top15', 15, 'p-top15');
    bindGrid('top5-grid', 'top5', 5, 'p-top5');
    document.querySelectorAll('#pronostics .seg-btn').forEach(b => b.addEventListener('click', () => { showPanel(b.dataset.panel); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
    $('prono-or').addEventListener('change', (e) => {
        Prono.or = e.target.value; syncSelectPhoto('prono-or', 'or-photo'); scheduleSave('p-top15', 200);
    });
    $('bonus-top15').addEventListener('change', (e) => {
        Prono.bonus15 = e.target.value; syncSelectPhoto('bonus-top15', 'bonus15-photo'); scheduleSave('p-top15', 200);
    });
    $('bonus-top5').addEventListener('change', (e) => {
        Prono.bonus5 = e.target.value; syncSelectPhoto('bonus-top5', 'bonus5-photo'); scheduleSave('p-top5', 200);
    });
    $('final-list').addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-rank]');
        if (!sel) return;
        Prono.final[Number(sel.dataset.rank)] = sel.value;
        renderFinal();
        updateHeader();
        scheduleSave('p-final', 300);
    });
    $('bar-save').addEventListener('click', () => {
        clearTimeout(Prono.timers[Prono.panel]);
        savePanel(Prono.panel);
    });
});
