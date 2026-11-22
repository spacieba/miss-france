/* ============================================================
   Le duel de chant (épreuve d'équipe)
   L'admin enregistre sur son téléphone un chanteur de chaque équipe (et, s'il le veut, une
   référence où l'on n'entend que la voix). L'appli mesure la justesse et la stabilité de chaque
   voix, plus la fidélité à la référence quand il y en a une, puis l'admin publie le résultat :
   tout le monde peut alors le consulter. L'analyse se fait dans le navigateur ; aucun
   enregistrement n'est envoyé au serveur, seulement les notes chiffrées du résultat.
   ============================================================ */

// ---------- Moteur d'analyse (aucune dépendance à la page) ----------
// DUEL-CORE-START
const DUEL_NOTES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
function duelNoteName(m) { const r = Math.round(m); const n = ((r % 12) + 12) % 12; return DUEL_NOTES[n] + (Math.floor(r / 12) - 1); }
function duelMedian(a) { const b = Array.from(a).sort((x, y) => x - y); const n = b.length; if (!n) return NaN; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; }
function duelClamp01(v) { return Math.max(0, Math.min(1, v)); }

// Hauteur d'une trame (algorithme YIN) : renvoie la fréquence en Hz, ou null si la trame n'est pas « chantée »
function duelYinFrame(x, start, W, tauMax, tauMin, sr, thr) {
    const d = new Float32Array(tauMax + 2);
    for (let tau = 1; tau <= tauMax; tau++) {
        let s = 0;
        for (let j = 0; j < W; j++) { const df = x[start + j] - x[start + j + tau]; s += df * df; }
        d[tau] = s;
    }
    const c = new Float32Array(tauMax + 2); c[0] = 1; let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; c[tau] = run === 0 ? 1 : d[tau] * tau / run; }
    let tau = tauMin, found = -1;
    while (tau < tauMax - 1) {
        if (c[tau] < thr) { while (tau + 1 < tauMax - 1 && c[tau + 1] < c[tau]) tau++; found = tau; break; }
        tau++;
    }
    if (found < 0) return null;
    const a = c[found - 1], b = c[found], g = c[found + 1];
    const den = a - 2 * b + g;
    const t = den !== 0 ? found + (a - g) / (2 * den) : found;
    return sr / t;
}

// Courbe de hauteur de toute la prise (en demi-tons MIDI, NaN quand personne ne chante)
async function duelAnalyzeVoice(samples, sr, onProgress) {
    const k = Math.max(1, Math.floor(sr / 12000));
    const n2 = Math.floor(samples.length / k);
    const x = new Float32Array(n2);
    for (let i = 0; i < n2; i++) { let s = 0; for (let j = 0; j < k; j++) s += samples[i * k + j]; x[i] = s / k; }
    const sr2 = sr / k;
    const hop = Math.max(1, Math.round(0.02 * sr2));
    const W = Math.round(0.03 * sr2);
    const tauMax = Math.floor(sr2 / 70), tauMin = Math.max(2, Math.floor(sr2 / 1000));
    const nF = Math.max(0, Math.floor((n2 - W - tauMax - 2) / hop));
    const rms = new Float32Array(nF);
    for (let f = 0; f < nF; f++) { let s = 0; const st = f * hop; for (let j = 0; j < W; j++) s += x[st + j] * x[st + j]; rms[f] = Math.sqrt(s / W); }
    const sorted = Array.from(rms).sort((a, b) => a - b);
    const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
    const gate = Math.max(1e-4, 0.08 * ref);
    const raw = new Float32Array(nF).fill(NaN);
    let energetic = 0; // trames où l'on entend quelque chose
    for (let f = 0; f < nF; f++) {
        if (rms[f] > gate) {
            energetic++;
            const fr = duelYinFrame(x, f * hop, W, tauMax, tauMin, sr2, 0.15);
            if (fr && fr >= 70 && fr <= 1100) raw[f] = 69 + 12 * Math.log2(fr / 440);
        }
        if (onProgress && f % 400 === 0) await onProgress(f / nF);
    }
    const m = new Float32Array(nF).fill(NaN);
    for (let f = 0; f < nF; f++) {
        if (isNaN(raw[f])) continue;
        const v = []; for (let j = Math.max(0, f - 2); j <= Math.min(nF - 1, f + 2); j++) if (!isNaN(raw[j])) v.push(raw[j]);
        if (v.length >= 3) m[f] = duelMedian(v);
    }
    return { m, hop_s: hop / sr2, dur_s: samples.length / sr, energetic };
}

