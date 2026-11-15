/* ============================================================
   Concours du meilleur costume : ma photo, la galerie, le vote
   ============================================================ */

const Costume = { looks: [], myVote: null };

// Réduit la photo dans le navigateur avant l'envoi (l'hébergement limite les envois à 4,5 Mo)
async function shrinkImage(file) {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        return blob || file;
    } catch {
        return file; // format non lisible par le navigateur (ex. HEIC) : envoi tel quel
    }
}

async function loadMyLook() {
    const data = await api('/api/costume/my-photo');
    const thumb = $('my-look-thumb');
    if (data.photo) {
        thumb.innerHTML = `<img src="${escapeHtml(data.photo)}" alt="Mon look">`;
        $('costume-pick').textContent = 'Changer de photo';
        $('costume-public').hidden = false;
        $('costume-delete').hidden = false;
        $('costume-public').textContent = data.isPublic ? 'Retirer de la galerie' : 'Ajouter à la galerie';
        $('costume-status').textContent = data.isPublic ? 'Ton look est visible dans la galerie.' : 'Ta photo est privée : ajoute-la à la galerie pour concourir.';
        $('costume-status').classList.toggle('on', data.isPublic);
    } else {
        thumb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
        $('costume-pick').textContent = 'Poster mon look';
        $('costume-public').hidden = true;
        $('costume-delete').hidden = true;
        $('costume-status').textContent = "Ta photo reste privée tant que tu ne l'ajoutes pas à la galerie.";
        $('costume-status').classList.remove('on');
    }
}

async function loadLooks() {
    const [players, results, myVote] = await Promise.all([
        api('/api/costume/players'),
        api('/api/costume/results'),
        api('/api/costume/my-vote')
    ]);
    Costume.myVote = myVote;
    const photos = new Map(players.map(p => [p.id, p.costume_photo]));
    Costume.looks = results.results.map(r => ({ id: r.id, pseudo: r.pseudo, votes: Number(r.votes), photo: photos.get(r.id) || null }))
        .sort((a, b) => (b.photo ? 1 : 0) - (a.photo ? 1 : 0) || b.votes - a.votes || a.pseudo.localeCompare(b.pseudo));
    $('vote-hint').textContent = myVote
        ? `Ton vote : ${myVote.voted_for_pseudo}. Tu peux le changer à tout moment.`
        : "Touche un look pour l'agrandir et voter. Un seul vote, modifiable.";
    if (!Costume.looks.length) {
        $('looks').innerHTML = '<p class="empty" style="grid-column: 1 / -1;">Aucun joueur pour le moment.</p>';
        return;
    }
    $('looks').innerHTML = Costume.looks.map(l => {
        const voted = myVote && myVote.voted_for === l.id;
        const me = l.id === App.user.id;
        return `
            <button type="button" class="look ${voted ? 'voted' : ''}" data-id="${l.id}" aria-label="Look de ${escapeHtml(l.pseudo)}">
                <span class="ph">
                    ${l.photo ? `<img src="${escapeHtml(l.photo)}" alt="" loading="lazy">` : `<span class="initial">${escapeHtml(l.pseudo.charAt(0).toUpperCase())}</span>`}
                    ${voted ? '<span class="tag">Mon vote</span>' : me ? '<span class="tag" style="background: var(--ink);">Moi</span>' : ''}
                </span>
                <span class="cap"><span class="serif">${escapeHtml(l.pseudo)}</span><small>${l.votes} vote${l.votes > 1 ? 's' : ''}</small></span>
            </button>`;
    }).join('');
}

async function loadCostume() {
    await Promise.all([loadMyLook(), loadLooks()]);
}
App.loaders.costume = loadCostume;

function openLook(id) {
    const look = Costume.looks.find(l => l.id === id);
    if (!look) return;
    const me = id === App.user.id;
    const voted = Costume.myVote && Costume.myVote.voted_for === id;
    const { el, close } = openModal(`
        ${modalTop('Street style')}
        <div class="gallery-stage" style="display: flex; align-items: center; justify-content: center;">
            ${look.photo ? `<img src="${escapeHtml(look.photo)}" alt="Look de ${escapeHtml(look.pseudo)}">` : `<span class="serif" style="font-size: 120px; color: var(--ink-3);">${escapeHtml(look.pseudo.charAt(0).toUpperCase())}</span>`}
        </div>
        <div class="gallery-head">
            <span class="serif">${escapeHtml(look.pseudo)}</span>
            <span class="gallery-counter">${look.votes}<small> vote${look.votes > 1 ? 's' : ''}</small></span>
        </div>
        <button type="button" class="btn btn-blue btn-block btn-between" data-vote ${me || voted ? 'disabled' : ''}>
            <span>${me ? "C'est toi !" : voted ? 'Tu as voté pour ce look ✓' : `Voter pour ${escapeHtml(look.pseudo)}`}</span>${ARROW}
        </button>
    `);
    el.querySelector('[data-vote]').addEventListener('click', async () => {
        try {
            const data = await api('/api/costume/vote', { method: 'POST', body: { votedForId: id } });
            if (window.MFX) window.MFX.good();
            toast(data.message, 'success');
            close();
            await loadLooks();
            refreshScore().catch(() => {});
        } catch (err) { toast(err.message, 'error'); }
    });
}

document.addEventListener('app:ready', () => {
    $('costume-pick').addEventListener('click', () => $('costume-input').click());
    $('costume-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast('Choisis une image.', 'error');
        if (file.size > 25 * 1024 * 1024) return toast('Photo trop lourde (25 Mo maximum).', 'error');
        $('costume-pick').disabled = true;
        $('costume-pick').textContent = 'Envoi…';
        try {
            const blob = await shrinkImage(file);
            if (blob.size > 4 * 1024 * 1024) throw new Error('Photo trop lourde, essaie avec une autre.');
            const form = new FormData();
            form.append('photo', blob, 'photo.jpg');
            const data = await api('/api/costume/upload-photo', { method: 'POST', body: form });
            toast(data.message, 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            $('costume-pick').disabled = false;
            loadCostume().catch(() => {});
        }
    });
    $('costume-public').addEventListener('click', async () => {
        try {
            const data = await api('/api/costume/toggle-public', { method: 'POST' });
            toast(data.message, 'success');
            loadCostume().catch(() => {});
        } catch (err) { toast(err.message, 'error'); }
    });
    $('costume-delete').addEventListener('click', async () => {
        if (!confirm('Supprimer ta photo de costume ?')) return;
        try {
            await api('/api/costume/delete-photo', { method: 'DELETE' });
            toast('Photo supprimée.');
            loadCostume().catch(() => {});
        } catch (err) { toast(err.message, 'error'); }
    });
    $('looks').addEventListener('click', (e) => {
        const b = e.target.closest('.look');
        if (b) openLook(Number(b.dataset.id));
    });
});
