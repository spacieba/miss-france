/* ============================================================
   En direct : révélations plein écran quand l'admin publie un résultat,
   statistiques du comité, sons et vibrations
   ============================================================ */

// ---------- Sons (synthétisés, aucun fichier) & vibrations ----------

const MFX = (() => {
    let ctx = null;
    const unlock = () => {
        if (ctx) return;
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { once: true, passive: true }));

    const on = () => (typeof fxEnabled === 'function' ? fxEnabled() : true);
    const vibrate = (pattern) => { if (on() && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignoré */ } } };

    function note(freq, start, duration, { type = 'sine', gain = 0.12 } = {}) {
        if (!ctx || !on()) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const t = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.05);
    }

    return {
        tap() { vibrate(8); },
        ding() { note(1318.5, 0, 0.5, { type: 'triangle' }); vibrate(20); },
        good() { note(880, 0, 0.18, { type: 'triangle' }); note(1318.5, 0.09, 0.35, { type: 'triangle' }); vibrate([20, 40, 30]); },
        bad() { note(220, 0, 0.3, { type: 'sine', gain: 0.1 }); vibrate(60); },
        fanfare() {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.12, 0.5, { type: 'triangle', gain: 0.11 }));
            note(1567.98, 0.55, 0.9, { type: 'sine', gain: 0.08 });
            vibrate([80, 60, 80, 60, 220]);
        }
    };
})();
window.MFX = MFX;

// ---------- Confettis (couleurs de la maison) ----------

function confetti(amount = 70) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#1F3FBF', '#14121A', '#A8844C', '#E3E7F7', '#F7F2EE'];
    for (let i = 0; i < amount; i++) {
        const p = document.createElement('i');
        p.style.left = `${Math.random() * 100}%`;
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = `${2.2 + Math.random() * 2}s`;
        p.style.animationDelay = `${Math.random() * 0.6}s`;
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        if (i % 3 === 0) { p.style.width = '6px'; p.style.height = '6px'; p.style.borderRadius = '50%'; }
        box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5200);
}

// ---------- Révélation plein écran ----------

const nameShort = (n) => `Miss ${regionOf(n)}`;

function statLine(p, text) {
    return `<li><span class="p">${p}</span><span>${text}</span></li>`;
}

function buildRevealStats(data) {
    const s = data.stats || {};
    const lines = [];
    if (!s.players) return '';
    if (data.step === 1 || data.step === 2) {
        const size = data.step === 1 ? SEMI() : 5;
        const fav = (s.favorites || [])[0];
        if (fav) {
            lines.push(statLine(`${fav.pct}%`, `d'entre vous avaient choisi <strong>${escapeHtml(nameShort(fav.name))}</strong>, la favorite du comité : ${fav.qualified ? 'elle passe !' : '<strong>elle est éliminée</strong>.'}`));
        }
        const surprise = (s.qualified || [])[0];
        if (surprise && surprise.pct < 50) {
            lines.push(statLine(`${surprise.pct}%`, surprise.pct === 0
                ? `Personne n'avait vu <strong>${escapeHtml(nameShort(surprise.name))}</strong> dans le Top ${size}. La surprise de la soirée !`
                : `Seulement ${surprise.pct} % avaient misé sur <strong>${escapeHtml(nameShort(surprise.name))}</strong>, et pourtant elle y est.`));
        }
        const flop = (s.favorites || []).find(f => !f.qualified);
        if (flop && flop !== fav) {
            lines.push(statLine(`${flop.pct}%`, `croyaient en <strong>${escapeHtml(nameShort(flop.name))}</strong>… éliminée.`));
        }
        lines.push(statLine(`${s.best}/${size}`, `le meilleur score du comité${s.bestCount > 1 ? ` (${s.bestCount} ex-æquo)` : ''}. Moyenne : ${s.average}.`));
    } else if (data.step === 3) {
        lines.push(statLine(`${s.winnerPct}%`, `d'entre vous l'avaient en prono d'or${s.pronoOrWinners ? ` : ${s.pronoOrWinners} joueur(s) empochent 80 points` : '. Personne ne l\'avait vue venir !'}`));
        const fav = (s.favorites || [])[0];
        if (fav && fav.name !== s.winner) {
            lines.push(statLine(`${fav.pct}%`, `misaient sur <strong>${escapeHtml(nameShort(fav.name))}</strong>, la favorite du comité.`));
        }
        lines.push(statLine(String(s.exactPodium), s.exactPodium ? 'joueur(s) avec le podium parfait. Respect.' : 'podium parfait. Le jury était dur cette année.'));
    }
    return `<p class="kicker">Le comité en chiffres · ${s.players} pronostics</p><ul class="reveal-stats">${lines.join('')}</ul>`;
}