// Découpe la courbe en notes tenues (au moins 6 trames, soit ~0,12 s)
function duelFindNotes(m, hop_s) {
    const notes = []; const n = m.length; let i = 0;
    while (i < n) {
        if (isNaN(m[i])) { i++; continue; }
        const run = [m[i]]; let j = i + 1, gap = 0;
        while (j < n) {
            if (isNaN(m[j])) {
                if (gap < 1 && j + 1 < n && !isNaN(m[j + 1])) { gap++; j++; continue; }
                break;
            }
            if (Math.abs(m[j] - duelMedian(run)) < 0.5) { run.push(m[j]); j++; gap = 0; } else break;
        }
        if (run.length >= 6) {
            const mean = run.reduce((a, b) => a + b, 0) / run.length;
            const sd = Math.sqrt(run.reduce((a, b) => a + (b - mean) * (b - mean), 0) / run.length);
            notes.push({ i, len: j - i, med: duelMedian(run), stdc: sd * 100, dur: run.length * hop_s });
        }
        i = Math.max(j, i + 1);
    }
    return notes;
}

// Note sur 100 : justesse (65 %) par rapport au demi-ton le plus proche, après correction
// du décalage général de la voix ; stabilité (35 %) des notes tenues.
function duelScoreNotes(notes) {
    const n = notes.length;
    const voiced = notes.reduce((a, b) => a + b.dur, 0);
    if (n === 0) return { n: 0, voiced: 0, offsetc: 0, justesse: 0, stabilite: 0, total: 0, low: NaN, high: NaN };
    let sx = 0, sy = 0;
    for (const o of notes) { const a = 2 * Math.PI * o.med; sx += o.dur * Math.cos(a); sy += o.dur * Math.sin(a); }
    const offset = Math.atan2(sy, sx) / (2 * Math.PI);
    let wsum = 0, jsum = 0, ssum = 0;
    for (const o of notes) {
        const xx = o.med - offset;
        o.devc = Math.abs(xx - Math.round(xx)) * 100;
        const dp = Math.max(0, o.devc - 8) / 42;
        jsum += o.dur * dp;
        ssum += o.dur * o.stdc;
        wsum += o.dur;
    }
    const justesse = 100 * duelClamp01(1 - (jsum / wsum) / 0.42);
    const stabilite = 100 * duelClamp01(1 - ((ssum / wsum) - 6) / 18);
    const meds = notes.map(o => o.med);
    return { n, voiced, offsetc: offset * 100, justesse, stabilite, total: 0.65 * justesse + 0.35 * stabilite, low: Math.min(...meds), high: Math.max(...meds) };
}

function duelContour(m, hop_s, step) {
    const k = Math.max(1, Math.round((step || 0.1) / hop_s)); const out = [];
    for (let i = 0; i < m.length; i += k) {
        const v = []; for (let j = i; j < Math.min(m.length, i + k); j++) if (!isNaN(m[j])) v.push(m[j]);
        if (v.length >= Math.ceil(k / 2)) out.push(duelMedian(v));
    }
    return out;
}
// Ressemblance de deux mélodies (0 à 100), insensible à la tonalité, à l'octave et aux petits décalages de rythme.
// Sert à comparer les deux chanteurs entre eux, ou un chanteur à la référence (« fidélité »).
function duelSimilarityContours(a, b) {
    if (a.length < 10 || b.length < 10) return NaN;
    const ca = duelMedian(a), cb = duelMedian(b);
    const N = a.length, M = b.length;
    let pD = new Float32Array(M + 1).fill(Infinity), pL = new Int32Array(M + 1); pD[0] = 0;
    for (let i = 1; i <= N; i++) {
        const cD = new Float32Array(M + 1).fill(Infinity), cL = new Int32Array(M + 1);
        for (let j = 1; j <= M; j++) {
            let x = (a[i - 1] - ca) - (b[j - 1] - cb); x = Math.abs(((x + 6) % 12 + 12) % 12 - 6);
            let bd = pD[j - 1], bl = pL[j - 1];
            if (pD[j] < bd) { bd = pD[j]; bl = pL[j]; }
            if (cD[j - 1] < bd) { bd = cD[j - 1]; bl = cL[j - 1]; }
            cD[j] = bd + x; cL[j] = bl + 1;
        }
        pD = cD; pL = cL;
    }
    return 100 * duelClamp01(1 - (pD[M] / pL[M]) / 3);
}
function duelSimilarity(mA, mB, hop_s) {
    return duelSimilarityContours(duelContour(mA, hop_s), duelContour(mB, hop_s));
}

