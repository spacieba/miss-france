/* ============================================================
   Le duel de chant (épreuve d'équipe)
   Deux chanteurs, un par équipe, s'enregistrent au micro sur le même passage.
   L'appli mesure la justesse et la stabilité de chaque voix, sans mélodie de référence :
   elle ne sait pas quelle note était attendue, elle juge si la voix est propre en elle-même.
   Tout se passe dans le navigateur : aucun enregistrement n'est envoyé au serveur.
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
    for (let f = 0; f < nF; f++) {
        if (rms[f] > gate) {
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
    return { m, hop_s: hop / sr2, dur_s: samples.length / sr };
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
// Ressemblance indicative des deux mélodies (0 à 100), insensible à la tonalité et à l'octave
function duelSimilarity(mA, mB, hop_s) {
    const a = duelContour(mA, hop_s), b = duelContour(mB, hop_s);
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
// DUEL-CORE-END

// ---------- Interface ----------

const Duel = { teams: [], takes: [null, null], rec: [null, null], last: null, busy: false };
const DUEL_MAX_SECONDS = 240;

const duelEl = (id) => document.getElementById(id);
const duelStatus = (i, text) => { const el = duelEl(`duel-status-${i}`); if (el) el.textContent = text; };
const duelSingerName = (i) => {
    const sel = duelEl(`duel-singer-${i}`);
    const picked = sel && sel.value ? sel.options[sel.selectedIndex].textContent : '';
    return picked || (Duel.teams[i] ? Duel.teams[i].short || Duel.teams[i].name : `Chanteur ${i + 1}`);
};

function renderDuelCorners() {
    const corners = [0, 1].map(i => {
        const t = Duel.teams[i];
        const members = t ? t.members : [];
        return `
        <article class="duel-corner ${t ? `team-${t.key}` : ''}" data-corner="${i}">
            <p class="duel-team">${escapeHtml(t ? t.name : `Chanteur ${i + 1}`)}</p>
            <select class="input" id="duel-singer-${i}" aria-label="Chanteur ${t ? `de l'${t.name}` : i + 1}">
                <option value="">${members.length ? 'Choisir le chanteur' : 'Personne dans cette équipe'}</option>
                ${members.map(m => `<option value="${m.id}">${escapeHtml(m.pseudo)}</option>`).join('')}
            </select>
            <div class="duel-rec">
                <button type="button" class="btn btn-ghost btn-sm" data-duel-rec="${i}">Enregistrer au micro</button>
                <span class="duel-timer" id="duel-timer-${i}"></span>
                <div class="duel-meter" id="duel-meterbox-${i}" hidden><i id="duel-meter-${i}"></i></div>
            </div>
            <audio id="duel-audio-${i}" controls hidden></audio>
            <p class="small muted duel-status" id="duel-status-${i}" aria-live="polite">Aucune prise.</p>
            <label class="btn-link duel-import">ou importer un fichier audio<input type="file" data-duel-file="${i}" accept="audio/*,video/*" hidden></label>
        </article>`;
    }).join('');
    duelEl('duel-corners').innerHTML = corners;
    duelCheckReady();
}

function duelCheckReady() {
    const go = duelEl('duel-go');
    if (go) go.disabled = Duel.busy || !(Duel.takes[0] && Duel.takes[1]);
}

// Décode une prise (enregistrement ou fichier importé) en échantillons mono
async function duelLoadTake(i, file) {
    if (!file) return;
    Duel.takes[i] = null; duelCheckReady();
    duelStatus(i, 'Lecture de la prise…');
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
        Duel.takes[i] = { samples: mono, sr: audio.sampleRate };
        const player = duelEl(`duel-audio-${i}`);
        if (player.src) URL.revokeObjectURL(player.src);
        player.src = URL.createObjectURL(file); player.hidden = false;
        const secs = Math.round(audio.duration);
        duelStatus(i, `Prise prête · ${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s${audio.duration > DUEL_MAX_SECONDS ? ' (analyse limitée aux 4 premières minutes)' : ''}`);
    } catch {
        duelStatus(i, 'Cette prise ne peut pas être lue. Réessaie, ou importe un fichier mp3, m4a ou wav.');
    }
    duelCheckReady();
}

const DUEL_MIC_MSG = "Le micro n'est pas accessible. Autorise-le dans le navigateur (cadenas à côté de l'adresse), ou enregistre avec le Dictaphone du téléphone puis importe le fichier.";

async function duelToggleRec(i) {
    const btn = document.querySelector(`[data-duel-rec="${i}"]`);
    if (Duel.rec[i]) { Duel.rec[i].stop(); return; }
    if (Duel.rec[1 - i]) return toast("L'autre chanteur est en train d'enregistrer.", 'error');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { duelStatus(i, DUEL_MIC_MSG); return; }
    let stream;
    try {
        // Pas de traitement automatique : il déformerait la voix et fausserait la mesure
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { duelStatus(i, DUEL_MIC_MSG); return; }
    const chunks = [];
    const mr = new MediaRecorder(stream);
    const t0 = Date.now();
    const timer = duelEl(`duel-timer-${i}`), box = duelEl(`duel-meterbox-${i}`), bar = duelEl(`duel-meter-${i}`);
    box.hidden = false;
    const iv = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (s >= DUEL_MAX_SECONDS && Duel.rec[i]) Duel.rec[i].stop();
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
        Duel.rec[i] = null; box.hidden = true; bar.style.width = '0';
        btn.classList.remove('on'); btn.textContent = 'Réenregistrer';
        const type = mr.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        duelLoadTake(i, new File([new Blob(chunks, { type })], `prise.${ext}`, { type }));
    };
    mr.start(); Duel.rec[i] = mr;
    btn.classList.add('on'); btn.textContent = "Arrêter l'enregistrement";
    duelStatus(i, 'Enregistrement en cours… chante, le téléphone près de la bouche !');
}

async function duelRun() {
    if (Duel.busy || !(Duel.takes[0] && Duel.takes[1])) return;
    Duel.busy = true; duelCheckReady();
    const label = duelEl('duel-go-label');
    duelEl('duel-results').hidden = true;
    try {
        const an = [];
        for (const i of [0, 1]) {
            const name = duelSingerName(i);
            const a = await duelAnalyzeVoice(Duel.takes[i].samples, Duel.takes[i].sr, async (p) => {
                label.textContent = `Analyse de ${name}… ${Math.round(p * 100)} %`;
                await new Promise(r => setTimeout(r, 0));
            });
            a.notes = duelFindNotes(a.m, a.hop_s);
            a.score = duelScoreNotes(a.notes);
            a.name = name;
            a.team = Duel.teams[i] || null;
            an.push(a);
        }
        Duel.last = { an, sim: duelSimilarity(an[0].m, an[1].m, an[0].hop_s) };
        renderDuelResults();
    } catch (err) {
        toast(`Erreur pendant l'analyse : ${err.message}`, 'error');
    }
    label.textContent = 'Relancer le duel';
    Duel.busy = false; duelCheckReady();
}

const duelCents = (c) => { const r = Math.round(c); return `${r > 0 ? '+' : ''}${r} cents`; };

function renderDuelResults() {
    const { an, sim } = Duel.last;
    const [A, B] = an;
    const diff = A.score.total - B.score.total;
    const warns = [];
    for (const a of an) {
        if (a.score.n < 8 || a.score.voiced < 5) warns.push(`Peu de notes exploitables pour ${a.name} (${a.score.n} notes, ${a.score.voiced.toFixed(1)} s) : son score est peu fiable. Vérifie que la voix est bien audible, sans musique trop forte derrière.`);
    }
    if (!isNaN(sim) && sim < 55) warns.push(`Les deux mélodies se ressemblent peu (ressemblance ${Math.round(sim)} %). Les deux ont-ils chanté le même passage ?`);

    let kicker, title, margin, winner = -1;
    if (A.score.n === 0 && B.score.n === 0) { kicker = 'Résultat'; title = 'Aucune voix détectée'; margin = 'Réessaie avec des prises plus nettes.'; }
    else if (Math.abs(diff) < 3) { kicker = 'Résultat'; title = 'Match nul'; margin = `Moins de 3 points d'écart : ${A.score.total.toFixed(0)} contre ${B.score.total.toFixed(0)}.`; }
    else {
        winner = diff > 0 ? 0 : 1;
        const w = an[winner], l = an[1 - winner];
        kicker = 'Le vainqueur du duel'; title = w.name;
        margin = `${Math.abs(diff).toFixed(0)} points d'avance sur ${l.name} (${w.score.total.toFixed(0)} contre ${l.score.total.toFixed(0)}).`;
    }
    Duel.last.winner = winner;
    const wTeam = winner >= 0 ? an[winner].team : null;

    const card = (a, i) => {
        const s = a.score;
        const facts = [['Notes analysées', `${s.n} (${s.voiced.toFixed(0)} s tenues)`]];
        if (s.n) { facts.push(['Tessiture', `${duelNoteName(s.low)} à ${duelNoteName(s.high)}`]); facts.push(['Écart au diapason', duelCents(s.offsetc)]); }
        return `
        <article class="duel-card ${a.team ? `team-${a.team.key}` : ''} ${winner === i ? 'win' : ''}">
            <header><span class="serif">${escapeHtml(a.name)}</span><span class="duel-total">${Math.round(s.total)}<small> / 100</small></span></header>
            ${[['Justesse', s.justesse], ['Stabilité', s.stabilite]].map(([lab, val]) => `
                <div class="duel-crit"><div class="row"><span>${lab}</span><b>${Math.round(val)}</b></div><div class="duel-bar"><i style="width:${Math.round(val)}%"></i></div></div>`).join('')}
            <dl class="duel-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
        </article>`;
    };

    const award = App.user.isAdmin && wTeam ? `
        <form class="duel-award" id="duel-award">
            <p class="kicker">Admin · attribuer les points du duel</p>
            <div class="duel-award-row">
                <input type="number" class="input" id="duel-award-points" value="10" step="1" aria-label="Points pour l'équipe gagnante">
                <button type="submit" class="btn btn-blue">Points pour l'${escapeHtml(wTeam.name)}</button>
            </div>
        </form>` : '';

    duelEl('duel-results').innerHTML = `
        <div class="duel-verdict ${wTeam ? `team-${wTeam.key}` : ''}">
            <p class="kicker">${kicker}</p>
            <h2 class="duel-winner">${escapeHtml(title)}</h2>
            ${wTeam ? `<p class="duel-winner-team">${escapeHtml(wTeam.name)}</p>` : ''}
            <p class="small">${escapeHtml(margin)}</p>
        </div>
        ${warns.length ? `<p class="banner">${escapeHtml(warns.join(' '))}</p>` : ''}
        ${award}
        <div class="duel-board">${an.map(card).join('')}</div>
        <h2 class="subhead">Les <em>notes</em> de chacun</h2>
        <div class="duel-legend"><span class="ok">Juste</span><span class="mid">Un peu à côté</span><span class="ko">Faux</span></div>
        ${an.map((a, i) => `
            <div class="duel-strip-label"><span>${escapeHtml(a.name)}</span><span>${Math.round(a.score.justesse)} en justesse</span></div>
            <canvas class="duel-canvas" id="duel-cv-${i}" role="img" aria-label="Notes de ${escapeHtml(a.name)} dans le temps"></canvas>`).join('')}
        <p class="hint" style="margin-top: 10px;">${isNaN(sim) ? 'Ressemblance des deux mélodies : trop peu de notes pour la calculer.' : `Ressemblance des deux mélodies : ${Math.round(sim)} % (indicatif, hors note).`}</p>`;
    duelEl('duel-results').hidden = false;
    duelDraw();
    if (winner >= 0 && window.MFX) { window.MFX.fanfare(); if (typeof confetti === 'function') confetti(70); }
    duelEl('duel-results').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function duelDraw() {
    if (!Duel.last || duelEl('duel-results').hidden) return;
    const an = Duel.last.an;
    const T = Math.max(an[0].dur_s, an[1].dur_s, 1);
    const all = [...an[0].notes, ...an[1].notes].map(n => n.med);
    let lo = all.length ? Math.min(...all) - 1.5 : 55, hi = all.length ? Math.max(...all) + 1.5 : 75;
    if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    an.forEach((a, i) => {
        const cv = duelEl(`duel-cv-${i}`);
        if (!cv) return;
        const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        const y = (m) => h - 10 - (m - lo) / (hi - lo) * (h - 20);
        g.font = '11px Inter, system-ui, sans-serif'; g.lineWidth = 1; g.strokeStyle = 'rgba(20,18,26,0.16)'; g.fillStyle = css('--ink-3');
        for (let m = Math.ceil(lo / 12) * 12; m <= hi; m += 12) {
            g.beginPath(); g.moveTo(0, y(m)); g.lineTo(w, y(m)); g.stroke(); g.fillText(duelNoteName(m), 4, y(m) - 3);
        }
        for (const n of a.notes) {
            const dev = n.devc || 0;
            g.fillStyle = dev <= 10 ? css('--success') : dev <= 25 ? css('--gold') : css('--error');
            g.fillRect(n.i * a.hop_s / T * w, y(n.med) - 3, Math.max(2, n.len * a.hop_s / T * w), 6);
        }
    });
}

async function loadDuel() {
    const away = typeof isAway === 'function' && isAway();
    duelEl('duel-away').hidden = !away;
    duelEl('duel-play').hidden = away;
    if (away) return;
    // On ne redessine les deux coins que si les équipes ont changé (pour ne pas perdre une prise en cours)
    const data = await api('/api/teams');
    const key = JSON.stringify(data.teams.map(t => [t.key, t.members.map(m => m.id)]));
    if (key !== Duel.teamsKey || !duelEl('duel-corners').children.length) {
        Duel.teamsKey = key;
        Duel.teams = data.teams.slice(0, 2);
        Duel.takes = [null, null];
        renderDuelCorners();
    }
}
App.loaders.duel = loadDuel;

document.addEventListener('app:ready', () => {
    const section = duelEl('duel');
    if (!section) return;
    section.addEventListener('click', (e) => {
        const rec = e.target.closest('[data-duel-rec]');
        if (rec) duelToggleRec(Number(rec.dataset.duelRec));
    });
    section.addEventListener('change', (e) => {
        const input = e.target.closest('[data-duel-file]');
        if (input) duelLoadTake(Number(input.dataset.duelFile), input.files[0]);
    });
    section.addEventListener('submit', async (e) => {
        if (e.target.id !== 'duel-award') return;
        e.preventDefault();
        const { an, winner } = Duel.last;
        const w = an[winner], l = an[1 - winner];
        try {
            const data = await api('/api/admin/team-events', { method: 'POST', body: {
                label: `Duel de chant : ${w.name} bat ${l.name}`.slice(0, 60),
                team: w.team.key,
                points: Number(duelEl('duel-award-points').value)
            } });
            toast(data.message, 'success');
            e.target.innerHTML = '<p class="kicker blue">Points attribués · visibles dans le classement des équipes</p>';
        } catch (err) { toast(err.message, 'error'); }
    });
    duelEl('duel-go').addEventListener('click', duelRun);
    window.addEventListener('resize', duelDraw);
});
