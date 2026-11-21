/* ============================================================
   Les candidates : trombinoscope, photos et courte biographie
   (contenu : champs age / city / job / bio de editions/<année>.js)
   ============================================================ */

// « 21 ans · Strasbourg (Bas-Rhin) · Étudiante en droit »
function candidateFacts(c) {
    return [c.age ? `${c.age} ans` : '', c.city || '', c.job || ''].filter(Boolean);
}

function candidateBioHtml(c) {
    const facts = candidateFacts(c);
    if (!facts.length && !c.bio) return '';
    return `
        <div class="cand-bio">
            ${facts.length ? `<p class="cand-facts">${facts.map(escapeHtml).join('<span aria-hidden="true"> · </span>')}</p>` : ''}
            ${c.bio ? `<p class="cand-bio-text">${escapeHtml(c.bio)}</p>` : ''}
        </div>`;
}

function loadCandidates() {
    const list = App.candidates || [];
    $('candidates-count').textContent = list.length;
    $('candidates-grid').innerHTML = list.map(c => {
        const sub = [c.person, c.age ? `${c.age} ans` : ''].filter(Boolean).join(' · ');
        return `
        <div class="cand-card" data-name="${escapeHtml(c.name)}">
            <img class="cand-photo" src="${escapeHtml(c.photo)}" alt="" loading="lazy">
            <button type="button" class="cand-hit" aria-label="Portrait de ${escapeHtml(c.name)}${c.person ? `, ${escapeHtml(c.person)}` : ''}"></button>
            <span class="cand-cap"><span class="cand-region">${escapeHtml(regionOf(c.name))}</span><span class="cand-person">${escapeHtml(sub)}</span></span>
        </div>`;
    }).join('');
}
App.loaders.candidates = loadCandidates;

document.addEventListener('DOMContentLoaded', () => {
    $('candidates-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.cand-card');
        if (card) openCandidateGallery(card.dataset.name);
    });
});