// Qualité d'une prise de référence : sur une voix seule, presque tout ce qui est audible porte une note nette ;
// sur une chanson avec accompagnement, le détecteur décroche et la couverture s'effondre.
function duelRefQuality(analysis, notes) {
    const held = notes.reduce((n, o) => n + o.len, 0);
    const coverage = analysis.energetic ? held / analysis.energetic : 0;
    const voiced = notes.reduce((n, o) => n + o.dur, 0);
    return { coverage, notes: notes.length, voiced, ok: notes.length >= 8 && voiced >= 5 && coverage >= 0.5 };
}

// Note finale. Sans référence : justesse 65 %, stabilité 35 %.
// Avec référence : fidélité à la mélodie 40 %, justesse 40 %, stabilité 20 %.
function duelFinalTotal(score, fidelite) {
    if (!score.n) return 0;
    if (fidelite === null || fidelite === undefined || isNaN(fidelite)) return 0.65 * score.justesse + 0.35 * score.stabilite;
    return 0.4 * fidelite + 0.4 * score.justesse + 0.2 * score.stabilite;
}
// DUEL-CORE-END

// ---------- Interface ----------
// Tout le monde consulte les résultats publiés ; seul l'admin a l'onglet « Capture »
// (enregistrement des voix sur son téléphone, analyse, publication).

const Duel = { teams: [], teamsKey: '', takes: {}, rec: {}, preview: null, busy: false, view: 'results', list: [], listKey: '', refs: [], ref: null };
const DUEL_MAX_SECONDS = 240;
const DUEL_SLOTS = ['ref', '0', '1'];

const duelEl = (id) => document.getElementById(id);
const duelStatus = (slot, text) => { const el = duelEl(`duel-status-${slot}`); if (el) el.textContent = text; };
const duelSingerName = (i) => {
    const sel = duelEl(`duel-singer-${i}`);
    const picked = sel && sel.value ? sel.options[sel.selectedIndex].textContent : '';
    return picked || (Duel.teams[i] ? Duel.teams[i].short || Duel.teams[i].name : `Chanteur ${i + 1}`);
};
const duelCents = (c) => { const r = Math.round(c); return `${r > 0 ? '+' : ''}${r} cents`; };

// ---------- Résultat d'un duel (aperçu de l'admin et duels publiés) ----------

function duelResultHtml(d, { canvasKey, admin = false, preview = false } = {}) {
    const [A, B] = d.singers;
    const w = d.winner >= 0 ? d.singers[d.winner] : null;
    const wTeam = w ? teamInfo(w.team) : null;
    const withRef = A.fidelite !== null && A.fidelite !== undefined;
    let kicker, title, margin;
    if (A.n === 0 && B.n === 0) { kicker = 'Résultat'; title = 'Aucune voix détectée'; margin = 'Les prises étaient trop faibles pour être analysées.'; }
    else if (!w) { kicker = 'Résultat'; title = 'Match nul'; margin = `Moins de 3 points d'écart : ${Math.round(A.total)} contre ${Math.round(B.total)}.`; }
    else {
        const l = d.singers[1 - d.winner];
        kicker = 'Le vainqueur du duel'; title = w.name;
        margin = `${Math.round(Math.abs(A.total - B.total))} points d'avance sur ${l.name} (${Math.round(w.total)} contre ${Math.round(l.total)}).`;
    }
    const warns = [];
    for (const a of d.singers) {
        if (a.n < 8 || a.voiced < 5) warns.push(`Peu de notes exploitables pour ${a.name} (${a.n} notes, ${Number(a.voiced).toFixed(1)} s) : son score est peu fiable.`);
    }
    if (!withRef && d.sim !== null && d.sim !== undefined && d.sim < 55) warns.push(`Les deux mélodies se ressemblent peu (${Math.round(d.sim)} %). Ont-ils chanté le même passage ?`);

    const card = (a, i) => {
        const t = teamInfo(a.team);
        const crits = [...(withRef ? [['Fidélité à la mélodie', a.fidelite]] : []), ['Justesse', a.justesse], ['Stabilité', a.stabilite]];
        const facts = [['Notes analysées', `${a.n} (${Math.round(a.voiced)} s tenues)`]];
        if (a.n) { facts.push(['Tessiture', `${duelNoteName(a.low)} à ${duelNoteName(a.high)}`]); facts.push(['Écart au diapason', duelCents(a.offsetc)]); }
        return `
        <article class="duel-card ${t ? `team-${t.key}` : ''} ${d.winner === i ? 'win' : ''}">
            <header><span class="serif">${escapeHtml(a.name)}</span><span class="duel-total">${Math.round(a.total)}<small> / 100</small></span></header>
            ${t ? `<span class="small muted">${escapeHtml(t.name)}</span>` : ''}
            ${crits.map(([lab, val]) => `
                <div class="duel-crit"><div class="row"><span>${lab}</span><b>${Math.round(val)}</b></div><div class="duel-bar"><i style="width:${Math.round(val)}%"></i></div></div>`).join('')}
            <dl class="duel-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
        </article>`;
    };

    return `
        <div class="duel-verdict ${wTeam ? `team-${wTeam.key}` : ''}">
            <p class="kicker">${kicker}${d.song ? ` · ${escapeHtml(d.song)}` : ''}</p>
            <h3 class="duel-winner">${escapeHtml(title)}</h3>
            ${wTeam ? `<p class="duel-winner-team">${escapeHtml(wTeam.name)}${d.awarded ? ` · +${d.awarded} pts` : ''}</p>` : ''}
            <p class="small">${escapeHtml(margin)}</p>
        </div>
        ${warns.length ? `<p class="banner">${escapeHtml(warns.join(' '))}</p>` : ''}
        <div class="duel-board">${d.singers.map(card).join('')}</div>
        <div class="duel-legend"><span class="ok">Juste</span><span class="mid">Un peu à côté</span><span class="ko">Faux</span></div>
        ${d.singers.map((a, i) => `
            <div class="duel-strip-label"><span>${escapeHtml(a.name)}</span><span>${Math.round(a.justesse)} en justesse</span></div>
            <canvas class="duel-canvas" data-duel-canvas="${canvasKey}:${i}" role="img" aria-label="Notes de ${escapeHtml(a.name)} dans le temps"></canvas>`).join('')}
        <p class="hint" style="margin-top: 10px;">${withRef
            ? `Noté par rapport à la référence${d.ref ? ` « ${escapeHtml(d.ref)} »` : ''} : fidélité 40 %, justesse 40 %, stabilité 20 %.`
            : `Sans mélodie de référence : justesse 65 %, stabilité 35 %.${d.sim === null || d.sim === undefined ? '' : ` Ressemblance des deux mélodies : ${Math.round(d.sim)} % (indicatif).`}`}</p>
        ${admin && !preview ? `<button type="button" class="btn btn-ghost btn-sm" data-duel-delete="${d.id}">Supprimer ce duel${d.awarded ? ' et ses points' : ''}</button>` : ''}`;
}

