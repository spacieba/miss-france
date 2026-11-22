/* ============================================================
   Miss Karaoké : duels et solos de chant (épreuve d'équipe)
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

// Hauteur d'une trame (algorithme YIN) : renvoie { f, c } (fréquence en Hz et « flou » de 0 = net à 1 = bruit),
// ou null si rien de périodique. `strict` : seuil des trames nettes ; `loose` : repli pour une voix mêlée de musique.
function duelYinFrame(x, start, W, tauMax, tauMin, sr, strict, loose) {
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
        if (c[tau] < strict) { while (tau + 1 < tauMax - 1 && c[tau + 1] < c[tau]) tau++; found = tau; break; }
        tau++;
    }
    if (found < 0) {
        // Pas de creux net : on prend le meilleur creux s'il reste raisonnable
        let best = -1, bv = loose;
        for (let t = tauMin + 1; t < tauMax - 1; t++) if (c[t] < bv && c[t] <= c[t - 1] && c[t] <= c[t + 1]) { bv = c[t]; best = t; }
        if (best < 0) return null;
        found = best;
    }
    const p = c[found - 1], q = c[found], g = c[found + 1];
    const den = p - 2 * q + g;
    const t = den !== 0 ? found + (p - g) / (2 * den) : found;
    return { f: sr / t, c: q };
}

// Filtre du second ordre (passe-haut ou passe-bas), appliqué en place
function duelBiquad(x, sr, type, f0) {
    const w = 2 * Math.PI * f0 / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.7071);
    let b0, b1, b2;
    if (type === 'high') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; } else { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
        const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
    }
}

// Courbe de hauteur de toute la prise (en demi-tons MIDI, NaN quand personne ne chante)
async function duelAnalyzeVoice(samples, sr, onProgress) {
    const k = Math.max(1, Math.floor(sr / 12000));
    const n2 = Math.floor(samples.length / k);
    const x = new Float32Array(n2);
    for (let i = 0; i < n2; i++) { let s = 0; for (let j = 0; j < k; j++) s += samples[i * k + j]; x[i] = s / k; }
    const sr2 = sr / k;
    // On ne garde que la bande utile à la voix : la basse et la batterie d'un accompagnement
    // (en dessous de ~100 Hz) et les cymbales ou le souffle (au-dessus de ~2 kHz) trompent le suivi.
    duelBiquad(x, sr2, 'high', 100); duelBiquad(x, sr2, 'high', 100); duelBiquad(x, sr2, 'low', 2000);
    const hop = Math.max(1, Math.round(0.02 * sr2));
    const W = Math.round(0.035 * sr2);
    const tauMax = Math.floor(sr2 / 75), tauMin = Math.max(2, Math.floor(sr2 / 900));
    const nF = Math.max(0, Math.floor((n2 - W - tauMax - 2) / hop));
    const rms = new Float32Array(nF);
    for (let f = 0; f < nF; f++) { let s = 0; const st = f * hop; for (let j = 0; j < W; j++) s += x[st + j] * x[st + j]; rms[f] = Math.sqrt(s / W); }
    const sorted = Array.from(rms).sort((a, b) => a - b);
    const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
    const gate = Math.max(1e-4, 0.08 * ref);
    const raw = new Float32Array(nF).fill(NaN);
    const blur = new Float32Array(nF).fill(1);
    let energetic = 0; // trames où l'on entend quelque chose
    for (let f = 0; f < nF; f++) {
        if (rms[f] > gate) {
            energetic++;
            const r = duelYinFrame(x, f * hop, W, tauMax, tauMin, sr2, 0.15, 0.4);
            if (r && r.f >= 75 && r.f <= 900) { raw[f] = 69 + 12 * Math.log2(r.f / 440); blur[f] = r.c; }
        }
        if (onProgress && f % 400 === 0) await onProgress(f / nF);
    }
    // Une trame floue n'est gardée que si elle prolonge ses voisines (sinon c'est l'accompagnement qui parle)
    const m = new Float32Array(nF).fill(NaN);
    for (let f = 0; f < nF; f++) {
        if (isNaN(raw[f])) continue;
        const v = []; for (let j = Math.max(0, f - 2); j <= Math.min(nF - 1, f + 2); j++) if (!isNaN(raw[j])) v.push(raw[j]);
        if (v.length < 3) continue;
        const med = duelMedian(v);
        if (blur[f] > 0.15 && Math.abs(raw[f] - med) > 0.7) continue;
        m[f] = med;
    }
    return { m, hop_s: hop / sr2, dur_s: samples.length / sr, energetic };
}

// Découpe la courbe en notes tenues (au moins 8 trames, soit ~0,16 s).
// Le vibrato est d'abord lissé (moyenne glissante sur ~180 ms, soit un cycle de vibrato) : la hauteur
// d'une note est celle autour de laquelle la voix oscille, pas celle de chaque oscillation.
function duelFindNotes(m, hop_s) {
    const n = m.length;
    const sm = new Float32Array(n).fill(NaN);
    for (let f = 0; f < n; f++) {
        if (isNaN(m[f])) continue;
        let sum = 0, cnt = 0;
        for (let j = Math.max(0, f - 4); j <= Math.min(n - 1, f + 4); j++) if (!isNaN(m[j]) && Math.abs(m[j] - m[f]) < 1.5) { sum += m[j]; cnt++; }
        sm[f] = sum / cnt;
    }
    const notes = []; let i = 0;
    while (i < n) {
        if (isNaN(sm[i])) { i++; continue; }
        const run = [sm[i]]; let j = i + 1, gap = 0;
        while (j < n) {
            if (isNaN(sm[j])) {
                if (gap < 2 && j + 1 < n && !isNaN(sm[j + 1])) { gap++; j++; continue; }
                break;
            }
            if (Math.abs(sm[j] - duelMedian(run.slice(-12))) < 0.6) { run.push(sm[j]); j++; gap = 0; } else break;
        }
        if (run.length >= 8) {
            // On écarte l'attaque (souvent prise par en dessous) et la toute fin pour mesurer la note elle-même
            const body = run.length >= 14 ? run.slice(4, run.length - 2) : run.slice(2);
            const mean = body.reduce((p, q) => p + q, 0) / body.length;
            const sd = Math.sqrt(body.reduce((p, q) => p + (q - mean) * (q - mean), 0) / body.length);
            notes.push({ i, len: j - i, med: duelMedian(body), stdc: sd * 100, dur: run.length * hop_s });
        }
        i = Math.max(j, i + 1);
    }
    return notes;
}

// Barème (version 3), calé sur de vraies prises :
//  - justesse : écart MÉDIAN au demi-ton le plus proche (pondéré par la durée), sur les notes d'au moins 0,2 s,
//    après correction du décalage général de la voix. Les notes très courtes sont des transitions : leur
//    hauteur ne dit rien de la justesse. Repères mesurés : chanteuse professionnelle ≈ 10 cents,
//    prise ratée ≈ 24 cents, hasard = 25 cents. 7 cents ou moins = 100 ; 25 cents ou plus = 0.
//  - stabilité : dérive de la note une fois le vibrato lissé. 8 cents ou moins = 100 ; 24 cents ou plus = 0.
const DUEL_ENGINE = 4;
// Repères réels (moteur v3) : voix professionnelles 12 à 19 cents d'écart et 10 à 12 de dérive ; prise fausse 18 et 18.
// La dérive départage mieux que l'écart : elle pèse donc davantage quand il n'y a pas de référence.
const DUEL_SCALE = { justeFull: 10, justeZero: 25, stableFull: 9, stableZero: 22, minNote: 0.2, fidFree: 0.05, fidZero: 0.8 };
const DUEL_WEIGHTS = { solo: { stabilite: 0.6, justesse: 0.4 }, ref: { fidelite: 0.7, stabilite: 0.2, justesse: 0.1 } };

// Médiane pondérée : la valeur telle que la moitié du temps chanté est en dessous
function duelWeightedMedian(pairs) {
    const p = pairs.slice().sort((x, y) => x[0] - y[0]);
    const total = p.reduce((n, x) => n + x[1], 0);
    let acc = 0;
    for (const [v, w] of p) { acc += w; if (acc >= total / 2) return v; }
    return p.length ? p[p.length - 1][0] : 0;
}

function duelScoreNotes(notes) {
    const n = notes.length;
    const voiced = notes.reduce((a, b) => a + b.dur, 0);
    if (n === 0) return { n: 0, voiced: 0, offsetc: 0, justesse: 0, stabilite: 0, total: 0, low: NaN, high: NaN, devc: 0, driftc: 0 };
    // Seules les notes assez longues servent à juger ; s'il y en a trop peu, on prend tout
    const long = notes.filter(o => o.dur >= DUEL_SCALE.minNote);
    const judged = long.length >= 8 ? long : notes;
    let sx = 0, sy = 0;
    for (const o of judged) { const a = 2 * Math.PI * o.med; sx += o.dur * Math.cos(a); sy += o.dur * Math.sin(a); }
    const offset = Math.atan2(sy, sx) / (2 * Math.PI);
    for (const o of notes) { const xx = o.med - offset; o.devc = Math.abs(xx - Math.round(xx)) * 100; }
    const devc = duelWeightedMedian(judged.map(o => [o.devc, o.dur]));
    const driftc = duelWeightedMedian(judged.map(o => [o.stdc, o.dur]));
    const justesse = 100 * duelClamp01((DUEL_SCALE.justeZero - devc) / (DUEL_SCALE.justeZero - DUEL_SCALE.justeFull));
    const stabilite = 100 * duelClamp01((DUEL_SCALE.stableZero - driftc) / (DUEL_SCALE.stableZero - DUEL_SCALE.stableFull));
    const meds = judged.map(o => o.med);
    return { n, voiced, offsetc: offset * 100, justesse, stabilite, total: DUEL_WEIGHTS.solo.justesse * justesse + DUEL_WEIGHTS.solo.stabilite * stabilite, low: Math.min(...meds), high: Math.max(...meds), devc, driftc };
}

// Courbe mélodique d'une prise : une hauteur toutes les 0,1 s de chant (les silences sont retirés).
// Le vibrato est lissé d'abord (moyenne sur ~180 ms), sinon il compterait comme un écart à la mélodie.
function duelContour(m, hop_s, step) {
    const n = m.length;
    const sm = new Float32Array(n).fill(NaN);
    for (let f = 0; f < n; f++) {
        if (isNaN(m[f])) continue;
        let sum = 0, cnt = 0;
        for (let j = Math.max(0, f - 4); j <= Math.min(n - 1, f + 4); j++) if (!isNaN(m[j]) && Math.abs(m[j] - m[f]) < 1.5) { sum += m[j]; cnt++; }
        sm[f] = sum / cnt;
    }
    const k = Math.max(1, Math.round((step || 0.1) / hop_s)); const out = [];
    for (let i = 0; i < n; i += k) {
        const v = []; for (let j = i; j < Math.min(n, i + k); j++) if (!isNaN(sm[j])) v.push(sm[j]);
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
// Fidélité d'un chanteur à une référence : à quel point sa mélodie suit celle du modèle.
// - le chanteur peut n'avoir chanté qu'un extrait : on cherche le meilleur passage de la référence ;
// - il peut chanter dans une autre tonalité ou une autre octave : on cherche le décalage qui colle le mieux ;
// - il peut être un peu en avance ou en retard : l'alignement est élastique.
// Renvoie { score (0 à 100), cost (écart moyen en demi-tons), shift (transposition trouvée) }.
function duelSubsequenceCost(a, b, shift) {
    const N = a.length, M = b.length;
    let pD = new Float32Array(M + 1), pL = new Int32Array(M + 1); // début libre le long de la référence
    for (let i = 1; i <= N; i++) {
        const cD = new Float32Array(M + 1), cL = new Int32Array(M + 1);
        cD[0] = Infinity;
        const ai = a[i - 1] + shift;
        for (let j = 1; j <= M; j++) {
            let x = ai - b[j - 1]; x = Math.abs(((x + 6) % 12 + 12) % 12 - 6); if (x > 2) x = 2;
            let bd = pD[j - 1], bl = pL[j - 1];
            if (pD[j] < bd) { bd = pD[j]; bl = pL[j]; }
            if (cD[j - 1] < bd) { bd = cD[j - 1]; bl = cL[j - 1]; }
            cD[j] = bd + x; cL[j] = bl + 1;
        }
        pD = cD; pL = cL;
    }
    let best = Infinity; // fin libre le long de la référence
    for (let j = 1; j <= M; j++) { const v = pD[j] / pL[j]; if (v < best) best = v; }
    return best;
}
function duelFidelity(singer, ref) {
    if (singer.length < 10 || ref.length < 10) return { score: NaN, cost: NaN, shift: 0 };
    // Recherche de la transposition : d'abord grossière sur des courbes allégées, puis affinée
    const thin = (c) => c.filter((_, i) => i % 2 === 0);
    const a2 = thin(singer), b2 = thin(ref);
    let bestShift = 0, bestCost = Infinity;
    for (let k = -6; k < 6; k += 0.5) { const c = duelSubsequenceCost(a2, b2, k); if (c < bestCost) { bestCost = c; bestShift = k; } }
    for (const step of [0.25, 0.12, 0.06]) {
        for (const k of [bestShift - step, bestShift + step]) { const c = duelSubsequenceCost(a2, b2, k); if (c < bestCost) { bestCost = c; bestShift = k; } }
    }
    const cost = duelSubsequenceCost(singer, ref, bestShift);
    // Jusqu'à 0,05 demi-ton d'écart moyen : 100. À 0,8 demi-ton : 0 (un tout autre air donne environ 1).
    return { score: 100 * duelClamp01(1 - Math.max(0, cost - DUEL_SCALE.fidFree) / (DUEL_SCALE.fidZero - DUEL_SCALE.fidFree)), cost, shift: bestShift };
}

function duelSimilarity(mA, mB, hop_s) {
    return duelSimilarityContours(duelContour(mA, hop_s), duelContour(mB, hop_s));
}

const DUEL_CLEAR = { ref: 0.35, good: 0.5, poor: 0.3 };

// Qualité d'une prise de référence : sur une voix seule, presque tout ce qui est audible porte une note nette ;
// sur une chanson avec accompagnement, le détecteur décroche et la couverture s'effondre.
function duelRefQuality(analysis, notes) {
    const held = notes.reduce((n, o) => n + o.len, 0);
    const coverage = analysis.energetic ? held / analysis.energetic : 0;
    const voiced = notes.reduce((n, o) => n + o.dur, 0);
    return { coverage, notes: notes.length, voiced, ok: notes.length >= 8 && voiced >= 5 && coverage >= DUEL_CLEAR.ref };
}

// Netteté d'une prise de chanteur : la voix ressort-elle assez par rapport à la musique et au bruit ?
function duelTakeClarity(analysis, notes) {
    const q = duelRefQuality(analysis, notes);
    const level = q.notes < 8 || q.voiced < 5 || q.coverage < DUEL_CLEAR.poor ? 'poor' : q.coverage < DUEL_CLEAR.good ? 'fair' : 'good';
    return { ...q, level };
}

// Note finale.
// Avec référence : fidélité à la mélodie 70 %, stabilité 20 %, justesse 10 %. C'est la formule fiable.
// Sans référence : stabilité 60 %, justesse 40 %. Note indicative seulement : sans modèle, on ne peut pas
// savoir si la bonne mélodie est chantée, et même une voix professionnelle n'y atteint pas 100.
function duelFinalTotal(score, fidelite) {
    if (!score.n) return 0;
    if (fidelite === null || fidelite === undefined || isNaN(fidelite)) return DUEL_WEIGHTS.solo.stabilite * score.stabilite + DUEL_WEIGHTS.solo.justesse * score.justesse;
    return DUEL_WEIGHTS.ref.fidelite * fidelite + DUEL_WEIGHTS.ref.stabilite * score.stabilite + DUEL_WEIGHTS.ref.justesse * score.justesse;
}
// DUEL-CORE-END

// ---------- Interface ----------
// Tout le monde consulte les résultats publiés ; seul l'admin a l'onglet « Capture »
// (enregistrement des voix sur son téléphone, analyse, publication).
// Trois formules : duel sur la même chanson, duel où chacun a sa chanson, passage en solo.

const Duel = {
    teams: [], teamsKey: '', mode: 'same',   // 'same' | 'diff' | 'solo'
    takes: {}, rec: {}, refData: {},         // prises et références, rangées par emplacement
    preview: null, busy: false, view: 'results', list: [], listKey: '', refs: []
};
const DUEL_MAX_SECONDS = 240;
const DUEL_MODES = { same: 'Duel · même chanson', diff: 'Duel · deux chansons', solo: 'Solo' };

const duelEl = (id) => document.getElementById(id);
const duelIsRef = (slot) => String(slot).startsWith('ref');
const duelStatus = (slot, text) => { const el = duelEl(`duel-status-${slot}`); if (el) el.textContent = text; };
const duelCents = (c) => { const r = Math.round(c); return `${r > 0 ? '+' : ''}${r} cents`; };
const duelSingers = () => (Duel.mode === 'solo' ? [0] : [0, 1]);
// Référence d'un chanteur : commune en « même chanson », propre à chacun sinon
const duelRefKey = (i) => (Duel.mode === 'same' ? 'ref' : `ref${i}`);
const duelAllPlayers = () => Duel.teams.flatMap(t => t.members.map(m => ({ ...m, team: t })));

function duelSingerInfo(i) {
    const sel = duelEl(`duel-singer-${i}`);
    const picked = sel && sel.value ? sel.options[sel.selectedIndex].textContent : '';
    if (Duel.mode === 'solo') {
        const p = sel && sel.value ? duelAllPlayers().find(x => String(x.id) === sel.value) : null;
        return { name: picked || 'Chanteur', team: p ? p.team.key : null };
    }
    const t = Duel.teams[i];
    return { name: picked || (t ? t.short || t.name : `Chanteur ${i + 1}`), team: t ? t.key : null };
}

// ---------- Résultat d'un passage (aperçu de l'admin et résultats publiés) ----------

function duelResultHtml(d, { canvasKey, admin = false, preview = false } = {}) {
    const solo = d.mode === 'solo';
    const [A, B] = d.singers;
    const withRef = d.singers.every(s => s.fidelite !== null && s.fidelite !== undefined);
    const w = solo ? A : d.winner >= 0 ? d.singers[d.winner] : null;
    const wTeam = w ? teamInfo(w.team) : null;
    let kicker, title, margin;
    if (solo) {
        kicker = 'Passage en solo'; title = A.name;
        margin = A.n ? `${Math.round(A.total)} sur 100` : 'Aucune voix détectée : la prise était trop faible pour être analysée.';
    } else if (A.n === 0 && B.n === 0) { kicker = 'Résultat'; title = 'Aucune voix détectée'; margin = 'Les prises étaient trop faibles pour être analysées.'; }
    else if (!w) { kicker = 'Résultat'; title = 'Match nul'; margin = `Moins de 3 points d'écart : ${Math.round(A.total)} contre ${Math.round(B.total)}.`; }
    else {
        const l = d.singers[1 - d.winner];
        kicker = 'Le vainqueur du duel'; title = w.name;
        margin = `${Math.round(Math.abs(A.total - B.total))} points d'avance sur ${l.name} (${Math.round(w.total)} contre ${Math.round(l.total)}).`;
    }
    const commonSong = d.song || (!d.different && A.song) || '';
    const warns = [];
    for (const a of d.singers) {
        if (a.n < 8 || a.voiced < 5) warns.push(`Peu de notes exploitables pour ${a.name} (${a.n} notes, ${Number(a.voiced).toFixed(1)} s) : son score est peu fiable.`);
    }
    if (!solo && !d.different && !withRef && d.sim !== null && d.sim !== undefined && d.sim < 55) warns.push(`Les deux mélodies se ressemblent peu (${Math.round(d.sim)} %). Ont-ils chanté le même passage ?`);

    const card = (a, i) => {
        const t = teamInfo(a.team);
        const crits = [...(withRef ? [['Fidélité à la mélodie', a.fidelite]] : []), ['Justesse', a.justesse], ['Stabilité', a.stabilite]];
        const facts = [['Notes analysées', `${a.n} (${Math.round(a.voiced)} s tenues)`]];
        if (a.n) { facts.push(['Tessiture', `${duelNoteName(a.low)} à ${duelNoteName(a.high)}`]); facts.push(['Écart au diapason', duelCents(a.offsetc)]); }
        const sub = [t ? t.name : '', d.different && a.song ? `« ${a.song} »` : ''].filter(Boolean).join(' · ');
        return `
        <article class="duel-card ${t ? `team-${t.key}` : ''} ${!solo && d.winner === i ? 'win' : ''}">
            <header><span class="serif">${escapeHtml(a.name)}</span><span class="duel-total">${Math.round(a.total)}<small> / 100</small></span></header>
            ${sub ? `<span class="small muted">${escapeHtml(sub)}</span>` : ''}
            ${crits.map(([lab, val]) => `
                <div class="duel-crit"><div class="row"><span>${lab}</span><b>${Math.round(val)}</b></div><div class="duel-bar"><i style="width:${Math.round(val)}%"></i></div></div>`).join('')}
            <dl class="duel-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
        </article>`;
    };

    const refNames = [...new Set(d.singers.map(s => s.ref).filter(Boolean))];
    const footer = withRef
        ? `Noté par rapport à ${d.different ? 'la référence de chaque chanson' : `la référence${refNames.length ? ` « ${escapeHtml(refNames[0])} »` : ''}`} : fidélité à la mélodie 70 %, stabilité 20 %, justesse 10 %.`
        : `Note indicative, sans mélodie de référence : stabilité 60 %, justesse 40 %. Pour une note fiable, ajoute la voix d'origine comme référence.${d.different ? ' Chacun a chanté sa propre chanson.' : ''}${!solo && !d.different && d.sim !== null && d.sim !== undefined ? ` Ressemblance des deux mélodies : ${Math.round(d.sim)} % (indicatif).` : ''}`;

    return `
        <div class="duel-verdict ${wTeam ? `team-${wTeam.key}` : ''}">
            <p class="kicker">${kicker}${commonSong ? ` · ${escapeHtml(commonSong)}` : ''}</p>
            <h3 class="duel-winner">${escapeHtml(title)}</h3>
            ${wTeam ? `<p class="duel-winner-team">${escapeHtml(wTeam.name)}${d.awarded ? ` · +${d.awarded} pts` : ''}</p>` : ''}
            <p class="small">${escapeHtml(margin)}</p>
        </div>
        ${warns.length ? `<p class="banner">${escapeHtml(warns.join(' '))}</p>` : ''}
        <div class="duel-board ${solo ? 'solo' : ''}">${d.singers.map(card).join('')}</div>
        <div class="duel-legend"><span class="ok">Juste</span><span class="mid">Un peu à côté</span><span class="ko">Faux</span></div>
        ${d.singers.map((a, i) => `
            <div class="duel-strip-label"><span>${escapeHtml(a.name)}</span><span>${Math.round(a.justesse)} en justesse</span></div>
            <canvas class="duel-canvas" data-duel-canvas="${canvasKey}:${i}" role="img" aria-label="Notes de ${escapeHtml(a.name)} dans le temps"></canvas>`).join('')}
        <p class="hint" style="margin-top: 10px;">${footer}</p>
        ${admin && !preview ? `<button type="button" class="btn btn-ghost btn-sm" data-duel-delete="${d.id}">Supprimer ce passage${d.awarded ? ' et ses points' : ''}</button>` : ''}`;
}

function duelDrawAll() {
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    document.querySelectorAll('[data-duel-canvas]').forEach(cv => {
        if (!cv.clientWidth) return;
        const [key, idx] = cv.dataset.duelCanvas.split(':');
        const d = key === 'preview' ? Duel.preview : Duel.list.find(x => String(x.id) === key);
        if (!d) return;
        const a = d.singers[Number(idx)];
        const T = Math.max(...d.singers.map(s => s.dur || 0), 1);
        const all = d.singers.flatMap(s => s.notes.map(n => n[2]));
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
        box.innerHTML = `<p class="empty">Aucun passage pour l'instant. Les résultats s'afficheront ici dès que le premier sera publié.</p>`;
        return;
    }
    const admin = App.user.isAdmin;
    const duels = list.filter(d => d.mode !== 'solo');
    const solos = list.filter(d => d.mode === 'solo').sort((a, b) => b.singers[0].total - a.singers[0].total || a.id - b.id);

    const duelsHtml = !duels.length ? '' : `
        <p class="kicker">Le dernier duel</p>
        <div class="duel-result">${duelResultHtml(duels[0], { canvasKey: duels[0].id, admin })}</div>
        ${duels.length > 1 ? `<h2 class="subhead">Les duels <em>précédents</em></h2>${duels.slice(1).map(d => {
            const w = d.winner >= 0 ? d.singers[d.winner] : null;
            return `<details class="duel-past"><summary><span class="serif">${escapeHtml(d.singers[0].name)} <em>vs</em> ${escapeHtml(d.singers[1].name)}</span><span class="small muted">${w ? `${escapeHtml(w.name)} gagne ${Math.round(w.total)} à ${Math.round(d.singers[1 - d.winner].total)}` : 'Match nul'}${d.song ? ` · ${escapeHtml(d.song)}` : ''}</span></summary>
                <div class="duel-result">${duelResultHtml(d, { canvasKey: d.id, admin })}</div></details>`;
        }).join('')}` : ''}`;

    let rank = 0;
    const solosHtml = !solos.length ? '' : `
        <h2 class="subhead">Le classement des <em>solos</em></h2>
        ${solos.map((d, i) => {
            const s = d.singers[0];
            if (i === 0 || Math.round(s.total) !== Math.round(solos[i - 1].singers[0].total)) rank = i + 1;
            const t = teamInfo(s.team);
            return `<details class="duel-past duel-solo ${d.id === list[0].id ? 'latest' : ''}"><summary>
                    <span class="duel-solo-row"><span class="r">${rank}</span><span class="serif">${escapeHtml(s.name)}${t ? ` <span class="away-tag team-tag team-${t.key}">${escapeHtml(t.short || t.name)}</span>` : ''}</span><span class="p">${Math.round(s.total)}<small> / 100</small></span></span>
                    <span class="small muted">${[s.song ? `« ${escapeHtml(s.song)} »` : '', d.awarded ? `+${d.awarded} pts pour son équipe` : '', d.id === list[0].id ? 'dernier passage' : ''].filter(Boolean).join(' · ') || 'Voir le détail'}</span>
                </summary><div class="duel-result">${duelResultHtml(d, { canvasKey: d.id, admin })}</div></details>`;
        }).join('')}`;

    // Le dernier passage publié s'affiche en premier, duel ou solo
    box.innerHTML = list[0].mode === 'solo' ? solosHtml + duelsHtml : duelsHtml + solosHtml;
    duelDrawAll();
    if (fresh && Duel.view === 'results' && window.MFX) { window.MFX.fanfare(); if (typeof confetti === 'function') confetti(60); }
}

// ---------- Onglet Capture (admin) ----------

function duelRecHtml(slot) {
    const ref = duelIsRef(slot);
    return `
        <div class="duel-rec">
            <button type="button" class="btn btn-ghost btn-sm" data-duel-rec="${slot}">${ref ? 'Enregistrer la référence' : 'Enregistrer au micro'}</button>
            <span class="duel-timer" id="duel-timer-${slot}"></span>
            <div class="duel-meter" id="duel-meterbox-${slot}" hidden><i id="duel-meter-${slot}"></i></div>
        </div>
        <audio id="duel-audio-${slot}" controls hidden></audio>
        <p class="small muted duel-status" id="duel-status-${slot}" aria-live="polite">${ref ? 'Pas de référence.' : 'Aucune prise.'}</p>
        <label class="btn-link duel-import">ou importer un fichier audio<input type="file" data-duel-file="${slot}" accept="audio/*,video/*" hidden></label>
        <a class="btn-link duel-import" id="duel-dl-${slot}" hidden>Télécharger cette prise</a>`;
}

function duelRefOptions(key) {
    const current = Duel.refData[key] && Duel.refData[key].id ? String(Duel.refData[key].id) : '';
    return `<option value="">${Duel.refs.length ? 'Sans référence enregistrée' : 'Aucune référence enregistrée'}</option>`
        + Duel.refs.map(r => `<option value="${r.id}" ${String(r.id) === current ? 'selected' : ''}>${escapeHtml(r.title)}</option>`).join('');
}

function duelRefHtml(key, { compact = false } = {}) {
    return `
        <div class="duel-ref ${compact ? 'compact' : ''}">
            <p class="duel-team">${compact ? 'Sa référence' : 'La référence'} <span class="small muted">· facultative</span></p>
            ${compact ? '' : `<p class="hint">Une version où l'on n'entend que la voix : un fichier a cappella, ou quelqu'un qui chante juste le passage sans musique. Avec elle, la note mesure surtout si le chanteur suit la mélodie du modèle : c'est la formule fiable. Sans elle, la note reste indicative.</p>`}
            <select class="input" data-duel-ref-select="${key}" aria-label="Référence enregistrée" ${Duel.refs.length ? '' : 'hidden'}>${duelRefOptions(key)}</select>
            ${duelRecHtml(key)}
            <div class="duel-ref-save" id="duel-ref-save-${key}" hidden>
                <input type="text" class="input" id="duel-ref-title-${key}" maxlength="60" placeholder="Titre pour la garder" autocomplete="off">
                <button type="button" class="btn btn-ghost btn-sm" data-duel-ref-keep="${key}">Garder cette référence</button>
            </div>
        </div>`;
}

function renderDuelCapture() {
    const mode = Duel.mode;
    const songField = (id, label) => `
        <label class="field">${label}
            <input type="text" class="input" id="${id}" maxlength="60" placeholder="Titre de la chanson" autocomplete="off">
        </label>`;
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
            ${mode === 'diff' ? songField(`duel-song-${i}`, 'Sa chanson (facultatif)') : ''}
            ${duelRecHtml(String(i))}
            ${mode === 'diff' ? duelRefHtml(`ref${i}`, { compact: true }) : ''}
        </article>`;
    };
    const soloCorner = () => `
        <article class="duel-corner">
            <p class="duel-team">Le chanteur</p>
            <select class="input" id="duel-singer-0" aria-label="Chanteur">
                <option value="">${duelAllPlayers().length ? 'Choisir le chanteur' : 'Aucun joueur sur place'}</option>
                ${Duel.teams.map(t => `<optgroup label="${escapeHtml(t.name)}">${t.members.map(m => `<option value="${m.id}">${escapeHtml(m.pseudo)}</option>`).join('')}</optgroup>`).join('')}
            </select>
            ${songField('duel-song-0', 'Sa chanson (facultatif)')}
            ${duelRecHtml('0')}
        </article>`;

    duelEl('duel-capture').innerHTML = `
        <div class="duel-modes" role="group" aria-label="Formule">
            ${Object.entries(DUEL_MODES).map(([k, label]) => `<button type="button" class="chip ${k === mode ? 'active' : ''}" data-duel-mode="${k}">${label}</button>`).join('')}
        </div>
        <p class="hint">${mode === 'same' ? 'Un chanteur par équipe, sur le même passage de la même chanson.'
            : mode === 'diff' ? 'Un chanteur par équipe, chacun sur sa chanson. Choisis deux titres de difficulté comparable.'
            : 'Les chanteurs passent un par un. Chaque passage publié entre dans le classement des solos.'}</p>
        ${mode === 'same' ? songField('duel-song-all', 'Chanson (facultatif)') + duelRefHtml('ref') : ''}
        <div class="duel-corners ${mode === 'solo' ? 'solo' : ''}">${mode === 'solo' ? soloCorner() : corner(0) + corner(1)}</div>
        ${mode === 'solo' ? duelRefHtml('ref0') : ''}
        <button type="button" class="btn btn-blue btn-block btn-between" id="duel-go" disabled><span id="duel-go-label">${mode === 'solo' ? 'Noter le passage' : 'Lancer le duel'}</span>${ARROW}</button>
        <div id="duel-preview" hidden></div>`;
    duelCheckReady();
}

function duelSetMode(mode) {
    if (mode === Duel.mode || Duel.busy) return;
    if (Object.values(Duel.rec).some(Boolean)) return toast('Arrête d\'abord l\'enregistrement en cours.', 'error');
    if (Object.values(Duel.takes).some(Boolean) && !confirm('Changer de formule efface les prises en cours. Continuer ?')) return;
    Duel.mode = mode;
    Duel.takes = {}; Duel.refData = {}; Duel.preview = null;
    renderDuelCapture();
}

function duelCheckReady() {
    const go = duelEl('duel-go');
    if (go) go.disabled = Duel.busy || !duelSingers().every(i => Duel.takes[String(i)]);
}

// Décode une prise (enregistrement ou fichier importé) en échantillons mono
async function duelLoadTake(slot, file) {
    if (!file) return;
    Duel.takes[slot] = null; duelCheckReady();
    const st = duelEl(`duel-status-${slot}`); if (st) st.classList.remove('good', 'fair', 'poor');
    if (duelIsRef(slot)) {
        Duel.refData[slot] = null;
        duelEl(`duel-ref-save-${slot}`).hidden = true;
        const sel = document.querySelector(`[data-duel-ref-select="${slot}"]`); if (sel) sel.value = '';
    }
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
        // Lien de téléchargement : pour garder une prise, ou l'envoyer afin de régler le barème
        const dl = duelEl(`duel-dl-${slot}`);
        if (dl) {
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            dl.href = player.src;
            dl.download = `karaoke-${duelIsRef(slot) ? 'reference' : 'chanteur'}-${stamp}.${(file.name.split('.').pop() || 'webm').toLowerCase()}`;
            dl.hidden = false;
        }
        const secs = Math.round(audio.duration);
        const length = `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s${audio.duration > DUEL_MAX_SECONDS ? ' (limitée aux 4 premières minutes)' : ''}`;
        if (duelIsRef(slot)) await duelPrepareRef(slot, length);
        else await duelCheckTake(slot, length);
    } catch {
        duelStatus(slot, 'Cette prise ne peut pas être lue. Réessaie, ou importe un fichier mp3, m4a ou wav.');
    }
    duelCheckReady();
}

// Analyse la prise d'un chanteur dès qu'elle est faite : on sait tout de suite si la voix ressort assez
async function duelCheckTake(slot, length) {
    const take = Duel.takes[slot];
    const a = await duelAnalyzeVoice(take.samples, take.sr, async (p) => { duelStatus(slot, `Vérification de la prise… ${Math.round(p * 100)} %`); await new Promise(r => setTimeout(r, 0)); });
    a.notes = duelFindNotes(a.m, a.hop_s);
    take.analysis = a;
    const c = duelTakeClarity(a, a.notes);
    const pct = Math.round(c.coverage * 100);
    // Mesures brutes, affichées pour pouvoir vérifier et régler le barème
    const sc = duelScoreNotes(a.notes);
    const raw = sc.n ? ` Écart médian au demi-ton : ${Math.round(sc.devc)} cents · dérive des notes : ${Math.round(sc.driftc)} cents (moteur v${DUEL_ENGINE}).` : '';
    const el = duelEl(`duel-status-${slot}`);
    el.classList.remove('good', 'fair', 'poor'); el.classList.add(c.level);
    el.textContent = c.level === 'good' ? `Prise nette · ${length} · ${c.notes} notes (voix nette sur ${pct} % de la prise).${raw}`
        : c.level === 'fair' ? `Prise moyenne · ${length} · ${c.notes} notes (voix nette sur ${pct} %). Utilisable, mais plus près du micro ou la musique moins fort, ce serait mieux.${raw}`
        : `Prise brouillée · ${c.notes} notes (voix nette sur ${pct} %). La musique ou le bruit couvre la voix : recommence, le téléphone tout près de la bouche.`;
}

// Analyse une référence tout de suite, pour dire si elle est exploitable
async function duelPrepareRef(key, length) {
    duelStatus(key, 'Analyse de la référence…');
    const take = Duel.takes[key];
    const a = await duelAnalyzeVoice(take.samples, take.sr, async (p) => { duelStatus(key, `Analyse de la référence… ${Math.round(p * 100)} %`); await new Promise(r => setTimeout(r, 0)); });
    const notes = duelFindNotes(a.m, a.hop_s);
    const q = duelRefQuality(a, notes);
    if (!q.ok) {
        Duel.refData[key] = null;
        duelStatus(key, `Référence inexploitable (${q.notes} notes nettes, ${Math.round(q.coverage * 100)} % de la prise) : on n'y entend pas une voix seule. Le passage sera noté sans référence.`);
        return;
    }
    Duel.refData[key] = { id: null, title: null, contour: duelContour(a.m, a.hop_s) };
    duelStatus(key, `Référence prête · ${length} · ${q.notes} notes nettes (${Math.round(q.coverage * 100)} % de la prise).`);
    duelEl(`duel-ref-save-${key}`).hidden = false;
}

const DUEL_MIC_MSG = "Le micro n'est pas accessible. Autorise-le dans le navigateur (cadenas à côté de l'adresse), ou enregistre avec le Dictaphone du téléphone puis importe le fichier.";

async function duelToggleRec(slot) {
    const btn = document.querySelector(`[data-duel-rec="${slot}"]`);
    if (Duel.rec[slot]) { Duel.rec[slot].stop(); return; }
    if (Object.values(Duel.rec).some(Boolean)) return toast('Un autre enregistrement est en cours.', 'error');
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
    duelStatus(slot, duelIsRef(slot) ? 'Enregistrement de la référence…' : 'Enregistrement en cours… chante, le téléphone près de la bouche !');
}

async function duelRun() {
    const who = duelSingers();
    if (Duel.busy || !who.every(i => Duel.takes[String(i)])) return;
    Duel.busy = true; duelCheckReady();
    const label = duelEl('duel-go-label');
    const mode = Duel.mode;
    duelEl('duel-preview').hidden = true;
    try {
        const raw = [];
        for (const i of who) {
            const info = duelSingerInfo(i);
            const take = Duel.takes[String(i)];
            // La prise a déjà été analysée à l'enregistrement : on réutilise le résultat
            const a = take.analysis || await duelAnalyzeVoice(take.samples, take.sr, async (p) => {
                label.textContent = `Analyse de ${info.name}… ${Math.round(p * 100)} %`;
                await new Promise(r => setTimeout(r, 0));
            });
            a.notes = a.notes || duelFindNotes(a.m, a.hop_s);
            a.score = duelScoreNotes(a.notes);
            a.info = info;
            raw.push(a);
        }
        const songOf = (i) => { const el = duelEl(mode === 'same' ? 'duel-song-all' : `duel-song-${i}`); return el ? el.value.trim() : ''; };
        const singers = raw.map((a, k) => {
            const i = who[k];
            const ref = Duel.refData[duelRefKey(i)] || null;
            const fd = ref && a.score.n ? duelFidelity(duelContour(a.m, a.hop_s), ref.contour) : null;
            const fidelite = !fd || isNaN(fd.score) ? null : fd.score;
            return {
                name: a.info.name, team: a.info.team, song: songOf(i) || null, ref: fidelite !== null ? (ref.title || 'prise du soir') : null,
                total: 0, justesse: a.score.justesse, stabilite: a.score.stabilite, fidelite,
                n: a.score.n, voiced: a.score.voiced, low: a.score.n ? a.score.low : null, high: a.score.n ? a.score.high : null,
                offsetc: a.score.offsetc, dur: a.dur_s, devc: a.score.devc, driftc: a.score.driftc, fidcost: fidelite === null ? null : fd.cost, engine: DUEL_ENGINE,
                notes: a.notes.slice(0, 800).map(n => [Math.round(n.i * a.hop_s * 100) / 100, Math.round(n.len * a.hop_s * 100) / 100, Math.round(n.med * 100) / 100, Math.round(n.devc || 0)])
            };
        });
        // Dans un duel, la référence ne compte que si les deux chanteurs ont pu être comparés à la leur :
        // sinon l'un serait noté sur trois critères et l'autre sur deux.
        if (singers.some(s => s.fidelite === null)) singers.forEach(s => { s.fidelite = null; s.ref = null; });
        singers.forEach((s, k) => { s.total = duelFinalTotal(raw[k].score, s.fidelite); });

        const preview = { mode: mode === 'solo' ? 'solo' : 'duel', different: mode === 'diff', song: mode === 'same' ? songOf(0) : '', ref: singers[0].ref, sim: null, winner: -1, singers };
        if (mode !== 'solo') {
            if (mode === 'same') { const sim = duelSimilarity(raw[0].m, raw[1].m, raw[0].hop_s); preview.sim = isNaN(sim) ? null : sim; }
            const diff = singers[0].total - singers[1].total;
            preview.winner = (singers[0].n === 0 && singers[1].n === 0) || Math.abs(diff) < 3 ? -1 : diff > 0 ? 0 : 1;
        }
        Duel.preview = preview;
        renderDuelPreview();
    } catch (err) {
        toast(`Erreur pendant l'analyse : ${err.message}`, 'error');
    }
    label.textContent = mode === 'solo' ? 'Noter à nouveau' : 'Relancer le duel';
    Duel.busy = false; duelCheckReady();
}

function renderDuelPreview() {
    const d = Duel.preview;
    const solo = d.mode === 'solo';
    const w = solo ? d.singers[0] : d.winner >= 0 ? d.singers[d.winner] : null;
    const wTeam = w ? teamInfo(w.team) : null;
    const box = duelEl('duel-preview');
    box.innerHTML = `
        <p class="kicker" style="margin-top: 22px;">Aperçu · pas encore publié</p>
        <div class="duel-result">${duelResultHtml(d, { canvasKey: 'preview', preview: true })}</div>
        <form class="duel-award" id="duel-publish">
            <p class="kicker">Publier pour tout le monde</p>
            ${wTeam ? `<label class="field">Points pour l'${escapeHtml(wTeam.name)} (0 pour aucun)
                <input type="number" class="input" id="duel-points" value="${solo ? 0 : 10}" min="0" step="1"></label>`
                : `<p class="hint">${solo ? 'Chanteur sans équipe' : 'Pas de vainqueur rattaché à une équipe'} : aucun point ne sera attribué.</p>`}
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
        Duel.takes = {}; Duel.refData = {}; Duel.preview = null;
        renderDuelCapture();
    }
}
App.loaders.duel = loadDuel;

document.addEventListener('app:ready', () => {
    const section = duelEl('duel');
    if (!section) return;
    section.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-duel-view]');
        if (tab) return duelShow(tab.dataset.duelView);
        const mode = e.target.closest('[data-duel-mode]');
        if (mode) return duelSetMode(mode.dataset.duelMode);
        const rec = e.target.closest('[data-duel-rec]');
        if (rec) return duelToggleRec(rec.dataset.duelRec);
        if (e.target.closest('#duel-go')) return duelRun();
        const keep = e.target.closest('[data-duel-ref-keep]');
        if (keep) {
            const key = keep.dataset.duelRefKeep;
            const title = duelEl(`duel-ref-title-${key}`).value.trim();
            if (!title) return toast('Donne un titre à la référence.', 'error');
            if (!Duel.refData[key]) return;
            try {
                const data = await api('/api/admin/duel-refs', { method: 'POST', body: { title, contour: Duel.refData[key].contour } });
                toast(data.message, 'success');
                Duel.refData[key].id = data.id; Duel.refData[key].title = title;
                Duel.refs = await api('/api/admin/duel-refs');
                document.querySelectorAll('[data-duel-ref-select]').forEach(sel => { sel.innerHTML = duelRefOptions(sel.dataset.duelRefSelect); sel.hidden = !Duel.refs.length; });
                duelEl(`duel-ref-save-${key}`).hidden = true;
            } catch (err) { toast(err.message, 'error'); }
            return;
        }
        const del = e.target.closest('[data-duel-delete]');
        if (del) {
            if (!confirm('Supprimer ce passage ?\n\nS\'il avait rapporté des points à une équipe, ils sont retirés.')) return;
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
        const sel = e.target.closest('[data-duel-ref-select]');
        if (sel) {
            const key = sel.dataset.duelRefSelect;
            Duel.takes[key] = null; duelEl(`duel-ref-save-${key}`).hidden = true; duelEl(`duel-audio-${key}`).hidden = true;
            if (!sel.value) { Duel.refData[key] = null; duelStatus(key, 'Pas de référence.'); return; }
            try {
                const r = await api(`/api/admin/duel-refs/${sel.value}`);
                Duel.refData[key] = { id: r.id, title: r.title, contour: r.contour };
                duelStatus(key, `Référence « ${r.title} » chargée.`);
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
            const data = await api('/api/admin/duels', { method: 'POST', body: { song: d.song || (d.mode === 'solo' ? d.singers[0].song : '') || '', points: pts ? Number(pts.value) : 0, result: d } });
            toast(data.message, 'success');
            Duel.preview = null;
            // En solo, on enchaîne : la capture est remise à blanc pour le chanteur suivant
            if (d.mode === 'solo') { Duel.takes = {}; const keepRef = Duel.refData.ref0; Duel.refData = {}; renderDuelCapture(); if (keepRef && keepRef.id) { Duel.refData.ref0 = keepRef; const s = document.querySelector('[data-duel-ref-select="ref0"]'); if (s) s.value = String(keepRef.id); duelStatus('ref0', `Référence « ${keepRef.title} » conservée.`); } }
            else duelEl('duel-preview').hidden = true;
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