function showReveal(data) {
    document.querySelectorAll('.reveal').forEach(r => r.remove());
    const me = data.me || {};
    const year = data.year || App.edition.year;
    let title = '', gainText = '', visual = '';

    if (data.step === 1 || data.step === 2) {
        const list = data.step === 1 ? data.official.top15 : data.official.top5;
        const size = list.length;
        title = `Le <em>Top ${size}</em><br>est tombé`;
        if (me.hasProno && me.picks) {
            gainText = `Tu en avais trouvé <strong>${me.correct.length}</strong> sur ${me.picks}`;
            if (me.bonus) gainText += me.bonus.won ? `, et ${escapeHtml(nameShort(me.bonus.name))} est bien ${data.step === 1 ? 'recalée' : 'hors du Top 5'} (bonus !)` : `. Raté pour ${escapeHtml(nameShort(me.bonus.name))}`;
            gainText += '.';
        } else {
            gainText = "Tu n'avais pas fait ce pronostic. Rattrape-toi sur la suite !";
        }
        visual = `<div class="reveal-strip">${list.map(n => `
            <figure class="${(me.correct || []).includes(n) ? 'mine' : ''}">
                <img src="${escapeHtml(photoOf(n))}" alt="">
                <figcaption>${escapeHtml(regionOf(n))}</figcaption>
            </figure>`).join('')}</div>`;
    } else if (data.step === 3) {
        const winner = data.official.classement_final[0];
        title = `Miss France<br><em>${year}</em>`;
        visual = `
            <div class="reveal-winner">
                <img src="${escapeHtml(photoOf(winner))}" alt="${escapeHtml(winner)}">
                <div class="crown-cap"><p class="kicker" style="color: #fff;">Elle est couronnée</p><span class="serif">${escapeHtml(winner)}</span><br><span>${escapeHtml(personOf(winner))}</span></div>
            </div>`;
        if (me.hasProno) {
            gainText = me.pronoOr
                ? (me.pronoOr.won ? 'Ton prono d\'or était le bon : <strong>+80 points</strong> !' : `Ton prono d'or était ${escapeHtml(nameShort(me.pronoOr.name))}.`)
                : "Tu n'avais pas choisi de prono d'or.";
            if (me.picks) gainText += ` Podium : ${me.correct.length} place(s) exacte(s).`;
        } else {
            gainText = "Tu n'avais pas fait de pronostic.";
        }
    }

    const gained = me.gained || 0;
    const el = document.createElement('div');
    el.className = 'reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Résultat officiel');
    el.innerHTML = `
        <div class="reveal-inner">
            <div class="reveal-flash">
                <span class="live">En direct</span>
                <button type="button" class="modal-close" data-close aria-label="Fermer">${CLOSE_ICON}</button>
            </div>
            <p class="kicker">Édition spéciale · Miss France ${year}</p>
            <h1 class="reveal-title">${title}</h1>
            ${data.step === 3 ? visual : ''}
            <div class="reveal-gain ${gained > 0 ? 'win' : ''}">
                <span class="big">${gained > 0 ? `+${gained}` : '0'}</span>
                <span class="txt">${gainText}</span>
            </div>
            ${data.step !== 3 ? visual : ''}
            ${buildRevealStats(data)}
            <button type="button" class="btn btn-block btn-between" data-board><span>Voir le classement</span>${ARROW}</button>
        </div>`;
    const close = () => { el.remove(); document.body.style.overflow = ''; };
    el.querySelector('[data-close]').addEventListener('click', close);
    el.querySelector('[data-board]').addEventListener('click', () => { close(); go('leaderboard'); });
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    el.querySelector('[data-close]').focus();

    MFX.fanfare();
    if (gained > 0 || data.step === 3) setTimeout(() => confetti(data.step === 3 ? 120 : 70), 450);
}

// ---------- Surveillance des résultats officiels ----------

const Live = (() => {
    const KEY = 'mf-seen-result';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
    const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignoré */ } };
    let busy = false;

    async function check(force = false) {
        if (busy || (!force && document.visibilityState !== 'visible')) return;
        busy = true;
        try {
            const previous = App.official;
            const official = await api('/api/official-results');
            const seen = read();
            const stamp = { step: official.current_step, at: official.updated_at };
            const changed = !seen || seen.step !== stamp.step || seen.at !== stamp.at;
            App.official = official;
            if (!changed) return;
            write(stamp);
            const advanced = official.current_step > 0 && (!seen || official.current_step > seen.step || (official.current_step === seen.step && seen.at !== stamp.at));
            if (advanced) {
                const data = await api('/api/reveal');
                showReveal(data);
            }
            // Met à jour l'écran ouvert et le score sans recharger la page
            if (previous.current_step !== official.current_step || advanced) {
                refreshScore().catch(() => {});
                const loader = App.loaders[App.current];
                if (loader && App.current !== 'admin') loader().catch(() => {});
            }
        } catch { /* réseau : on réessaiera */ } finally {
            busy = false;
        }
    }

    function start() {
        check(true);
        setInterval(() => check(), 12000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }
    return { check, start, replay: async () => showReveal(await api('/api/reveal')) };
})();
window.Live = Live;

document.addEventListener('app:ready', () => Live.start());