function duelDrawAll() {
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    document.querySelectorAll('[data-duel-canvas]').forEach(cv => {
        if (!cv.clientWidth) return;
        const [key, idx] = cv.dataset.duelCanvas.split(':');
        const d = key === 'preview' ? Duel.preview : Duel.list.find(x => String(x.id) === key);
        if (!d) return;
        const a = d.singers[Number(idx)];
        const T = Math.max(d.singers[0].dur || 0, d.singers[1].dur || 0, 1);
        const all = [...d.singers[0].notes, ...d.singers[1].notes].map(n => n[2]);
        let lo = all.length ? Math.min(...all) - 1.5 : 55, hi = all.length ? Math.max(...all) + 1.5 : 75;
        if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
        const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        const y = (m) => h - 10 - (m - lo) / (hi - lo) * (h - 20);
        g.font = '11px Inter, system-ui, sans-serif'; g.lineWidth = 1; g.strokeStyle = 'rgba(20,18,26,0.16)'; g.fillStyle = css('--ink-3');
        for (let m = Math.ceil(lo / 12) * 12; m <= hi; m += 12) {
            g.beginPath(); g.moveTo(0, y(m)); g.lineTo(w, y(m)); g.stroke(); g.fillText(duelNoteName(m), 4, y(m) - 3);
        }
        for (const [t, len, med, dev] of a.notes) {
            g.fillStyle = dev <= 10 ? css('--success') : dev <= 25 ? css('--gold') : css('--error');
            g.fillRect(t / T * w, y(med) - 3, Math.max(2, len / T * w), 6);
        }
    });
}

// ---------- Onglet Résultats (tout le monde) ----------

async function refreshDuelList({ force = false } = {}) {
    const list = await api('/api/duels');
    const key = JSON.stringify(list.map(d => [d.id, d.awarded]));
    Duel.list = list;
    if (!force && key === Duel.listKey) return;
    const fresh = Duel.listKey && list.length && !Duel.listKey.includes(`[${list[0].id},`);
    Duel.listKey = key;
    const box = duelEl('duel-list');
    if (!list.length) {
        box.innerHTML = `<p class="empty">Aucun duel pour l'instant. Les résultats s'afficheront ici dès que le premier sera publié.</p>`;
        return;
    }
    const admin = App.user.isAdmin;
    const [latest, ...older] = list;
    box.innerHTML = `
        <p class="kicker">Le dernier duel</p>
        <div class="duel-result">${duelResultHtml(latest, { canvasKey: latest.id, admin })}</div>
        ${older.length ? `<h2 class="subhead">Les duels <em>précédents</em></h2>${older.map(d => {
            const w = d.winner >= 0 ? d.singers[d.winner] : null;
            return `<details class="duel-past"><summary><span class="serif">${escapeHtml(d.singers[0].name)} <em>vs</em> ${escapeHtml(d.singers[1].name)}</span><span class="small muted">${w ? `${escapeHtml(w.name)} gagne ${Math.round(w.total)} à ${Math.round(d.singers[1 - d.winner].total)}` : 'Match nul'}${d.song ? ` · ${escapeHtml(d.song)}` : ''}</span></summary>
                <div class="duel-result">${duelResultHtml(d, { canvasKey: d.id, admin })}</div></details>`;
        }).join('')}` : ''}`;
    duelDrawAll();
    if (fresh && Duel.view === 'results' && window.MFX) { window.MFX.fanfare(); if (typeof confetti === 'function') confetti(60); }
}

