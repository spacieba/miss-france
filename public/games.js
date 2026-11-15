/* ============================================================
   Jeux : quiz Miss France et questionnaire Culture G
   ============================================================ */

// ---------- Quiz ----------

const Quiz = { data: null, index: 0, busy: false };
const pad2 = (n) => String(n).padStart(2, '0');
const DIFF_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };

async function loadQuiz() {
    const [score, data] = await Promise.all([api('/api/quiz/score'), api('/api/quiz/questions')]);
    Quiz.data = data;
    $('quiz-answered').textContent = score.totalAnswers;
    $('quiz-correct').textContent = score.correctAnswers;
    $('quiz-total').textContent = data.totalQuestions;
    $('quiz-intro').hidden = false;
    $('quiz-game').hidden = true;
    const btn = $('quiz-start');
    if (data.isCompleted) {
        $('quiz-start-label').textContent = 'Quiz terminé';
        btn.disabled = true;
        $('quiz-intro-text').textContent = `Bravo, tu as répondu aux ${data.totalQuestions} questions avec ${score.correctAnswers} bonnes réponses. Rendez-vous au classement !`;
    } else if (data.answeredCount > 0) {
        $('quiz-start-label').textContent = `Reprendre (${data.answeredCount}/${data.totalQuestions})`;
        btn.disabled = false;
        $('quiz-intro-text').textContent = 'Une réponse validée est définitive : prends ton temps.';
    } else {
        $('quiz-start-label').textContent = 'Commencer le quiz';
        btn.disabled = false;
        $('quiz-intro-text').textContent = 'Une réponse validée est définitive : prends ton temps.';
    }
}
App.loaders.quiz = loadQuiz;

async function startQuiz() {
    Quiz.data = await api('/api/quiz/questions');
    if (Quiz.data.isCompleted) return loadQuiz();
    Quiz.index = 0;
    $('quiz-intro').hidden = true;
    $('quiz-game').hidden = false;
    showQuestion();
}

