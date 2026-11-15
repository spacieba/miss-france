/* ============================================================
   « Ma couverture » : une de magazine personnalisée, générée
   dans le navigateur (canvas) puis partagée ou enregistrée
   ============================================================ */

const COVER_W = 1080;
const COVER_H = 1350;

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Dessine l'image en mode « cover », cadrée vers le haut (visages)
function drawCover(ctx, img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (w - dw) / 2;
    const dy = Math.min(0, (h - dh) * 0.12);
    ctx.drawImage(img, dx, dy, dw, dh);
}

function fitText(ctx, text, font, maxSize, maxWidth) {
    let size = maxSize;
    do {
        ctx.font = font.replace('{s}', size);
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 4;
    } while (size > 40);
    return size;
}

function wrapLines(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
        else line = test;
    });
    if (line) lines.push(line);
    return lines;
}

async function renderCoverCanvas(canvas, opts) {
    const ctx = canvas.getContext('2d');
    canvas.width = COVER_W;
    canvas.height = COVER_H;
    await Promise.all([
        document.fonts.load('400 100px "Instrument Serif"'),
        document.fonts.load('italic 400 100px "Instrument Serif"'),
        document.fonts.load('700 26px Inter'),
        document.fonts.load('600 26px Inter')
    ]).catch(() => {});

    // Fond
    ctx.fillStyle = '#F7F2EE';
    ctx.fillRect(0, 0, COVER_W, COVER_H);
    try {
        const img = await loadImage(opts.photo);
        drawCover(ctx, img, COVER_W, COVER_H);
    } catch { /* fond uni */ }

    // Voile en haut pour le titre, fondu nacré en bas pour le texte
    let g = ctx.createLinearGradient(0, 0, 0, 520);
    g.addColorStop(0, 'rgba(20,18,26,0.38)');
    g.addColorStop(1, 'rgba(20,18,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, COVER_W, 520);
    g = ctx.createLinearGradient(0, 860, 0, 1120);
    g.addColorStop(0, 'rgba(247,242,238,0)');
    g.addColorStop(1, 'rgba(247,242,238,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 860, COVER_W, 490);

    // Bandeau du haut
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 26px Inter';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.textAlign = 'left';
    ctx.fillText('ÉDITION SPÉCIALE', 48, 70);
    ctx.textAlign = 'right';
    ctx.fillText(opts.dateLabel.toUpperCase(), COVER_W - 48, 70);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // Titre du magazine
    ctx.textAlign = 'left';
    ctx.font = '400 270px "Instrument Serif"';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 30;
    ctx.fillText('Miss', 34, 300);
    ctx.fillText('France', 34, 528);
    ctx.shadowBlur = 0;

    // Accroche à droite
    ctx.textAlign = 'right';
    ctx.font = 'italic 400 60px "Instrument Serif"';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    const hook = opts.hook;
    wrapLines(ctx, hook, 470).forEach((line, i) => ctx.fillText(line, COVER_W - 48, 700 + i * 62));
    ctx.shadowBlur = 0;

    // Pseudo en très grand
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1F3FBF';
    const size = fitText(ctx, opts.pseudo, 'italic 400 {s}px "Instrument Serif"', 200, COVER_W - 96);
    ctx.font = `italic 400 ${size}px "Instrument Serif"`;
    ctx.fillText(opts.pseudo, 44, 1170);

    // Bandeau bleu + score
    ctx.font = '700 26px Inter';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    const band = 'MEMBRE DU JURY · COMITÉ PARALLÈLE';
    const bw = ctx.measureText(band).width + 44;
    ctx.fillStyle = '#1F3FBF';
    ctx.fillRect(48, 1196, bw, 56);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(band, 70, 1234);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.textAlign = 'right';
    ctx.fillStyle = '#14121A';
    ctx.font = '400 60px "Instrument Serif"';
    ctx.fillText(opts.scoreLine, COVER_W - 48, 1246);

    // Pied de page
    ctx.textAlign = 'left';
    ctx.font = '500 24px Inter';
    ctx.fillStyle = '#4A4550';
    ctx.fillText(`Miss France ${opts.year} · le jeu du comité`, 48, 1310);
}

async function buildCoverStudio() {
    const [pronos, myPhoto] = await Promise.all([
        api('/api/pronostics').catch(() => null),
        api('/api/costume/my-photo').catch(() => ({}))
    ]);
    const { rank, total } = await refreshScore().catch(() => ({ rank: null, total: 0 }));
    const or = pronos?.prono_or;
    const sources = [];
    if (or) sources.push({ key: 'or', label: 'Ma favorite', photo: photoOf(or) });
    if (myPhoto.photo) sources.push({ key: 'look', label: 'Mon look', photo: myPhoto.photo });
    if (!sources.length) {
        const c = App.candidates[0];
        sources.push({ key: 'or', label: 'Couverture', photo: c ? c.photo : PLACEHOLDER });
    }
    let current = sources[0];

    const { el } = openModal(`
        ${modalTop('Ma couverture')}
        <div class="cover-preview"><canvas aria-label="Aperçu de ta couverture"></canvas></div>
        ${sources.length > 1 ? `<div class="seg" role="tablist" aria-label="Photo de couverture">${sources.map((s, i) => `<button type="button" class="seg-btn ${i === 0 ? 'active' : ''}" data-src="${s.key}">${escapeHtml(s.label)}</button>`).join('')}</div>` : ''}
        ${!or ? '<p class="hint">Astuce : choisis ton prono d\'or dans les pronostics pour l\'afficher sur ta couverture.</p>' : ''}
        <button type="button" class="btn btn-blue btn-block btn-between" data-share><span>Partager ma couverture</span>${ARROW}</button>
        <button type="button" class="btn btn-ghost btn-block" data-save>Enregistrer l'image</button>
    `);
    const canvas = el.querySelector('canvas');
    const dateLabel = (() => {
        try { return new Date(`${App.edition.electionDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
        catch { return '12 déc. 2026'; }
    })();
    const draw = () => renderCoverCanvas(canvas, {
        photo: current.photo,
        pseudo: App.user.pseudo,
        hook: or ? `Mon pronostic d'or : Miss ${regionOf(or)}` : `${App.candidates.length} candidates, un seul jury`,
        scoreLine: `${total} pt${total > 1 ? 's' : ''}${rank ? ` · ${ordinal(rank)}` : ''}`,
        year: App.edition.year,
        dateLabel
    });
    await draw();

    el.querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', async () => {
        current = sources.find(s => s.key === b.dataset.src) || sources[0];
        el.querySelectorAll('[data-src]').forEach(x => x.classList.toggle('active', x === b));
        await draw();
    }));

    const toFile = () => new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], `ma-une-miss-france-${App.edition.year}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9));
    const download = (file) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    el.querySelector('[data-share]').addEventListener('click', async () => {
        const file = await toFile();
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'Ma une Miss France', text: `Mon pronostic pour Miss France ${App.edition.year} 👑` }); } catch { /* annulé */ }
        } else {
            download(file);
            toast("Image enregistrée : tu peux l'envoyer sur WhatsApp.", 'success');
        }
    });
    el.querySelector('[data-save]').addEventListener('click', async () => download(await toFile()));
}
window.openCoverStudio = () => buildCoverStudio().catch(err => toast(err.message, 'error'));