// ---------- Onglet Capture (admin) ----------

function renderDuelCapture() {
    const corner = (i) => {
        const t = Duel.teams[i];
        const members = t ? t.members : [];
        return `
        <article class="duel-corner ${t ? `team-${t.key}` : ''}">
            <p class="duel-team">${escapeHtml(t ? t.name : `Chanteur ${i + 1}`)}</p>
            <select class="input" id="duel-singer-${i}" aria-label="Chanteur ${t ? `de l'${t.name}` : i + 1}">
                <option value="">${members.length ? 'Choisir le chanteur' : 'Personne dans cette équipe'}</option>
                ${members.map(m => `<option value="${m.id}">${escapeHtml(m.pseudo)}</option>`).join('')}
            </select>
            ${duelRecHtml(String(i))}
        </article>`;
    };
    duelEl('duel-capture').innerHTML = `
        <label class="field">Chanson (facultatif)
            <input type="text" class="input" id="duel-song" maxlength="60" placeholder="Titre de la chanson" autocomplete="off">
        </label>

        <div class="duel-ref">
            <p class="duel-team">La référence <span class="small muted">· facultative</span></p>
            <p class="hint">Une version où l'on n'entend que la voix : un fichier a cappella, ou quelqu'un qui chante juste le passage sans musique. Avec elle, la note tient compte de la fidélité à la mélodie. Sans elle, seules la justesse et la tenue comptent.</p>
            <select class="input" id="duel-ref-select" aria-label="Référence enregistrée"></select>
            ${duelRecHtml('ref')}
            <div class="duel-ref-save" id="duel-ref-save" hidden>
                <input type="text" class="input" id="duel-ref-title" maxlength="60" placeholder="Titre pour la garder (ex. On va s'aimer)" autocomplete="off">
                <button type="button" class="btn btn-ghost btn-sm" id="duel-ref-keep">Garder cette référence</button>
            </div>
        </div>

        <div class="duel-corners">${corner(0)}${corner(1)}</div>
        <button type="button" class="btn btn-blue btn-block btn-between" id="duel-go" disabled><span id="duel-go-label">Lancer le duel</span>${ARROW}</button>
        <div id="duel-preview" hidden></div>`;
    renderDuelRefSelect();
    duelCheckReady();
}

function duelRecHtml(slot) {
    return `
        <div class="duel-rec">
            <button type="button" class="btn btn-ghost btn-sm" data-duel-rec="${slot}">Enregistrer au micro</button>
            <span class="duel-timer" id="duel-timer-${slot}"></span>
            <div class="duel-meter" id="duel-meterbox-${slot}" hidden><i id="duel-meter-${slot}"></i></div>
        </div>
        <audio id="duel-audio-${slot}" controls hidden></audio>
        <p class="small muted duel-status" id="duel-status-${slot}" aria-live="polite">${slot === 'ref' ? 'Pas de référence.' : 'Aucune prise.'}</p>
        <label class="btn-link duel-import">ou importer un fichier audio<input type="file" data-duel-file="${slot}" accept="audio/*,video/*" hidden></label>`;
}

function renderDuelRefSelect() {
    const sel = duelEl('duel-ref-select');
    if (!sel) return;
    const current = Duel.ref && Duel.ref.id ? String(Duel.ref.id) : '';
    sel.innerHTML = `<option value="">${Duel.refs.length ? 'Sans référence enregistrée' : 'Aucune référence enregistrée'}</option>`
        + Duel.refs.map(r => `<option value="${r.id}" ${String(r.id) === current ? 'selected' : ''}>${escapeHtml(r.title)}</option>`).join('');
    sel.hidden = !Duel.refs.length;
}

function duelCheckReady() {
    const go = duelEl('duel-go');
    if (go) go.disabled = Duel.busy || !(Duel.takes['0'] && Duel.takes['1']);
}

// Décode une prise (enregistrement ou fichier importé) en échantillons mono
async function duelLoadTake(slot, file) {
    if (!file) return;
    Duel.takes[slot] = null; duelCheckReady();
    if (slot === 'ref') { Duel.ref = null; duelEl('duel-ref-save').hidden = true; duelEl('duel-ref-select').value = ''; }
    duelStatus(slot, 'Lecture de la prise…');
    try {
        const buf = await file.arrayBuffer();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const audio = await new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej));
        try { ctx.close(); } catch { /* déjà fermé */ }
        const maxLen = Math.min(audio.length, Math.floor(audio.sampleRate * DUEL_MAX_SECONDS));
        const mono = new Float32Array(maxLen);
        for (let c = 0; c < audio.numberOfChannels; c++) {
            const d = audio.getChannelData(c);
            for (let s = 0; s < maxLen; s++) mono[s] += d[s] / audio.numberOfChannels;
        }
        Duel.takes[slot] = { samples: mono, sr: audio.sampleRate };
        const player = duelEl(`duel-audio-${slot}`);
        if (player.src) URL.revokeObjectURL(player.src);
        player.src = URL.createObjectURL(file); player.hidden = false;
        const secs = Math.round(audio.duration);
        const length = `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s${audio.duration > DUEL_MAX_SECONDS ? ' (limitée aux 4 premières minutes)' : ''}`;
        if (slot === 'ref') await duelPrepareRef(length);
        else duelStatus(slot, `Prise prête · ${length}`);
    } catch {
        duelStatus(slot, 'Cette prise ne peut pas être lue. Réessaie, ou importe un fichier mp3, m4a ou wav.');
    }
    duelCheckReady();
}

// Analyse la référence tout de suite, pour dire si elle est exploitable
async function duelPrepareRef(length) {
    duelStatus('ref', 'Analyse de la référence…');
    const take = Duel.takes.ref;
    const a = await duelAnalyzeVoice(take.samples, take.sr, async (p) => { duelStatus('ref', `Analyse de la référence… ${Math.round(p * 100)} %`); await new Promise(r => setTimeout(r, 0)); });
    const notes = duelFindNotes(a.m, a.hop_s);
    const q = duelRefQuality(a, notes);
    if (!q.ok) {
        Duel.ref = null;
        duelStatus('ref', `Référence inexploitable (${q.notes} notes nettes, ${Math.round(q.coverage * 100)} % de la prise) : on n'y entend pas une voix seule. Le duel sera noté sans référence.`);
        return;
    }
    Duel.ref = { id: null, title: null, contour: duelContour(a.m, a.hop_s) };
    duelStatus('ref', `Référence prête · ${length} · ${q.notes} notes nettes (${Math.round(q.coverage * 100)} % de la prise).`);
    duelEl('duel-ref-save').hidden = false;
}