function showQuestion() {
    const q = Quiz.data.questions[Quiz.index];
    if (!q) return endQuiz();
    Quiz.busy = false;
    $('q-num').textContent = pad2(Quiz.data.answeredCount + Quiz.index + 1);
    $('q-total').textContent = Quiz.data.totalQuestions;
    $('q-diff').textContent = DIFF_LABEL[q.difficulty] || '';
    $('q-text').textContent = q.question;
    $('q-feedback').innerHTML = '';
    $('q-answers').innerHTML = q.answers.map((a, i) => `
        <button type="button" class="answer" data-i="${i}"><span class="letter">${'abcd'[i] || ''}</span><span>${escapeHtml(a)}</span></button>
    `).join('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function answerQuestion(i) {
    if (Quiz.busy) return;
    Quiz.busy = true;
    const q = Quiz.data.questions[Quiz.index];
    const buttons = [...$('q-answers').querySelectorAll('.answer')];
    buttons.forEach(b => { b.disabled = true; });
    try {
        const result = await api('/api/quiz/answer', { method: 'POST', body: { questionId: q.id, answer: i } });
        const correctIndex = q.answers.findIndex(a => a === result.correctAnswer);
        if (correctIndex >= 0) buttons[correctIndex].classList.add('correct');
        if (!result.correct) buttons[i].classList.add('wrong');
        if (window.MFX) result.correct ? window.MFX.good() : window.MFX.bad();
        $('q-feedback').innerHTML = result.correct
            ? 'Bonne réponse.'
            : `Raté. <span class="muted">La bonne réponse : ${escapeHtml(result.correctAnswer)}</span>`;
    } catch (err) {
        toast(err.message, 'error');
    }
    const last = Quiz.index >= Quiz.data.questions.length - 1;
    $('q-feedback').insertAdjacentHTML('beforeend', `
        <button type="button" class="btn btn-block btn-between" id="q-next" style="margin-top: 16px;">
            <span>${last ? 'Voir mon résultat' : 'Question suivante'}</span>${ARROW}
        </button>`);
    $('q-next').addEventListener('click', () => { Quiz.index++; showQuestion(); });
    $('q-next').focus();
}

async function endQuiz() {
    await loadQuiz();
    refreshScore().catch(() => {});
    toast('Quiz terminé, bravo !', 'success');
}

// ---------- Culture G ----------

const CG = { data: null, progress: null, category: null };

async function loadCultureG() {
    const [data, progress] = await Promise.all([api('/api/culture-g/questions'), api('/api/culture-g/progress')]);
    CG.data = data;
    CG.progress = progress;
    $('cg-answered').textContent = `${progress.totalAnswers}/${progress.totalQuestions}`;
    $('cg-points').textContent = progress.totalPoints;
    $('cg-max').textContent = progress.maxPoints;
    $('cg-home').hidden = false;
    $('cg-play').hidden = true;
    $('cg-categories').innerHTML = Object.entries(data.categories).map(([key, cat]) => {
        const p = progress.categoryProgress[key] || { answered: 0, total: cat.questions.length, points: 0, maxPoints: cat.totalPoints };
        const done = p.answered >= p.total;
        const pctDone = Math.round((p.answered / Math.max(1, p.total)) * 100);
        return `
            <li><button type="button" class="cg-cat" data-cat="${escapeHtml(key)}" ${done ? 'disabled' : ''}>
                <span class="grow">
                    <span class="serif">${escapeHtml(cat.name)}</span>
                    <span class="small muted">${cat.questions.length} questions · ${cat.totalPoints} pts</span>
                    ${!done && p.answered ? `<span class="bar"><span style="width: ${pctDone}%"></span></span>` : ''}
                </span>
                <span class="state ${done ? 'done' : ''}">${done ? `${p.points}/${p.maxPoints} pts ✓` : (p.answered ? `${p.answered}/${p.total}` : ARROW)}</span>
            </button></li>`;
    }).join('');
}
App.loaders['culture-g'] = loadCultureG;

function openCategory(key) {
    const cat = CG.data.categories[key];
    if (!cat) return;
    CG.category = key;
    $('cg-home').hidden = true;
    $('cg-play').hidden = false;
    $('cg-cat-title').textContent = cat.name;
    $('cg-results').innerHTML = '';
    const pending = cat.questions.filter(q => !q.answered);
    $('cg-submit').hidden = pending.length === 0;
    if (!pending.length) {
        $('cg-questions').innerHTML = '<p class="empty">Catégorie terminée.</p>';
        return;
    }
    $('cg-questions').innerHTML = cat.questions.map((q, index) => {
        if (q.answered) return '';
        let body = '';
        if (q.type === 'single' || q.type === 'multiple') {
            const type = q.type === 'single' ? 'radio' : 'checkbox';
            body = (q.type === 'multiple' ? '<p class="hint">Plusieurs réponses possibles.</p>' : '') +
                q.answers.map((a, i) => `<label class="opt"><input type="${type}" name="q-${escapeHtml(q.id)}" value="${i}"><span>${escapeHtml(a)}</span></label>`).join('');
        } else {
            body = `<input type="text" class="input" id="q-${escapeHtml(q.id)}" placeholder="Ta réponse" autocomplete="off" aria-label="Ta réponse">`;
        }
        const bonus = q.bonus ? `
            <div class="cg-bonus">
                <label for="bonus-${escapeHtml(q.id)}">Bonus (+${q.bonus.points} pt) : ${escapeHtml(q.bonus.question)}</label>
                <input type="text" class="input" id="bonus-${escapeHtml(q.id)}" placeholder="Réponse bonus" autocomplete="off">
            </div>` : '';
        return `
            <div class="cg-question">
                <div class="qh"><span class="qn">${pad2(index + 1)}</span><span class="small muted">${q.points} pt${q.points > 1 ? 's' : ''}</span></div>
                <h3>${escapeHtml(q.question)}</h3>
                ${body}
                ${bonus}
            </div>`;
    }).join('');
    window.scrollTo({ top: 0 });
}

async function submitCategory() {
    const cat = CG.data.categories[CG.category];
    if (!cat) return;
    const answers = {};
    cat.questions.forEach(q => {
        if (q.answered) return;
        let main = null;
        if (q.type === 'single') {
            const sel = document.querySelector(`input[name="q-${CSS.escape(q.id)}"]:checked`);
            if (sel) main = Number(sel.value);
        } else if (q.type === 'multiple') {
            main = [...document.querySelectorAll(`input[name="q-${CSS.escape(q.id)}"]:checked`)].map(s => Number(s.value));
            if (!main.length) main = null;
        } else {
            const v = document.getElementById(`q-${q.id}`)?.value.trim();
            if (v) main = v;
        }
        const bonus = q.bonus ? (document.getElementById(`bonus-${q.id}`)?.value.trim() || null) : null;
        if (main !== null) answers[q.id] = { main, bonus };
    });
    const count = Object.keys(answers).length;
    const pending = cat.questions.filter(q => !q.answered).length;
    if (!count) return toast('Réponds à au moins une question.', 'error');
    if (count < pending && !confirm(`Tu n'as répondu qu'à ${count} question(s) sur ${pending}. Les questions sans réponse resteront ouvertes. Valider quand même ?`)) return;

    $('cg-submit').disabled = true;
    try {
        const data = await api('/api/culture-g/submit-category', { method: 'POST', body: { categoryKey: CG.category, answers } });
        if (window.MFX) window.MFX.good();
        $('cg-questions').innerHTML = '';
        $('cg-submit').hidden = true;
        $('cg-results').innerHTML = `
            <div class="stat-row">
                <div class="stat-cell"><span class="v">${data.correctCount}</span><span class="l">Bonnes réponses</span></div>
                <div class="stat-cell"><span class="v">+${data.totalPoints}</span><span class="l">Points bruts</span></div>
                <div class="stat-cell"><span class="v">${data.results.length}</span><span class="l">Questions</span></div>
            </div>
            ${data.results.map(r => `
                <div class="result-row">
                    <span>${escapeHtml(r.question)}</span>
                    <span class="${r.isCorrect ? 'ok' : 'ko'}">${r.isCorrect ? `+${r.points}` : escapeHtml(r.correctAnswer)}</span>
                </div>`).join('')}
            <button type="button" class="btn btn-block btn-between" style="margin-top: 20px;" id="cg-done"><span>Retour aux catégories</span>${ARROW}</button>`;
        $('cg-done').addEventListener('click', loadCultureG);
        refreshScore().catch(() => {});
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        $('cg-submit').disabled = false;
    }
}

document.addEventListener('app:ready', () => {
    $('quiz-start').addEventListener('click', () => startQuiz().catch(err => toast(err.message, 'error')));
    $('q-answers').addEventListener('click', (e) => {
        const b = e.target.closest('.answer');
        if (b && !b.disabled) answerQuestion(Number(b.dataset.i));
    });
    $('cg-categories').addEventListener('click', (e) => {
        const b = e.target.closest('.cg-cat');
        if (b && !b.disabled) openCategory(b.dataset.cat);
    });
    $('cg-back').addEventListener('click', () => loadCultureG().catch(err => toast(err.message, 'error')));
    $('cg-submit').addEventListener('click', submitCategory);
});