const DUEL_MIC_MSG = "Le micro n'est pas accessible. Autorise-le dans le navigateur (cadenas à côté de l'adresse), ou enregistre avec le Dictaphone du téléphone puis importe le fichier.";

async function duelToggleRec(slot) {
    const btn = document.querySelector(`[data-duel-rec="${slot}"]`);
    if (Duel.rec[slot]) { Duel.rec[slot].stop(); return; }
    if (DUEL_SLOTS.some(s => Duel.rec[s])) return toast('Un autre enregistrement est en cours.', 'error');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { duelStatus(slot, DUEL_MIC_MSG); return; }
    let stream;
    try {
        // Pas de traitement automatique : il déformerait la voix et fausserait la mesure
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { duelStatus(slot, DUEL_MIC_MSG); return; }
    const chunks = [];
    const mr = new MediaRecorder(stream);
    const t0 = Date.now();
    const timer = duelEl(`duel-timer-${slot}`), box = duelEl(`duel-meterbox-${slot}`), bar = duelEl(`duel-meter-${slot}`);
    box.hidden = false;
    const iv = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (s >= DUEL_MAX_SECONDS && Duel.rec[slot]) Duel.rec[slot].stop();
    }, 250);
    let ac = null, raf = 0;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ac = new Ctx();
        const an = ac.createAnalyser(); an.fftSize = 1024;
        ac.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(1024);
        const level = () => {
            an.getFloatTimeDomainData(buf);
            let s = 0; for (let k = 0; k < buf.length; k++) s += buf[k] * buf[k];
            bar.style.width = `${Math.min(100, Math.sqrt(s / buf.length) * 500)}%`;
            raf = requestAnimationFrame(level);
        };
        level();
    } catch { /* pas de niveau sonore : l'enregistrement continue quand même */ }
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
        clearInterval(iv); cancelAnimationFrame(raf);
        stream.getTracks().forEach(t => t.stop());
        if (ac) { try { ac.close(); } catch { /* déjà fermé */ } }
        Duel.rec[slot] = null; box.hidden = true; bar.style.width = '0';
        btn.classList.remove('on'); btn.textContent = 'Réenregistrer';
        const type = mr.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        duelLoadTake(slot, new File([new Blob(chunks, { type })], `prise.${ext}`, { type }));
    };
    mr.start(); Duel.rec[slot] = mr;
    btn.classList.add('on'); btn.textContent = "Arrêter l'enregistrement";
    duelStatus(slot, slot === 'ref' ? 'Enregistrement de la référence…' : 'Enregistrement en cours… chante, le téléphone près de la bouche !');
}

async function duelRun() {
    if (Duel.busy || !(Duel.takes['0'] && Duel.takes['1'])) return;
    Duel.busy = true; duelCheckReady();
    const label = duelEl('duel-go-label');
    duelEl('duel-preview').hidden = true;
    try {
        const raw = [];
        for (const i of [0, 1]) {
            const name = duelSingerName(i);
            const take = Duel.takes[String(i)];
            const a = await duelAnalyzeVoice(take.samples, take.sr, async (p) => {
                label.textContent = `Analyse de ${name}… ${Math.round(p * 100)} %`;
                await new Promise(r => setTimeout(r, 0));
            });
            a.notes = duelFindNotes(a.m, a.hop_s);
            a.score = duelScoreNotes(a.notes);
            a.name = name;
            raw.push(a);
        }
        const ref = Duel.ref;
        const singers = raw.map((a, i) => {
            const fidelite = ref && a.score.n ? duelSimilarityContours(duelContour(a.m, a.hop_s), ref.contour) : null;
            const fid = fidelite === null || isNaN(fidelite) ? null : fidelite;
            return {
                name: a.name, team: Duel.teams[i] ? Duel.teams[i].key : null,
                total: duelFinalTotal(a.score, fid), justesse: a.score.justesse, stabilite: a.score.stabilite, fidelite: fid,
                n: a.score.n, voiced: a.score.voiced, low: a.score.n ? a.score.low : null, high: a.score.n ? a.score.high : null,
                offsetc: a.score.offsetc, dur: a.dur_s,
                notes: a.notes.slice(0, 800).map(n => [Math.round(n.i * a.hop_s * 100) / 100, Math.round(n.len * a.hop_s * 100) / 100, Math.round(n.med * 100) / 100, Math.round(n.devc || 0)])
            };
        });
        // Si l'un des deux n'a pas pu être comparé à la référence, on revient à la notation sans référence pour les deux
        if (singers.some(s => s.fidelite === null)) singers.forEach((s, i) => { s.fidelite = null; s.total = duelFinalTotal(raw[i].score, null); });
        const sim = duelSimilarity(raw[0].m, raw[1].m, raw[0].hop_s);
        const diff = singers[0].total - singers[1].total;
        Duel.preview = {
            song: duelEl('duel-song').value.trim(), ref: singers[0].fidelite !== null ? (ref.title || 'prise du soir') : null,
            sim: isNaN(sim) ? null : sim,
            winner: (singers[0].n === 0 && singers[1].n === 0) || Math.abs(diff) < 3 ? -1 : diff > 0 ? 0 : 1,
            singers
        };
        renderDuelPreview();
    } catch (err) {
        toast(`Erreur pendant l'analyse : ${err.message}`, 'error');
    }
    label.textContent = 'Relancer le duel';
    Duel.busy = false; duelCheckReady();
}

function renderDuelPreview() {
    const d = Duel.preview;
    const w = d.winner >= 0 ? d.singers[d.winner] : null;
    const wTeam = w ? teamInfo(w.team) : null;
    const box = duelEl('duel-preview');
    box.innerHTML = `
        <p class="kicker" style="margin-top: 22px;">Aperçu · pas encore publié</p>
        <div class="duel-result">${duelResultHtml(d, { canvasKey: 'preview', preview: true })}</div>
        <form class="duel-award" id="duel-publish">
            <p class="kicker">Publier pour tout le monde</p>
            ${wTeam ? `<label class="field">Points pour l'${escapeHtml(wTeam.name)} (0 pour aucun)
                <input type="number" class="input" id="duel-points" value="10" min="0" step="1"></label>` : '<p class="hint">Pas de vainqueur rattaché à une équipe : aucun point ne sera attribué.</p>'}
            <button type="submit" class="btn btn-blue btn-block btn-between"><span>Publier le résultat</span>${ARROW}</button>
        </form>`;
    box.hidden = false;
    duelDrawAll();
    box.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

// ---------- Navigation entre les deux onglets ----------

function duelShow(view) {
    Duel.view = App.user.isAdmin ? view : 'results';
    duelEl('duel-tabs').hidden = !App.user.isAdmin;
    document.querySelectorAll('[data-duel-view]').forEach(b => b.classList.toggle('active', b.dataset.duelView === Duel.view));
    duelEl('duel-results-view').hidden = Duel.view !== 'results';
    duelEl('duel-capture').hidden = Duel.view !== 'capture';
    if (Duel.view === 'results') duelDrawAll();
}

async function loadDuel() {
    duelShow(Duel.view);
    await refreshDuelList({ force: true });
    if (!App.user.isAdmin) return;
    const [data, refs] = await Promise.all([api('/api/teams'), api('/api/admin/duel-refs')]);
    Duel.refs = refs;
    // On ne redessine la capture que si les équipes ont changé (pour ne pas perdre une prise en cours)
    const key = JSON.stringify(data.teams.map(t => [t.key, t.members.map(m => m.id)]));
    if (key !== Duel.teamsKey || !duelEl('duel-capture').children.length) {
        Duel.teamsKey = key;
        Duel.teams = data.teams.slice(0, 2);
        Duel.takes = {}; Duel.ref = null; Duel.preview = null;
        renderDuelCapture();
    } else renderDuelRefSelect();
}
App.loaders.duel = loadDuel;

document.addEventListener('app:ready', () => {
    const section = duelEl('duel');
    if (!section) return;
    section.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-duel-view]');
        if (tab) return duelShow(tab.dataset.duelView);
        const rec = e.target.closest('[data-duel-rec]');
        if (rec) return duelToggleRec(rec.dataset.duelRec);
        if (e.target.closest('#duel-go')) return duelRun();
        if (e.target.closest('#duel-ref-keep')) {
            const title = duelEl('duel-ref-title').value.trim();
            if (!title) return toast('Donne un titre à la référence.', 'error');
            if (!Duel.ref) return;
            try {
                const data = await api('/api/admin/duel-refs', { method: 'POST', body: { title, contour: Duel.ref.contour } });
                toast(data.message, 'success');
                Duel.ref.id = data.id; Duel.ref.title = title;
                Duel.refs = await api('/api/admin/duel-refs');
                renderDuelRefSelect();
                duelEl('duel-ref-save').hidden = true;
            } catch (err) { toast(err.message, 'error'); }
            return;
        }
        const del = e.target.closest('[data-duel-delete]');
        if (del) {
            if (!confirm('Supprimer ce duel ?\n\nS\'il avait rapporté des points à une équipe, ils sont retirés.')) return;
            try {
                const data = await api(`/api/admin/duels/${del.dataset.duelDelete}`, { method: 'DELETE' });
                toast(data.message, 'success');
                await refreshDuelList({ force: true });
            } catch (err) { toast(err.message, 'error'); }
        }
    });
    section.addEventListener('change', async (e) => {
        const input = e.target.closest('[data-duel-file]');
        if (input) return duelLoadTake(input.dataset.duelFile, input.files[0]);
        if (e.target.id === 'duel-ref-select') {
            const id = e.target.value;
            Duel.takes.ref = null; duelEl('duel-ref-save').hidden = true; duelEl('duel-audio-ref').hidden = true;
            if (!id) { Duel.ref = null; duelStatus('ref', 'Pas de référence.'); return; }
            try {
                const r = await api(`/api/admin/duel-refs/${id}`);
                Duel.ref = { id: r.id, title: r.title, contour: r.contour };
                duelStatus('ref', `Référence « ${r.title} » chargée.`);
            } catch (err) { toast(err.message, 'error'); }
        }
    });
    section.addEventListener('submit', async (e) => {
        if (e.target.id !== 'duel-publish') return;
        e.preventDefault();
        const d = Duel.preview;
        if (!d) return;
        const pts = duelEl('duel-points');
        try {
            const data = await api('/api/admin/duels', { method: 'POST', body: { song: d.song, points: pts ? Number(pts.value) : 0, result: d } });
            toast(data.message, 'success');
            Duel.preview = null;
            duelEl('duel-preview').hidden = true;
            duelShow('results');
            await refreshDuelList({ force: true });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) { toast(err.message, 'error'); }
    });
    section.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('duel-past')) duelDrawAll(); }, true);
    window.addEventListener('resize', duelDrawAll);
    // Les résultats se mettent à jour tout seuls pour ceux qui regardent
    setInterval(() => {
        if (App.current === 'duel' && Duel.view === 'results' && document.visibilityState === 'visible') refreshDuelList().catch(() => {});
    }, 8000);
});
