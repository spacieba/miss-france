// Variables globales
let currentUser = null;
let candidates = [];
let quizQuestions = [];
let currentQuestionIndex = 0;
let isAdmin = false;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    await loadCandidates();
    loadScore();
    loadLeaderboard();

    // Charger l'admin si nécessaire
    if (isAdmin) {
        initializeAdmin();
    }
});

// Charger les données utilisateur
async function loadUserData() {
    try {
        const response = await fetch('/api/me');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
        const data = await response.json();
        currentUser = data.user;
        isAdmin = data.user.isAdmin || false;

        document.getElementById('user-pseudo').textContent = currentUser.pseudo;
        document.getElementById('welcome-pseudo').textContent = currentUser.pseudo;

        updateScoreDisplay(data.score);

        // Afficher le bouton admin si nécessaire
        if (isAdmin) {
            const adminBtn = document.getElementById('admin-nav-btn');
            if (adminBtn) {
                adminBtn.style.display = 'block';
            }
        }
    } catch (error) {
        window.location.href = '/';
    }
}

// Mettre à jour l'affichage des scores
function updateScoreDisplay(score) {
    document.getElementById('user-score').textContent = `${score.total_score} pts`;
    document.getElementById('total-score').textContent = score.total_score;
    document.getElementById('quiz-score').textContent = `${score.quiz_score} pts`;
    document.getElementById('pronostics-score').textContent = `${score.pronostics_score} pts`;
    document.getElementById('defis-score').textContent = `${score.defis_score} pts`;

    // Culture G score
    const cultureGScoreEl = document.getElementById('culture-g-score');
    if (cultureGScoreEl) {
        cultureGScoreEl.textContent = `${score.culture_g_score || 0} pts`;
    }
}

// Charger le score
async function loadScore() {
    const response = await fetch('/api/me');
    const data = await response.json();
    updateScoreDisplay(data.score);
}

// Déconnexion
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}

// Navigation entre sections
function showSection(sectionName) {
    // Masquer toutes les sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Désactiver tous les boutons de navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Afficher la section demandée
    document.getElementById(sectionName).classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // Charger les données spécifiques à la section
    if (sectionName === 'pronostics') {
        loadPronosticsSection();
    } else if (sectionName === 'quiz') {
        loadQuizSection();
    } else if (sectionName === 'culture-g') {
        loadCultureGSection();
    } else if (sectionName === 'defis') {
        loadDefisSection();
    } else if (sectionName === 'leaderboard') {
        loadLeaderboard();
    } else if (sectionName === 'admin' && isAdmin) {
        loadAdminStats();
        loadAdminInterface();
    }
}

// === PRONOSTICS ===

async function loadCandidates() {
    const response = await fetch('/api/candidates');
    candidates = await response.json();
}

async function loadPronosticsSection() {
    // Charger les résultats officiels pour savoir quelles candidates afficher
    await loadOfficialResults();

    // Charger les pronostics existants
    const response = await fetch('/api/pronostics');
    const pronostics = await response.json();

    // Remplir les sélections de candidates pour Top 15
    const top15Container = document.getElementById('top15-selection');
    top15Container.innerHTML = '';

    candidates.forEach((candidate, index) => {
        const label = document.createElement('label');
        const inputId = `top15-${index}`;
        label.className = 'candidate-checkbox';
        label.setAttribute('for', inputId);
        label.innerHTML = `
            <input type="checkbox" id="${inputId}" value="${candidate}" data-type="top15">
            <span>${candidate}</span>
        `;
        top15Container.appendChild(label);
    });

    // Top 5 - Afficher seulement les candidates du Top 15 validé (si validé)
    const top5Container = document.getElementById('top5-selection');
    top5Container.innerHTML = '';

    const candidatesForTop5 = officialResults.current_step >= 1 && officialResults.top15.length > 0
        ? officialResults.top15
        : candidates;

    // Afficher un message si le Top 15 a été validé
    if (officialResults.current_step >= 1) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'background: rgba(39, 174, 96, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #27ae60;';
        infoDiv.innerHTML = '✅ <strong>Top 15 validé !</strong> Seules les 15 candidates sélectionnées sont affichées.';
        top5Container.appendChild(infoDiv);
    }

    candidatesForTop5.forEach((candidate, index) => {
        const label = document.createElement('label');
        const inputId = `top5-${index}`;
        label.className = 'candidate-checkbox';
        label.setAttribute('for', inputId);
        label.innerHTML = `
            <input type="checkbox" id="${inputId}" value="${candidate}" data-type="top5">
            <span>${candidate}</span>
        `;
        top5Container.appendChild(label);
    });

    // Remplir les selects (filtrés selon les résultats)
    fillCandidateSelects();

    // Charger les pronostics existants et afficher les badges de statut
    if (pronostics) {
        // Top 15
        if (pronostics.top15) {
            pronostics.top15.forEach(candidate => {
                const checkbox = document.querySelector(`input[value="${candidate}"][data-type="top15"]`);
                if (checkbox) checkbox.checked = true;
            });
            if (pronostics.bonus_top15) {
                document.getElementById('bonus-top15').value = pronostics.bonus_top15;
            }
            if (pronostics.prono_or) {
                document.getElementById('prono-or-miss').value = pronostics.prono_or;
            }

            // Afficher le badge de statut
            if (pronostics.top15.length === 15 && pronostics.bonus_top15) {
                const statusBadge = document.getElementById('top15-status');
                statusBadge.textContent = '✅ Validé';
                statusBadge.className = 'status-badge validated';
            }
        }

        // Top 5
        if (pronostics.top5) {
            pronostics.top5.forEach(candidate => {
                const checkbox = document.querySelector(`input[value="${candidate}"][data-type="top5"]`);
                if (checkbox) checkbox.checked = true;
            });
            if (pronostics.bonus_top5) {
                document.getElementById('bonus-top5').value = pronostics.bonus_top5;
            }

            // Afficher le badge de statut
            if (pronostics.top5.length === 5 && pronostics.bonus_top5) {
                const statusBadge = document.getElementById('top5-status');
                statusBadge.textContent = '✅ Validé';
                statusBadge.className = 'status-badge validated';
            }
        }

        // Classement final
        if (pronostics.classement_final) {
            pronostics.classement_final.forEach((candidate, index) => {
                const select = document.querySelector(`.select-rank[data-rank="${index + 1}"]`);
                if (select) select.value = candidate;
            });

            // Afficher le badge de statut
            if (pronostics.classement_final.every(c => c)) {
                const statusBadge = document.getElementById('final-status');
                statusBadge.textContent = '✅ Validé';
                statusBadge.className = 'status-badge validated';
            }
        }
    }

    // Limiter la sélection à 15 pour top15 et 5 pour top5
    document.querySelectorAll('input[data-type="top15"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-type="top15"]:checked');
            if (checked.length > 15) {
                checkbox.checked = false;
                alert('Tu ne peux sélectionner que 15 candidates !');
            }
        });
    });

    document.querySelectorAll('input[data-type="top5"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-type="top5"]:checked');
            if (checked.length > 5) {
                checkbox.checked = false;
                alert('Tu ne peux sélectionner que 5 candidates !');
            }
        });
    });

    // === VERROUILLAGE APRÈS VALIDATION ADMIN ===

    // Verrouiller Top 15 si l'admin a validé (current_step >= 1)
    if (officialResults.current_step >= 1) {
        // Désactiver tous les checkboxes Top 15
        document.querySelectorAll('input[data-type="top15"]').forEach(cb => cb.disabled = true);
        // Désactiver les selects bonus et prono d'or
        const bonusTop15 = document.getElementById('bonus-top15');
        const pronoOr = document.getElementById('prono-or-miss');
        if (bonusTop15) bonusTop15.disabled = true;
        if (pronoOr) pronoOr.disabled = true;
        // Désactiver le bouton de validation
        const btnTop15 = document.querySelector('button[onclick="saveTop15()"]');
        if (btnTop15) {
            btnTop15.disabled = true;
            btnTop15.textContent = '🔒 Top 15 verrouillé (résultats officiels validés)';
            btnTop15.style.background = '#666';
            btnTop15.style.cursor = 'not-allowed';
        }
        // Afficher un message
        const top15Section = document.getElementById('top15-selection');
        if (top15Section && !document.getElementById('top15-locked-msg')) {
            const msg = document.createElement('div');
            msg.id = 'top15-locked-msg';
            msg.style.cssText = 'background: rgba(231, 76, 60, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e74c3c; color: #e74c3c;';
            msg.innerHTML = '🔒 <strong>Section verrouillée</strong> - Le Top 15 officiel a été validé par l\'admin.';
            top15Section.parentNode.insertBefore(msg, top15Section);
        }
    }

    // Verrouiller Top 5 si l'admin a validé (current_step >= 2)
    if (officialResults.current_step >= 2) {
        // Désactiver tous les checkboxes Top 5
        document.querySelectorAll('input[data-type="top5"]').forEach(cb => cb.disabled = true);
        // Désactiver le select bonus
        const bonusTop5 = document.getElementById('bonus-top5');
        if (bonusTop5) bonusTop5.disabled = true;
        // Désactiver le bouton de validation
        const btnTop5 = document.querySelector('button[onclick="saveTop5()"]');
        if (btnTop5) {
            btnTop5.disabled = true;
            btnTop5.textContent = '🔒 Top 5 verrouillé (résultats officiels validés)';
            btnTop5.style.background = '#666';
            btnTop5.style.cursor = 'not-allowed';
        }
        // Afficher un message
        const top5Section = document.getElementById('top5-selection');
        if (top5Section && !document.getElementById('top5-locked-msg')) {
            const msg = document.createElement('div');
            msg.id = 'top5-locked-msg';
            msg.style.cssText = 'background: rgba(231, 76, 60, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e74c3c; color: #e74c3c;';
            msg.innerHTML = '🔒 <strong>Section verrouillée</strong> - Le Top 5 officiel a été validé par l\'admin.';
            top5Section.parentNode.insertBefore(msg, top5Section);
        }
    }

    // Verrouiller Classement Final si l'admin a validé (current_step >= 3)
    if (officialResults.current_step >= 3) {
        // Désactiver tous les selects de classement
        document.querySelectorAll('.select-rank').forEach(select => select.disabled = true);
        // Désactiver le bouton de validation
        const btnFinal = document.querySelector('button[onclick="saveFinalRanking()"]');
        if (btnFinal) {
            btnFinal.disabled = true;
            btnFinal.textContent = '🔒 Classement verrouillé (résultats officiels validés)';
            btnFinal.style.background = '#666';
            btnFinal.style.cursor = 'not-allowed';
        }
        // Afficher un message
        const finalSection = document.getElementById('final-ranking-selects');
        if (finalSection && !document.getElementById('final-locked-msg')) {
            const msg = document.createElement('div');
            msg.id = 'final-locked-msg';
            msg.style.cssText = 'background: rgba(231, 76, 60, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e74c3c; color: #e74c3c;';
            msg.innerHTML = '🔒 <strong>Section verrouillée</strong> - Le classement final officiel a été validé. Miss France 2026 est élue !';
            finalSection.parentNode.insertBefore(msg, finalSection);
        }
    }
}

function fillCandidateSelects() {
    // Bonus top15 et prono d'or - toutes les candidates
    const bonusTop15Select = document.getElementById('bonus-top15');
    const pronoOrSelect = document.getElementById('prono-or-miss');

    if (bonusTop15Select) {
        bonusTop15Select.innerHTML = '<option value="">-- Choisis une candidate --</option>';
        candidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            bonusTop15Select.appendChild(option);
        });
    }

    if (pronoOrSelect) {
        pronoOrSelect.innerHTML = '<option value="">-- Choisis ta future Miss France --</option>';
        candidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            pronoOrSelect.appendChild(option);
        });
    }

    // Bonus top5 - filtré selon le Top 15 validé
    const bonusTop5Select = document.getElementById('bonus-top5');
    const candidatesForBonusTop5 = officialResults.current_step >= 1 && officialResults.top15.length > 0
        ? officialResults.top15
        : candidates;

    if (bonusTop5Select) {
        bonusTop5Select.innerHTML = '<option value="">-- Choisis une candidate --</option>';
        candidatesForBonusTop5.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            bonusTop5Select.appendChild(option);
        });
    }

    // Classement final - filtré selon le Top 5 validé
    const candidatesForFinal = officialResults.current_step >= 2 && officialResults.top5.length > 0
        ? officialResults.top5
        : candidates;

    const defaultLabels = ['-- Miss France 2026 --', '-- 1ère Dauphine --', '-- 2ème Dauphine --', '-- 3ème Dauphine --', '-- 4ème Dauphine --'];

    document.querySelectorAll('.select-rank').forEach((select, idx) => {
        select.innerHTML = `<option value="">${defaultLabels[idx]}</option>`;
        candidatesForFinal.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });
    });

    // Afficher un message informatif si le Top 5 a été validé
    const finalSection = document.getElementById('final-ranking');
    if (finalSection && officialResults.current_step >= 2) {
        let infoDiv = finalSection.querySelector('.info-top5-validated');
        if (!infoDiv) {
            infoDiv = document.createElement('div');
            infoDiv.className = 'info-top5-validated';
            infoDiv.style.cssText = 'background: rgba(39, 174, 96, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #27ae60;';
            infoDiv.innerHTML = '✅ <strong>Top 5 validé !</strong> Seules les 5 finalistes sont affichées.';
            finalSection.insertBefore(infoDiv, finalSection.firstChild);
        }
    }
}

async function saveTop15() {
    const top15 = Array.from(document.querySelectorAll('input[data-type="top15"]:checked')).map(cb => cb.value);
    const bonusTop15 = document.getElementById('bonus-top15').value;
    const pronoOr = document.getElementById('prono-or-miss').value;

    // Validation
    if (top15.length !== 15) {
        alert('Tu dois sélectionner exactement 15 candidates pour le top 15 !');
        return;
    }

    if (!bonusTop15) {
        alert('Tu dois choisir une candidate bonus pour le top 15 !');
        return;
    }

    try {
        const response = await fetch('/api/pronostics/top15', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ top15, bonusTop15, pronoOr })
        });

        const data = await response.json();
        const messageDiv = document.getElementById('top15-message');
        const statusBadge = document.getElementById('top15-status');

        if (!response.ok) {
            messageDiv.textContent = '❌ ' + (data.error || 'Erreur');
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            return;
        }

        messageDiv.textContent = '✅ ' + data.message;
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';

        statusBadge.textContent = '✅ Validé';
        statusBadge.className = 'status-badge validated';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        alert('Erreur lors de l\'enregistrement');
    }
}

async function saveTop5() {
    const top5 = Array.from(document.querySelectorAll('input[data-type="top5"]:checked')).map(cb => cb.value);
    const bonusTop5 = document.getElementById('bonus-top5').value;

    // Validation
    if (top5.length !== 5) {
        alert('Tu dois sélectionner exactement 5 candidates pour le top 5 !');
        return;
    }

    if (!bonusTop5) {
        alert('Tu dois choisir une candidate bonus pour le top 5 !');
        return;
    }

    try {
        const response = await fetch('/api/pronostics/top5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ top5, bonusTop5 })
        });

        const data = await response.json();
        const messageDiv = document.getElementById('top5-message');
        const statusBadge = document.getElementById('top5-status');

        if (!response.ok) {
            messageDiv.textContent = '❌ ' + (data.error || 'Erreur');
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            return;
        }

        messageDiv.textContent = '✅ ' + data.message;
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';

        statusBadge.textContent = '✅ Validé';
        statusBadge.className = 'status-badge validated';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        alert('Erreur lors de l\'enregistrement');
    }
}

async function saveFinalRanking() {
    const classementFinal = [];

    for (let i = 1; i <= 5; i++) {
        const select = document.querySelector(`.select-rank[data-rank="${i}"]`);
        classementFinal.push(select.value);
    }

    // Validation
    if (classementFinal.some(c => !c)) {
        alert('Tu dois remplir tout le classement final !');
        return;
    }

    try {
        const response = await fetch('/api/pronostics/final', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classementFinal })
        });

        const data = await response.json();
        const messageDiv = document.getElementById('final-message');
        const statusBadge = document.getElementById('final-status');

        if (!response.ok) {
            messageDiv.textContent = '❌ ' + (data.error || 'Erreur');
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            return;
        }

        messageDiv.textContent = '✅ ' + data.message;
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';

        statusBadge.textContent = '✅ Validé';
        statusBadge.className = 'status-badge validated';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        alert('Erreur lors de l\'enregistrement');
    }
}

// === QUIZ ===

let quizData = null; // Stocker les données du quiz

async function loadQuizSection() {
    const response = await fetch('/api/quiz/score');
    const score = await response.json();

    document.getElementById('quiz-answered').textContent = score.totalAnswers;
    document.getElementById('quiz-correct').textContent = score.correctAnswers;
    document.getElementById('quiz-points').textContent = score.totalPoints;

    // Vérifier si le quiz est déjà terminé
    const quizResponse = await fetch('/api/quiz/questions');
    quizData = await quizResponse.json();

    const startBtn = document.querySelector('#quiz-intro .btn-primary');
    const introText = document.querySelector('#quiz-intro p');

    if (quizData.isCompleted) {
        // Quiz terminé - désactiver le bouton
        if (startBtn) {
            startBtn.textContent = '✅ Quiz terminé';
            startBtn.disabled = true;
            startBtn.style.opacity = '0.6';
            startBtn.style.cursor = 'not-allowed';
        }
        if (introText) {
            introText.innerHTML = `🎉 <strong>Tu as déjà complété le quiz !</strong><br>Tu as répondu aux ${quizData.totalQuestions} questions.`;
        }
    } else if (quizData.answeredCount > 0) {
        // Quiz en cours
        if (startBtn) {
            startBtn.textContent = `▶️ Continuer le quiz (${quizData.answeredCount}/${quizData.totalQuestions})`;
        }
        if (introText) {
            introText.innerHTML = `Tu as déjà répondu à ${quizData.answeredCount} question(s) sur ${quizData.totalQuestions}.<br>Continue pour terminer le quiz !`;
        }
    }
}

async function startQuiz() {
    // Recharger les questions non répondues
    const response = await fetch('/api/quiz/questions');
    quizData = await response.json();

    if (quizData.isCompleted) {
        alert('Tu as déjà complété le quiz !');
        return;
    }

    quizQuestions = quizData.questions;
    currentQuestionIndex = 0;

    document.getElementById('quiz-intro').style.display = 'none';
    document.getElementById('quiz-game').style.display = 'block';

    showQuestion();
}

function showQuestion() {
    if (currentQuestionIndex >= quizQuestions.length) {
        endQuiz();
        return;
    }

    const question = quizQuestions[currentQuestionIndex];
    const totalAnswered = quizData.answeredCount + currentQuestionIndex + 1;

    document.getElementById('question-number').textContent = `Question ${totalAnswered}/${quizData.totalQuestions}`;
    document.getElementById('question-difficulty').textContent = question.difficulty.toUpperCase();
    document.getElementById('question-difficulty').className = `difficulty-badge difficulty-${question.difficulty}`;
    document.getElementById('question-text').textContent = question.question;

    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';

    question.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer;
        button.onclick = () => answerQuestion(index);
        answersContainer.appendChild(button);
    });

    document.getElementById('quiz-feedback').style.display = 'none';
}

async function answerQuestion(answerIndex) {
    const question = quizQuestions[currentQuestionIndex];
    
    const response = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            questionId: question.id,
            answer: answerIndex
        })
    });
    
    const result = await response.json();
    
    // Afficher le feedback
    const feedback = document.getElementById('quiz-feedback');
    if (result.correct) {
        feedback.innerHTML = `
            <div class="feedback-correct">
                ✅ Bonne réponse ! +${result.points} points
            </div>
        `;
    } else {
        feedback.innerHTML = `
            <div class="feedback-wrong">
                ❌ Mauvaise réponse !<br>
                La bonne réponse était : ${result.correctAnswer}
            </div>
        `;
    }
    feedback.style.display = 'block';
    
    // Désactiver les boutons
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    });
    
    // Passer à la question suivante après 2 secondes
    setTimeout(() => {
        currentQuestionIndex++;
        showQuestion();
        loadScore(); // Rafraîchir le score
    }, 2000);
}

function endQuiz() {
    document.getElementById('quiz-game').style.display = 'none';
    document.getElementById('quiz-intro').style.display = 'block';
    loadQuizSection();
    alert('🎉 Quiz terminé ! Consulte ton score dans le classement !');
}

// === DEFIS ===

async function loadDefisSection() {
    // Charger le défi classique
    try {
        const response = await fetch('/api/defis');
        const defi = await response.json();

        const container = document.getElementById('defi-card');

        if (!defi) {
            container.innerHTML = `
                <div class="no-defi">
                    <p>🎉 Tu as complété tous les défis disponibles !</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="defi-content">
                    <h3>${defi.title}</h3>
                    <p>${defi.description}</p>
                    <div class="defi-points">🌟 ${defi.points} points</div>
                    <button onclick="completeDefi(${defi.id})" class="btn-primary btn-large">✅ J'ai fait le défi !</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur chargement défis:', error);
    }

    // Charger ma photo de costume
    try {
        await loadMyCostumePhoto();
    } catch (error) {
        console.error('Erreur chargement photo costume:', error);
    }

    // Charger la galerie des costumes
    try {
        await loadCostumeGallery();
    } catch (error) {
        console.error('Erreur chargement galerie:', error);
    }

    // Charger le vote costume
    try {
        await loadCostumeVoting();
    } catch (error) {
        console.error('Erreur chargement vote costume:', error);
    }

    // Initialiser l'input file pour l'upload
    initCostumePhotoUpload();
}

async function completeDefi(defiId) {
    const confirmed = confirm('Es-tu sûr d\'avoir fait le défi ?');
    if (!confirmed) return;

    const response = await fetch('/api/defis/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defiId })
    });

    const data = await response.json();

    if (response.ok) {
        alert(`🎉 Défi validé ! +${data.points} points`);
        loadDefisSection();
        loadScore();
    } else {
        alert(data.error || 'Erreur');
    }
}

// === PHOTO COSTUME ===

async function loadMyCostumePhoto() {
    try {
        const response = await fetch('/api/costume/my-photo');
        const data = await response.json();

        const previewContainer = document.getElementById('my-costume-photo-preview');
        const deleteBtn = document.getElementById('delete-photo-btn');
        const togglePublicBtn = document.getElementById('toggle-public-btn');
        const publicStatus = document.getElementById('public-status');

        if (data.photo) {
            previewContainer.innerHTML = `
                <img src="${data.photo}" alt="Mon costume" style="max-width: 100%; max-height: 300px; border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.3);">
            `;
            deleteBtn.style.display = 'block';
            togglePublicBtn.style.display = 'block';

            // Mettre à jour le bouton et le statut selon si la photo est publique
            if (data.isPublic) {
                togglePublicBtn.innerHTML = '🔒 Retirer de la galerie';
                togglePublicBtn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                publicStatus.innerHTML = '✅ Ta photo est visible dans la galerie !';
                publicStatus.style.background = 'rgba(39, 174, 96, 0.3)';
                publicStatus.style.display = 'block';
            } else {
                togglePublicBtn.innerHTML = '🎭 Ajouter à la galerie';
                togglePublicBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                publicStatus.innerHTML = '⏳ Ta photo n\'est pas encore visible par les autres';
                publicStatus.style.background = 'rgba(243, 156, 18, 0.3)';
                publicStatus.style.display = 'block';
            }
        } else {
            previewContainer.innerHTML = `
                <div style="padding: 40px; background: rgba(255,255,255,0.1); border-radius: 15px; border: 2px dashed rgba(255,255,255,0.3);">
                    <span style="font-size: 3em;">📷</span>
                    <p style="margin-top: 10px;">Aucune photo pour le moment</p>
                </div>
            `;
            deleteBtn.style.display = 'none';
            togglePublicBtn.style.display = 'none';
            publicStatus.style.display = 'none';
        }
    } catch (error) {
        console.error('Erreur chargement photo:', error);
    }
}

async function toggleCostumePublic() {
    try {
        const response = await fetch('/api/costume/toggle-public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        const messageDiv = document.getElementById('costume-upload-message');

        if (response.ok) {
            messageDiv.innerHTML = `<span style="color: #2ecc71;">✅ ${data.message}</span>`;
            messageDiv.style.display = 'block';
            await loadMyCostumePhoto();
            await loadCostumeGallery();

            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        } else {
            messageDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${data.error}</span>`;
            messageDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Erreur toggle public:', error);
        alert('Erreur lors de la modification');
    }
}

function initCostumePhotoUpload() {
    const input = document.getElementById('costume-photo-input');
    if (!input) return;

    // Retirer les anciens listeners
    input.replaceWith(input.cloneNode(true));
    const newInput = document.getElementById('costume-photo-input');

    newInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Vérifier le type
        if (!file.type.startsWith('image/')) {
            alert('Veuillez sélectionner une image');
            return;
        }

        // Vérifier la taille (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('La photo est trop grande (max 10MB)');
            return;
        }

        const messageDiv = document.getElementById('costume-upload-message');
        messageDiv.innerHTML = '<span style="color: white;">Envoi en cours...</span>';
        messageDiv.style.display = 'block';

        try {
            const formData = new FormData();
            formData.append('photo', file);

            const response = await fetch('/api/costume/upload-photo', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.innerHTML = `<span style="color: #2ecc71;">✅ ${data.message}</span>`;
                await loadMyCostumePhoto();
                await loadCostumeGallery();
            } else {
                messageDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${data.error}</span>`;
            }
        } catch (error) {
            console.error('Erreur upload:', error);
            messageDiv.innerHTML = '<span style="color: #e74c3c;">❌ Erreur lors de l\'envoi</span>';
        }

        // Reset input
        newInput.value = '';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    });
}

async function deleteCostumePhoto() {
    const confirmed = confirm('Supprimer ta photo de costume ?');
    if (!confirmed) return;

    try {
        const response = await fetch('/api/costume/delete-photo', {
            method: 'DELETE'
        });

        const data = await response.json();
        const messageDiv = document.getElementById('costume-upload-message');

        if (response.ok) {
            messageDiv.innerHTML = '<span style="color: #2ecc71;">✅ Photo supprimée</span>';
            messageDiv.style.display = 'block';
            await loadMyCostumePhoto();
            await loadCostumeGallery();
        } else {
            messageDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${data.error}</span>`;
            messageDiv.style.display = 'block';
        }

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Erreur suppression:', error);
        alert('Erreur lors de la suppression');
    }
}

async function loadCostumeGallery() {
    try {
        const response = await fetch('/api/costume/players');
        const players = await response.json();

        const gallery = document.getElementById('costume-gallery');
        if (!gallery) return;

        // Filtrer les joueurs qui ont une photo
        const playersWithPhotos = players.filter(p => p.costume_photo);

        if (playersWithPhotos.length === 0) {
            gallery.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--gris-elegant);">
                    <span style="font-size: 3em;">🎭</span>
                    <p style="margin-top: 10px;">Aucune photo pour le moment. Sois le premier à partager ton costume !</p>
                </div>
            `;
            return;
        }

        gallery.innerHTML = playersWithPhotos.map(player => `
            <div class="costume-gallery-item" style="background: var(--noir-soft); border-radius: 10px; overflow: hidden; cursor: pointer;" onclick="openCostumeModal('${player.costume_photo}', '${player.pseudo}')">
                <img src="${player.costume_photo}" alt="Costume de ${player.pseudo}" style="width: 100%; height: 150px; object-fit: cover;">
                <div style="padding: 10px; text-align: center;">
                    <strong style="color: var(--gold);">${player.pseudo}</strong>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erreur chargement galerie:', error);
    }
}

function openCostumeModal(photoUrl, pseudo) {
    // Créer un modal pour voir la photo en grand
    const modal = document.createElement('div');
    modal.id = 'costume-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    modal.onclick = () => modal.remove();

    modal.innerHTML = `
        <img src="${photoUrl}" alt="Costume de ${pseudo}" style="max-width: 90%; max-height: 80%; border-radius: 10px; box-shadow: 0 5px 30px rgba(0,0,0,0.5);">
        <p style="color: white; margin-top: 20px; font-size: 1.2em;"><strong style="color: var(--gold);">${pseudo}</strong></p>
        <p style="color: #888; margin-top: 10px;">Clique n'importe où pour fermer</p>
    `;

    document.body.appendChild(modal);
}

// === VOTE MEILLEUR COSTUME ===

async function loadCostumeVoting() {
    // Charger la liste des autres joueurs (pas soi-même) pour voter
    const playersResponse = await fetch('/api/costume/players-for-vote');
    const players = await playersResponse.json();

    const select = document.getElementById('costume-vote-select');
    select.innerHTML = '<option value="">-- Choisis un joueur --</option>';

    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.pseudo;
        select.appendChild(option);
    });

    // Vérifier si l'utilisateur a déjà voté
    const myVoteResponse = await fetch('/api/costume/my-vote');
    const myVote = await myVoteResponse.json();

    const statusDiv = document.getElementById('costume-vote-status');

    if (myVote) {
        statusDiv.innerHTML = `
            <div style="background: rgba(39, 174, 96, 0.2); padding: 12px; border-radius: 8px; border: 1px solid #27ae60;">
                ✅ Tu as voté pour <strong>${myVote.voted_for_pseudo}</strong>
                <br><small style="color: var(--gris-elegant);">Tu peux changer ton vote si tu veux</small>
            </div>
        `;
        select.value = myVote.voted_for;
    } else {
        statusDiv.innerHTML = '';
    }

    // Charger les résultats
    await loadCostumeResults();
}

async function submitCostumeVote() {
    const select = document.getElementById('costume-vote-select');
    const votedForId = parseInt(select.value);

    if (!votedForId) {
        alert('Sélectionne un joueur !');
        return;
    }

    const response = await fetch('/api/costume/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votedForId })
    });

    const data = await response.json();
    const messageDiv = document.getElementById('costume-vote-message');

    if (response.ok) {
        messageDiv.innerHTML = `<div style="color: #27ae60;">✅ ${data.message}</div>`;
        messageDiv.style.display = 'block';

        // Recharger
        await loadCostumeVoting();

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } else {
        messageDiv.innerHTML = `<div style="color: #e74c3c;">❌ ${data.error}</div>`;
        messageDiv.style.display = 'block';
    }
}

async function loadCostumeResults() {
    const response = await fetch('/api/costume/results');
    const { results, totalVotes } = await response.json();

    const container = document.getElementById('costume-results-list');
    const totalDiv = document.getElementById('costume-total-votes');

    if (totalVotes === 0) {
        container.innerHTML = '<p style="color: var(--gris-elegant); font-style: italic;">Aucun vote pour le moment</p>';
        totalDiv.textContent = '';
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = results
        .filter(r => r.votes > 0)
        .map((player, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: ${index < 3 ? 'rgba(212, 175, 55, 0.1)' : 'transparent'}; border-radius: 8px; margin-bottom: 5px;">
                <span>${medals[index] || '  '} <strong>${player.pseudo}</strong></span>
                <span style="color: var(--gold);">${player.votes} vote${player.votes > 1 ? 's' : ''}</span>
            </div>
        `).join('');

    totalDiv.textContent = `Total: ${totalVotes} vote${totalVotes > 1 ? 's' : ''}`;
}

// === CLASSEMENT ===

let leaderboardData = [];

async function loadLeaderboard() {
    const response = await fetch('/api/leaderboard');
    leaderboardData = await response.json();

    // Charger le classement général
    renderGeneralLeaderboard();

    // Charger les autres classements
    renderPronosticsLeaderboard();
    renderQuizLeaderboard();
    await renderCultureGLeaderboard();
    await renderCostumeLeaderboard();

    // Mettre à jour le rang de l'utilisateur
    if (currentUser) {
        const userRank = leaderboardData.findIndex(p => p.user_id === currentUser.id) + 1;
        document.getElementById('user-rank').textContent = `#${userRank}`;
    }
}

// Afficher un onglet de classement
function showLeaderboardTab(tabName) {
    // Désactiver tous les onglets
    document.querySelectorAll('.leaderboard-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.leaderboard-panel').forEach(panel => panel.classList.remove('active'));

    // Activer l'onglet sélectionné
    document.querySelector(`.leaderboard-tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`leaderboard-${tabName}`).classList.add('active');
}

// Classement Général
function renderGeneralLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    leaderboardData.forEach((player, index) => {
        const row = document.createElement('tr');
        if (currentUser && player.user_id === currentUser.id) {
            row.className = 'current-user';
        }

        row.innerHTML = `
            <td class="rank">${getRankEmoji(index + 1)}</td>
            <td class="player-name">${player.pseudo}</td>
            <td>${player.quiz_score}</td>
            <td>${player.culture_g_score || 0}</td>
            <td>${player.pronostics_score}</td>
            <td>${player.defis_score}</td>
            <td class="total-score">${player.total_score}</td>
        `;

        tbody.appendChild(row);
    });
}

// Classement Pronostics
function renderPronosticsLeaderboard() {
    const sorted = [...leaderboardData].sort((a, b) => b.pronostics_score - a.pronostics_score);
    const tbody = document.getElementById('leaderboard-pronostics-body');
    tbody.innerHTML = '';

    sorted.forEach((player, index) => {
        const row = document.createElement('tr');
        if (currentUser && player.user_id === currentUser.id) {
            row.className = 'current-user';
        }

        row.innerHTML = `
            <td class="rank">${getRankEmoji(index + 1)}</td>
            <td class="player-name">${player.pseudo}</td>
            <td class="total-score">${player.pronostics_score} pts</td>
        `;

        tbody.appendChild(row);
    });
}

// Classement Quiz
function renderQuizLeaderboard() {
    const sorted = [...leaderboardData].sort((a, b) => b.quiz_score - a.quiz_score);
    const tbody = document.getElementById('leaderboard-quiz-body');
    tbody.innerHTML = '';

    sorted.forEach((player, index) => {
        const row = document.createElement('tr');
        if (currentUser && player.user_id === currentUser.id) {
            row.className = 'current-user';
        }

        row.innerHTML = `
            <td class="rank">${getRankEmoji(index + 1)}</td>
            <td class="player-name">${player.pseudo}</td>
            <td class="total-score">${player.quiz_score} pts</td>
        `;

        tbody.appendChild(row);
    });
}

// Classement Culture G (avec score brut)
async function renderCultureGLeaderboard() {
    try {
        const response = await fetch('/api/culture-g/leaderboard');
        const ranking = await response.json();

        const tbody = document.getElementById('leaderboard-culture-g-body');
        tbody.innerHTML = '';

        ranking.forEach((player, index) => {
            const row = document.createElement('tr');
            if (currentUser && player.id === currentUser.id) {
                row.className = 'current-user';
            }

            row.innerHTML = `
                <td class="rank">${getRankEmoji(index + 1)}</td>
                <td class="player-name">${player.pseudo}</td>
                <td>${player.raw_score} / ~80</td>
                <td class="total-score">${player.awarded_points || 0} pts</td>
            `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur chargement classement Culture G:', error);
    }
}

// Classement Costume
async function renderCostumeLeaderboard() {
    try {
        const response = await fetch('/api/costume/results');
        const { results, totalVotes } = await response.json();

        const tbody = document.getElementById('leaderboard-costume-body');
        tbody.innerHTML = '';

        // Filtrer ceux qui ont des votes et ajouter les points potentiels
        results.forEach((player, index) => {
            const row = document.createElement('tr');
            if (currentUser && player.id === currentUser.id) {
                row.className = 'current-user';
            }

            // Points attribués selon le rang
            let points = 0;
            if (index === 0 && player.votes > 0) points = 30;
            else if (index === 1 && player.votes > 0) points = 20;
            else if (index === 2 && player.votes > 0) points = 10;

            row.innerHTML = `
                <td class="rank">${getRankEmoji(index + 1)}</td>
                <td class="player-name">${player.pseudo}</td>
                <td>${player.votes} vote${player.votes > 1 ? 's' : ''}</td>
                <td class="total-score">${points > 0 ? points + ' pts' : '-'}</td>
            `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur chargement classement Costume:', error);
    }
}

// Helper pour les emojis de rang
function getRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
}

// === ADMIN FUNCTIONS ===

async function initializeAdmin() {
    console.log('🔐 Mode admin activé');
    await loadAdminStats();
    await loadAdminInterface();
}

async function loadAdminStats() {
    console.log('🔧 loadAdminStats appelée');
    try {
        console.log('📡 Fetch /api/admin/stats...');
        const response = await fetch('/api/admin/stats');
        console.log('📡 Response status:', response.status);
        const stats = await response.json();
        console.log('📊 Stats reçues:', stats);

        const usersEl = document.getElementById('admin-stat-users');
        const pronosticsEl = document.getElementById('admin-stat-pronostics');

        console.log('Elements trouvés:', { usersEl, pronosticsEl });

        if (usersEl) usersEl.textContent = stats.totalUsers || 0;
        if (pronosticsEl) pronosticsEl.textContent = stats.totalPronostics || 0;
    } catch (error) {
        console.error('❌ Erreur chargement stats admin:', error);
    }
}

async function loadAdminInterface() {
    console.log('🔧 loadAdminInterface appelée');

    // Charger les résultats officiels d'abord
    await loadOfficialResults();

    // Vérifier que les éléments existent
    const top15Grid = document.getElementById('admin-top15-grid');
    const top5Grid = document.getElementById('admin-top5-grid');

    console.log('📦 Éléments grilles:', { top15Grid, top5Grid });

    if (!top15Grid || !top5Grid) {
        console.error('❌ Éléments admin non trouvés');
        return;
    }

    // Vérifier que candidates est chargé
    console.log('📋 Candidates actuels:', candidates);
    if (!candidates || candidates.length === 0) {
        console.log('⏳ Chargement des candidates...');
        await loadCandidates();
        console.log('✅ Candidates chargés:', candidates.length);
    }

    top15Grid.innerHTML = '';

    console.log('📝 Création des checkboxes pour', candidates.length, 'candidates');

    candidates.forEach((candidate, index) => {
        // Top 15
        const label15 = document.createElement('label');
        const inputId15 = `admin-top15-${index}`;
        label15.setAttribute('for', inputId15);
        label15.innerHTML = `
            <input type="checkbox" id="${inputId15}" value="${candidate}" data-admin-type="top15">
            ${candidate}
        `;
        top15Grid.appendChild(label15);
    });

    console.log('✅ Grille Top15 remplie:', top15Grid.children.length);

    // Limiter les sélections Top 15
    document.querySelectorAll('input[data-admin-type="top15"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-admin-type="top15"]:checked');
            if (checked.length > 15) {
                cb.checked = false;
                alert('Maximum 15 candidates !');
            }
        });
    });

    // Si le top 15 a déjà été validé, pré-cocher les cases
    if (officialResults.top15 && officialResults.top15.length > 0) {
        officialResults.top15.forEach(candidate => {
            const checkbox = document.querySelector(`input[data-admin-type="top15"][value="${candidate}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Mettre à jour la grille Top 5 (filtrée selon Top 15 validé, avec pré-cochage)
    updateAdminTop5Grid();

    // Mettre à jour les selects du classement final (filtrés selon Top 5 validé, avec pré-remplissage)
    updateAdminFinalSelects();

    // Mettre à jour l'affichage de l'étape actuelle ET désactiver les éléments déjà validés
    updateAdminStepDisplay();

    // Charger le preview des votes costume
    await loadAdminCostumePreview();

    // Charger le classement Culture G
    await loadAdminCultureGRanking();

    console.log('✅ loadAdminInterface terminée avec succès');
}

// Charger le preview des votes costume pour l'admin
async function loadAdminCostumePreview() {
    try {
        const response = await fetch('/api/costume/results');
        const { results, totalVotes } = await response.json();

        const container = document.getElementById('admin-costume-preview');
        if (!container) return;

        if (totalVotes === 0) {
            container.innerHTML = '<p style="color: var(--gris-elegant); font-style: italic; margin-bottom: 15px;">Aucun vote pour le moment</p>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        const points = [30, 20, 10];

        container.innerHTML = `
            <div style="margin-bottom: 15px;">
                <p style="margin-bottom: 10px;">Classement actuel (${totalVotes} votes):</p>
                ${results.filter(r => r.votes > 0).slice(0, 5).map((player, index) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px; background: ${index < 3 ? 'rgba(212, 175, 55, 0.15)' : 'transparent'}; border-radius: 5px; margin-bottom: 5px;">
                        <span>${medals[index] || '  '} ${player.pseudo}</span>
                        <span>${player.votes} vote${player.votes > 1 ? 's' : ''} ${index < 3 ? `→ <strong>${points[index]} pts</strong>` : ''}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Erreur chargement preview costume:', error);
    }
}

// Admin: Attribuer les points costume
async function adminAwardCostumePoints() {
    const confirmation = confirm(
        `🏆 ATTRIBUTION DES POINTS COSTUME 🏆\n\n` +
        `Tu vas attribuer les points aux gagnants du vote:\n` +
        `🥇 1er: 30 points\n` +
        `🥈 2ème: 20 points\n` +
        `🥉 3ème: 10 points\n\n` +
        `Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/costume-awards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        const messageDiv = document.getElementById('costume-award-message');

        if (response.ok) {
            const awardedList = data.awarded.map(a => `${a.pseudo}: ${a.votes} votes → +${a.points} pts`).join('\n');
            messageDiv.innerHTML = `✅ Points attribués !<br>${data.awarded.map(a => `<strong>${a.pseudo}</strong>: +${a.points} pts`).join('<br>')}`;
            messageDiv.style.color = '#27ae60';

            // Recharger
            await loadAdminStats();
            await loadLeaderboard();
            await loadScore();
            await loadAdminCostumePreview();
        } else {
            messageDiv.textContent = `❌ ${data.error}`;
            messageDiv.style.color = '#e74c3c';
        }
    } catch (error) {
        console.error('Erreur attribution points costume:', error);
        alert('Erreur lors de l\'attribution des points');
    }
}


// Variable pour stocker les résultats officiels
let officialResults = { current_step: 0, top15: [], top5: [], classement_final: [] };

// Charger les résultats officiels
async function loadOfficialResults() {
    try {
        const response = await fetch('/api/official-results');
        officialResults = await response.json();
        console.log('📊 Résultats officiels chargés:', officialResults);
        return officialResults;
    } catch (error) {
        console.error('Erreur chargement résultats officiels:', error);
        return { current_step: 0, top15: [], top5: [], classement_final: [] };
    }
}

// Mettre à jour l'affichage de l'étape actuelle (admin)
function updateAdminStepDisplay() {
    const stepLabels = ['En attente de validation', 'Top 15 validé ✅', 'Top 5 validé ✅', 'Terminé - Miss France élue ! 👑'];
    const currentStepDiv = document.getElementById('admin-current-step');
    if (currentStepDiv) {
        currentStepDiv.textContent = stepLabels[officialResults.current_step] || 'En attente';
    }

    // Mettre à jour les indicateurs d'étapes
    for (let i = 0; i <= 3; i++) {
        const indicator = document.getElementById(`step-indicator-${i}`);
        if (indicator) {
            if (i < officialResults.current_step) {
                indicator.style.background = '#27ae60';
                indicator.style.color = 'white';
            } else if (i === officialResults.current_step) {
                indicator.style.background = 'var(--gold)';
                indicator.style.color = 'black';
            } else {
                indicator.style.background = '#333';
                indicator.style.color = '#888';
            }
        }
    }

    // Mettre à jour les status des étapes
    const step1Status = document.getElementById('step1-status');
    const step2Status = document.getElementById('step2-status');
    const step3Status = document.getElementById('step3-status');

    // ÉTAPE 1 - Top 15
    if (step1Status) {
        if (officialResults.current_step >= 1) {
            step1Status.textContent = '✅ Déjà validé par un admin';
            step1Status.style.color = '#27ae60';
        } else {
            step1Status.textContent = '⏳ En attente';
            step1Status.style.color = '#f39c12';
        }
    }

    // Désactiver les checkboxes et bouton Top 15 si déjà validé
    const top15Button = document.querySelector('button[onclick="adminValidateTop15()"]');
    const top15Checkboxes = document.querySelectorAll('input[data-admin-type="top15"]');
    if (officialResults.current_step >= 1) {
        if (top15Button) {
            top15Button.disabled = true;
            top15Button.textContent = '✅ TOP 15 DÉJÀ VALIDÉ';
            top15Button.style.background = '#27ae60';
            top15Button.style.cursor = 'not-allowed';
            top15Button.style.opacity = '0.7';
        }
        top15Checkboxes.forEach(cb => {
            cb.disabled = true;
        });
    }

    // ÉTAPE 2 - Top 5
    if (step2Status) {
        if (officialResults.current_step >= 2) {
            step2Status.textContent = '✅ Déjà validé par un admin';
            step2Status.style.color = '#27ae60';
        } else if (officialResults.current_step >= 1) {
            step2Status.textContent = '⏳ En attente';
            step2Status.style.color = '#f39c12';
        } else {
            step2Status.textContent = '🔒 Bloqué (valider Top 15 d\'abord)';
            step2Status.style.color = '#888';
        }
    }

    // Désactiver les checkboxes et bouton Top 5 si déjà validé
    const top5Button = document.querySelector('button[onclick="adminValidateTop5()"]');
    const top5Checkboxes = document.querySelectorAll('input[data-admin-type="top5"]');
    if (officialResults.current_step >= 2) {
        if (top5Button) {
            top5Button.disabled = true;
            top5Button.textContent = '✅ TOP 5 DÉJÀ VALIDÉ';
            top5Button.style.background = '#27ae60';
            top5Button.style.cursor = 'not-allowed';
            top5Button.style.opacity = '0.7';
        }
        top5Checkboxes.forEach(cb => {
            cb.disabled = true;
        });
    }

    // ÉTAPE 3 - Classement Final
    if (step3Status) {
        if (officialResults.current_step >= 3) {
            step3Status.textContent = '✅ Déjà validé - Miss France élue !';
            step3Status.style.color = '#27ae60';
        } else if (officialResults.current_step >= 2) {
            step3Status.textContent = '⏳ En attente';
            step3Status.style.color = '#f39c12';
        } else {
            step3Status.textContent = '🔒 Bloqué (valider Top 5 d\'abord)';
            step3Status.style.color = '#888';
        }
    }

    // Désactiver les selects et bouton Final si déjà validé
    const finalButton = document.querySelector('button[onclick="adminValidateFinal()"]');
    const finalSelects = document.querySelectorAll('.admin-final-rank');
    if (officialResults.current_step >= 3) {
        if (finalButton) {
            finalButton.disabled = true;
            finalButton.textContent = '✅ CLASSEMENT FINAL DÉJÀ VALIDÉ';
            finalButton.style.background = '#27ae60';
            finalButton.style.cursor = 'not-allowed';
            finalButton.style.opacity = '0.7';
        }
        finalSelects.forEach(select => {
            select.disabled = true;
        });
    }

    // Afficher/cacher les boutons d'annulation selon l'étape actuelle
    const btnResetStep1 = document.getElementById('btn-reset-step1');
    const btnResetStep2 = document.getElementById('btn-reset-step2');
    const btnResetStep3 = document.getElementById('btn-reset-step3');

    // Bouton annuler Top 15 : visible si step >= 1
    if (btnResetStep1) {
        btnResetStep1.style.display = officialResults.current_step >= 1 ? 'block' : 'none';
    }
    // Bouton annuler Top 5 : visible si step >= 2
    if (btnResetStep2) {
        btnResetStep2.style.display = officialResults.current_step >= 2 ? 'block' : 'none';
    }
    // Bouton annuler Final : visible si step >= 3
    if (btnResetStep3) {
        btnResetStep3.style.display = officialResults.current_step >= 3 ? 'block' : 'none';
    }
}

// Annuler une étape de validation (retour en arrière)
async function adminResetStep(targetStep) {
    const stepNames = {
        0: 'annuler le Top 15 (revenir à zéro)',
        1: 'annuler le Top 5 (garder seulement le Top 15)',
        2: 'annuler le Classement Final (garder Top 15 et Top 5)'
    };

    const confirmation = confirm(
        `⚠️ ANNULATION ⚠️\n\n` +
        `Tu vas ${stepNames[targetStep]}.\n\n` +
        `Les scores de tous les joueurs seront recalculés.\n\n` +
        `Cette action est irréversible. Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/reset-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetStep })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ ${data.message}\n\n${data.usersUpdated} joueurs mis à jour.`);

            // Recharger les données et rafraîchir l'interface
            await loadOfficialResults();
            updateAdminStepDisplay();
            updateAdminTop5Grid();
            updateAdminFinalSelects();
            await loadAdminStats();
            await loadLeaderboard();
            await loadScore();

            // Réinitialiser les boutons de validation
            resetValidationButtons();
        } else {
            alert(`❌ Erreur: ${data.error}`);
        }
    } catch (error) {
        console.error('Erreur reset step:', error);
        alert('Erreur lors de l\'annulation');
    }
}

// Réinitialiser l'apparence des boutons de validation après un reset
function resetValidationButtons() {
    // Reset bouton Top 15
    const top15Button = document.querySelector('button[onclick="adminValidateTop15()"]');
    if (top15Button && officialResults.current_step < 1) {
        top15Button.disabled = false;
        top15Button.textContent = '✅ VALIDER LE TOP 15 (met à jour les scores)';
        top15Button.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        top15Button.style.cursor = 'pointer';
        top15Button.style.opacity = '1';
    }
    const top15Checkboxes = document.querySelectorAll('input[data-admin-type="top15"]');
    if (officialResults.current_step < 1) {
        top15Checkboxes.forEach(cb => cb.disabled = false);
    }

    // Reset bouton Top 5
    const top5Button = document.querySelector('button[onclick="adminValidateTop5()"]');
    if (top5Button && officialResults.current_step < 2) {
        top5Button.disabled = false;
        top5Button.textContent = '✅ VALIDER LE TOP 5 (met à jour les scores)';
        top5Button.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
        top5Button.style.cursor = 'pointer';
        top5Button.style.opacity = '1';
    }
    const top5Checkboxes = document.querySelectorAll('input[data-admin-type="top5"]');
    if (officialResults.current_step < 2) {
        top5Checkboxes.forEach(cb => cb.disabled = false);
    }

    // Reset bouton Final
    const finalButton = document.querySelector('button[onclick="adminValidateFinal()"]');
    if (finalButton && officialResults.current_step < 3) {
        finalButton.disabled = false;
        finalButton.textContent = '✅ VALIDER LE CLASSEMENT FINAL + PRONO D\'OR (scores finaux)';
        finalButton.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        finalButton.style.cursor = 'pointer';
        finalButton.style.opacity = '1';
    }
    const finalSelects = document.querySelectorAll('.admin-final-rank');
    if (officialResults.current_step < 3) {
        finalSelects.forEach(select => select.disabled = false);
    }
}

// Mettre à jour la grille Top 5 admin (afficher seulement les candidates du Top 15 validé)
function updateAdminTop5Grid() {
    const top5Grid = document.getElementById('admin-top5-grid');
    if (!top5Grid) return;

    top5Grid.innerHTML = '';

    // Si le top 15 n'est pas encore validé, afficher toutes les candidates
    const candidatesToShow = officialResults.current_step >= 1 && officialResults.top15.length > 0
        ? officialResults.top15
        : candidates;

    const isDisabled = officialResults.current_step >= 2;

    candidatesToShow.forEach((candidate, index) => {
        const label = document.createElement('label');
        const inputId = `admin-top5-${index}`;
        label.setAttribute('for', inputId);
        const isChecked = officialResults.top5 && officialResults.top5.includes(candidate);
        label.innerHTML = `
            <input type="checkbox" id="${inputId}" value="${candidate}" data-admin-type="top5" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
            ${candidate}
        `;
        top5Grid.appendChild(label);
    });

    // Réappliquer les listeners seulement si non désactivé
    if (!isDisabled) {
        document.querySelectorAll('input[data-admin-type="top5"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const checked = document.querySelectorAll('input[data-admin-type="top5"]:checked');
                if (checked.length > 5) {
                    cb.checked = false;
                    alert('Maximum 5 candidates !');
                }
            });
        });
    }
}

// Mettre à jour les selects du classement final (afficher seulement les candidates du Top 5 validé)
function updateAdminFinalSelects() {
    const selects = document.querySelectorAll('.admin-final-rank');

    // Si le top 5 n'est pas encore validé, afficher toutes les candidates
    const candidatesToShow = officialResults.current_step >= 2 && officialResults.top5.length > 0
        ? officialResults.top5
        : candidates;

    const isDisabled = officialResults.current_step >= 3;

    selects.forEach((select, idx) => {
        const defaultLabels = ['-- Miss France 2026 --', '-- 1ère Dauphine --', '-- 2ème Dauphine --', '-- 3ème Dauphine --', '-- 4ème Dauphine --'];
        select.innerHTML = `<option value="">${defaultLabels[idx]}</option>`;
        candidatesToShow.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });

        // Pré-remplir et désactiver si déjà validé
        if (isDisabled && officialResults.classement_final && officialResults.classement_final[idx]) {
            select.value = officialResults.classement_final[idx];
            select.disabled = true;
        }
    });
}

// ÉTAPE 1: Valider le Top 15
async function adminValidateTop15() {
    const top15 = Array.from(document.querySelectorAll('input[data-admin-type="top15"]:checked')).map(cb => cb.value);

    if (top15.length !== 15) {
        alert('Sélectionne exactement 15 candidates !');
        return;
    }

    const confirmation = confirm(
        `⚠️ VALIDATION TOP 15 ⚠️\n\n` +
        `Tu vas valider ces 15 candidates:\n` +
        `${top15.join(', ')}\n\n` +
        `💡 Les joueurs ayant choisi une candidate qui n'est PAS dans cette liste gagnent automatiquement 10 pts bonus.\n\n` +
        `Les scores de tous les joueurs seront mis à jour. Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/validate-top15', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ top15 })
        });

        const data = await response.json();
        const messageDiv = document.getElementById('step1-message');

        if (data.success) {
            messageDiv.textContent = `✅ ${data.message} - ${data.usersUpdated} joueurs mis à jour`;
            messageDiv.style.color = '#27ae60';

            // Recharger les résultats officiels et mettre à jour l'interface
            await loadOfficialResults();
            updateAdminStepDisplay();
            updateAdminTop5Grid();
            updateAdminFinalSelects();

            // Recharger les stats et classement
            await loadAdminStats();
            await loadLeaderboard();
            await loadScore();
        } else {
            messageDiv.textContent = `❌ ${data.error}`;
            messageDiv.style.color = '#e74c3c';
        }
    } catch (error) {
        console.error('Erreur validation Top 15:', error);
        alert('Erreur lors de la validation');
    }
}

// ÉTAPE 2: Valider le Top 5
async function adminValidateTop5() {
    if (officialResults.current_step < 1) {
        alert('Tu dois d\'abord valider le Top 15 !');
        return;
    }

    const top5 = Array.from(document.querySelectorAll('input[data-admin-type="top5"]:checked')).map(cb => cb.value);

    if (top5.length !== 5) {
        alert('Sélectionne exactement 5 candidates !');
        return;
    }

    const confirmation = confirm(
        `⚠️ VALIDATION TOP 5 ⚠️\n\n` +
        `Tu vas valider ces 5 finalistes:\n` +
        `${top5.join(', ')}\n\n` +
        `💡 Les joueurs ayant choisi une candidate qui n'est PAS dans cette liste gagnent automatiquement 20 pts bonus.\n\n` +
        `Les scores de tous les joueurs seront mis à jour. Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/validate-top5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ top5 })
        });

        const data = await response.json();
        const messageDiv = document.getElementById('step2-message');

        if (data.success) {
            messageDiv.textContent = `✅ ${data.message} - ${data.usersUpdated} joueurs mis à jour`;
            messageDiv.style.color = '#27ae60';

            // Recharger les résultats officiels et mettre à jour l'interface
            await loadOfficialResults();
            updateAdminStepDisplay();
            updateAdminFinalSelects();

            // Recharger les stats et classement
            await loadAdminStats();
            await loadLeaderboard();
            await loadScore();
        } else {
            messageDiv.textContent = `❌ ${data.error}`;
            messageDiv.style.color = '#e74c3c';
        }
    } catch (error) {
        console.error('Erreur validation Top 5:', error);
        alert('Erreur lors de la validation');
    }
}

// ÉTAPE 3: Valider le classement final
async function adminValidateFinal() {
    if (officialResults.current_step < 2) {
        alert('Tu dois d\'abord valider le Top 5 !');
        return;
    }

    const classementFinal = [];
    for (let i = 1; i <= 5; i++) {
        const select = document.querySelector(`.admin-final-rank[data-rank="${i}"]`);
        classementFinal.push(select.value);
    }

    if (classementFinal.some(c => !c)) {
        alert('Remplis tout le classement final !');
        return;
    }

    const confirmation = confirm(
        `👑 VALIDATION CLASSEMENT FINAL 👑\n\n` +
        `🥇 Miss France 2026: ${classementFinal[0]}\n` +
        `🥈 1ère Dauphine: ${classementFinal[1]}\n` +
        `🥉 2ème Dauphine: ${classementFinal[2]}\n` +
        `4️⃣ 3ème Dauphine: ${classementFinal[3]}\n` +
        `5️⃣ 4ème Dauphine: ${classementFinal[4]}\n\n` +
        `⚠️ Les scores finaux et le PRONO D'OR (80 pts) seront calculés.\n\n` +
        `Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/validate-final', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classementFinal })
        });

        const data = await response.json();
        const messageDiv = document.getElementById('step3-message');

        if (data.success) {
            messageDiv.innerHTML = `🎉 ${data.message}<br>👑 ${data.missFramce2026} est Miss France 2026 !<br>${data.usersUpdated} joueurs mis à jour`;
            messageDiv.style.color = '#27ae60';

            // Recharger les résultats officiels et mettre à jour l'interface
            await loadOfficialResults();
            updateAdminStepDisplay();

            // Recharger les stats et classement
            await loadAdminStats();
            await loadLeaderboard();
            await loadScore();

            // Message de victoire
            alert(`🎉 FÉLICITATIONS ! 🎉\n\n${data.missFramce2026} est Miss France 2026 !\n\nTous les scores ont été calculés, y compris le Prono d'Or !`);
        } else {
            messageDiv.textContent = `❌ ${data.error}`;
            messageDiv.style.color = '#e74c3c';
        }
    } catch (error) {
        console.error('Erreur validation classement final:', error);
        alert('Erreur lors de la validation');
    }
}

async function adminValidateResults() {
    // Cette fonction est conservée pour compatibilité mais n'est plus utilisée
    alert('Utilise maintenant les boutons de validation par étape !');
}

// ============================================
// QUESTIONNAIRE CULTURE GÉNÉRALE OFFICIEL
// ============================================

let cultureGData = null;
let currentCultureGCategory = null;
let cultureGAnswers = {};

const categoryEmojis = {
    actualite: '📰',
    histoire_geo: '🌍',
    arts: '🎨',
    sciences: '🔬',
    probleme: '🧮',
    miss: '👑',
    francais: '📝',
    anglais: '🇬🇧',
    logique: '🧩'
};

async function loadCultureGSection() {
    try {
        // Charger les questions et la progression
        const [questionsRes, progressRes] = await Promise.all([
            fetch('/api/culture-g/questions'),
            fetch('/api/culture-g/progress')
        ]);

        cultureGData = await questionsRes.json();
        const progress = await progressRes.json();

        // Mettre à jour les stats
        document.getElementById('culture-g-answered').textContent = progress.totalAnswers;
        document.getElementById('culture-g-total').textContent = progress.totalQuestions;
        document.getElementById('culture-g-points-display').textContent = progress.totalPoints;
        document.getElementById('culture-g-max').textContent = progress.maxPoints;

        // Afficher les catégories
        renderCultureGCategories(progress.categoryProgress);

    } catch (error) {
        console.error('Erreur chargement Culture G:', error);
    }
}

function renderCultureGCategories(categoryProgress) {
    const container = document.getElementById('culture-g-categories');
    container.innerHTML = '';

    Object.entries(cultureGData.categories).forEach(([key, category]) => {
        const progress = categoryProgress[key] || { answered: 0, total: category.questions.length, points: 0, maxPoints: category.totalPoints };
        const isCompleted = progress.answered >= progress.total;
        const emoji = categoryEmojis[key] || '📚';

        const card = document.createElement('div');
        card.className = 'culture-g-category-card';
        card.style.cssText = `
            background: ${isCompleted ? 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)' : 'var(--noir-soft)'};
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 15px;
            cursor: ${isCompleted ? 'default' : 'pointer'};
            transition: transform 0.2s, box-shadow 0.2s;
            border: 2px solid ${isCompleted ? '#27ae60' : 'transparent'};
        `;

        if (!isCompleted) {
            card.onmouseenter = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 5px 20px rgba(212, 175, 55, 0.3)'; };
            card.onmouseleave = () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none'; };
            card.onclick = () => openCultureGCategory(key);
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 5px 0; color: ${isCompleted ? 'white' : 'var(--gold)'};">
                        ${emoji} ${category.name}
                    </h3>
                    <p style="margin: 0; color: ${isCompleted ? 'rgba(255,255,255,0.8)' : 'var(--gris-elegant)'}; font-size: 0.9em;">
                        ${category.questions.length} questions • ${category.totalPoints} points max
                    </p>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 1.5em; color: ${isCompleted ? 'white' : 'var(--gold)'};">
                        ${isCompleted ? '✅' : `${progress.answered}/${progress.total}`}
                    </span>
                    ${isCompleted ? `<br><span style="color: rgba(255,255,255,0.9); font-size: 0.9em;">${progress.points}/${progress.maxPoints} pts</span>` : ''}
                </div>
            </div>
            ${!isCompleted && progress.answered > 0 ? `
                <div style="margin-top: 10px; background: rgba(0,0,0,0.2); border-radius: 10px; height: 8px; overflow: hidden;">
                    <div style="background: var(--gold); height: 100%; width: ${(progress.answered / progress.total) * 100}%;"></div>
                </div>
            ` : ''}
        `;

        container.appendChild(card);
    });
}

function openCultureGCategory(categoryKey) {
    currentCultureGCategory = categoryKey;
    cultureGAnswers = {};

    const category = cultureGData.categories[categoryKey];

    document.getElementById('culture-g-categories').style.display = 'none';
    document.querySelector('.culture-g-intro').style.display = 'none';
    document.getElementById('culture-g-quiz-area').style.display = 'block';
    document.getElementById('culture-g-category-name').textContent = `${categoryEmojis[categoryKey] || '📚'} ${category.name}`;
    document.getElementById('culture-g-results').style.display = 'none';
    document.getElementById('culture-g-submit-btn').style.display = 'block';

    const container = document.getElementById('culture-g-questions-container');
    container.innerHTML = '';

    category.questions.forEach((question, index) => {
        if (question.answered) return; // Skip answered questions

        const questionDiv = document.createElement('div');
        questionDiv.className = 'culture-g-question';
        questionDiv.style.cssText = `
            background: var(--noir-soft);
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 20px;
            border-left: 4px solid var(--gold);
        `;

        let answersHTML = '';

        if (question.type === 'single') {
            answersHTML = question.answers.map((answer, i) => `
                <label style="display: flex; align-items: center; padding: 12px; background: var(--noir-medium); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s;">
                    <input type="radio" name="q-${question.id}" value="${i}" style="margin-right: 10px; accent-color: var(--gold);">
                    <span>${answer}</span>
                </label>
            `).join('');
        } else if (question.type === 'multiple') {
            answersHTML = `<p style="color: var(--gris-elegant); font-size: 0.9em; margin-bottom: 10px;">⚠️ Plusieurs réponses possibles</p>` +
                question.answers.map((answer, i) => `
                <label style="display: flex; align-items: center; padding: 12px; background: var(--noir-medium); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s;">
                    <input type="checkbox" name="q-${question.id}" value="${i}" style="margin-right: 10px; accent-color: var(--gold);">
                    <span>${answer}</span>
                </label>
            `).join('');
        } else if (question.type === 'text') {
            answersHTML = `
                <input type="text" id="q-${question.id}" placeholder="Ta réponse..." style="width: 100%; padding: 12px; border-radius: 8px; border: 2px solid var(--gold); background: var(--noir-medium); color: white; font-size: 1em;">
            `;
        }

        // Bonus question if any
        let bonusHTML = '';
        if (question.bonus) {
            bonusHTML = `
                <div style="margin-top: 15px; padding: 15px; background: rgba(212, 175, 55, 0.1); border-radius: 10px; border: 1px dashed var(--gold);">
                    <label style="color: var(--gold); font-weight: bold;">⭐ BONUS (+${question.bonus.points} pt): ${question.bonus.question}</label>
                    <input type="text" id="bonus-${question.id}" placeholder="Réponse bonus..." style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 8px; border: 1px solid var(--gold); background: var(--noir-medium); color: white;">
                </div>
            `;
        }

        questionDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <span style="background: var(--gold); color: black; padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9em;">
                    Q${index + 1}
                </span>
                <span style="color: var(--gold); font-size: 0.9em;">${question.points} pt${question.points > 1 ? 's' : ''}</span>
            </div>
            <h4 style="margin: 0 0 15px 0; color: var(--blanc-perle); line-height: 1.4;">${question.question}</h4>
            ${question.info ? `<p style="color: var(--gris-elegant); font-size: 0.85em; margin-bottom: 15px; font-style: italic;">💡 ${question.info}</p>` : ''}
            <div class="answers-area">${answersHTML}</div>
            ${bonusHTML}
        `;

        container.appendChild(questionDiv);
    });

    // Check if all questions already answered
    const unansweredCount = category.questions.filter(q => !q.answered).length;
    if (unansweredCount === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <span style="font-size: 4em;">✅</span>
                <h3 style="color: var(--gold); margin: 20px 0;">Catégorie terminée !</h3>
                <p style="color: var(--gris-elegant);">Tu as déjà répondu à toutes les questions de cette catégorie.</p>
            </div>
        `;
        document.getElementById('culture-g-submit-btn').style.display = 'none';
    }
}

function closeCultureGCategory() {
    document.getElementById('culture-g-categories').style.display = 'block';
    document.querySelector('.culture-g-intro').style.display = 'block';
    document.getElementById('culture-g-quiz-area').style.display = 'none';
    currentCultureGCategory = null;
    cultureGAnswers = {};

    // Reload section to update progress
    loadCultureGSection();
}

// ============================================
// ADMIN CULTURE G FUNCTIONS
// ============================================

async function loadAdminCultureGRanking() {
    try {
        const response = await fetch('/api/admin/culture-g-ranking');
        const data = await response.json();

        const container = document.getElementById('admin-culture-g-ranking');
        const statusEl = document.getElementById('culture-g-admin-status');
        const validateBtn = document.getElementById('culture-g-validate-btn');

        if (!container) return;

        if (data.isValidated) {
            statusEl.textContent = '✅ Déjà validé';
            statusEl.style.color = '#27ae60';
            validateBtn.disabled = true;
            validateBtn.textContent = '✅ CULTURE G DÉJÀ VALIDÉ';
            validateBtn.style.background = '#27ae60';
            validateBtn.style.cursor = 'not-allowed';
            validateBtn.style.opacity = '0.7';
        } else {
            statusEl.textContent = '⏳ En attente';
            statusEl.style.color = '#f39c12';
        }

        if (data.rankings.length === 0) {
            container.innerHTML = '<p style="color: var(--gris-elegant); font-style: italic;">Aucun joueur n\'a encore participé au questionnaire Culture G.</p>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        const points = [15, 10, 5];

        container.innerHTML = `
            <p style="margin-bottom: 10px; color: var(--blanc-perle);">Classement des joueurs par nombre de bonnes réponses :</p>
            ${data.rankings.map((player, index) => `
                <div style="display: flex; justify-content: space-between; padding: 10px; background: ${index < 3 ? 'rgba(155, 89, 182, 0.2)' : 'var(--noir-medium)'}; border-radius: 8px; margin-bottom: 8px;">
                    <span>
                        ${medals[index] || `${index + 1}.`} <strong>${player.pseudo}</strong>
                        <span style="color: var(--gris-elegant); font-size: 0.85em;">(${player.total_answered} questions)</span>
                    </span>
                    <span>
                        <strong style="color: #9b59b6;">${player.culture_g_correct || 0} bonnes réponses</strong>
                        ${index < 3 && !data.isValidated ? ` → <span style="color: var(--gold);">+${points[index]} pts</span>` : ''}
                        ${data.isValidated && player.culture_g_score > 0 ? ` <span style="color: #27ae60;">✅ +${player.culture_g_score} pts</span>` : ''}
                    </span>
                </div>
            `).join('')}
        `;
    } catch (error) {
        console.error('Erreur chargement classement Culture G:', error);
    }
}

async function adminValidateCultureG() {
    const confirmation = confirm(
        `🎓 ATTRIBUTION DES POINTS CULTURE G 🎓\n\n` +
        `Tu vas attribuer les points aux 3 meilleurs scores:\n` +
        `🥇 1er: 15 points\n` +
        `🥈 2ème: 10 points\n` +
        `🥉 3ème: 5 points\n\n` +
        `Cette action est irréversible. Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/validate-culture-g', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        const messageDiv = document.getElementById('culture-g-award-message');

        if (response.ok) {
            messageDiv.innerHTML = `✅ Points Culture G attribués !<br>${data.awarded.map(a => `<strong>${a.pseudo}</strong>: +${a.points} pts`).join('<br>')}`;
            messageDiv.style.color = '#27ae60';

            // Recharger les données
            await loadAdminCultureGRanking();
            await loadAdminStats();
            await loadLeaderboard();
            await loadScore();
        } else {
            messageDiv.textContent = `❌ ${data.error}`;
            messageDiv.style.color = '#e74c3c';
        }
    } catch (error) {
        console.error('Erreur validation Culture G:', error);
        alert('Erreur lors de l\'attribution des points');
    }
}

async function submitCultureGCategory() {
    if (!currentCultureGCategory) return;

    const category = cultureGData.categories[currentCultureGCategory];
    const answers = {};

    // Collect all answers
    category.questions.forEach(question => {
        if (question.answered) return;

        let mainAnswer = null;
        let bonusAnswer = null;

        if (question.type === 'single') {
            const selected = document.querySelector(`input[name="q-${question.id}"]:checked`);
            if (selected) mainAnswer = parseInt(selected.value);
        } else if (question.type === 'multiple') {
            const selected = document.querySelectorAll(`input[name="q-${question.id}"]:checked`);
            mainAnswer = Array.from(selected).map(s => parseInt(s.value));
        } else if (question.type === 'text') {
            const input = document.getElementById(`q-${question.id}`);
            if (input) mainAnswer = input.value.trim();
        }

        // Bonus answer
        if (question.bonus) {
            const bonusInput = document.getElementById(`bonus-${question.id}`);
            if (bonusInput) bonusAnswer = bonusInput.value.trim();
        }

        if (mainAnswer !== null && mainAnswer !== '' && (Array.isArray(mainAnswer) ? mainAnswer.length > 0 : true)) {
            answers[question.id] = { main: mainAnswer, bonus: bonusAnswer };
        }
    });

    if (Object.keys(answers).length === 0) {
        alert('Réponds à au moins une question avant de valider !');
        return;
    }

    try {
        const response = await fetch('/api/culture-g/submit-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryKey: currentCultureGCategory, answers })
        });

        const data = await response.json();

        if (data.success) {
            // Show results
            const resultsDiv = document.getElementById('culture-g-results');
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = `
                <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding: 25px; border-radius: 15px; text-align: center; margin-top: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: white;">🎉 Réponses enregistrées !</h3>
                    <div style="display: flex; justify-content: center; gap: 30px;">
                        <div>
                            <span style="font-size: 2.5em; color: white;">${data.correctCount}</span>
                            <p style="margin: 0; color: rgba(255,255,255,0.8);">Bonnes réponses</p>
                        </div>
                        <div>
                            <span style="font-size: 2.5em; color: white;">+${data.totalPoints}</span>
                            <p style="margin: 0; color: rgba(255,255,255,0.8);">Points gagnés</p>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h4 style="color: var(--gold); margin-bottom: 15px;">📋 Détails des réponses :</h4>
                    ${data.results.map(r => `
                        <div style="background: var(--noir-medium); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: ${r.isCorrect ? '#27ae60' : '#e74c3c'};">
                                ${r.isCorrect ? '✅' : '❌'} ${r.questionId}
                            </span>
                            <span style="color: var(--gris-elegant); font-size: 0.9em;">
                                ${!r.isCorrect ? `Réponse: ${r.correctAnswer}` : `+${r.points} pt${r.points > 1 ? 's' : ''}`}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;

            document.getElementById('culture-g-submit-btn').style.display = 'none';
            document.getElementById('culture-g-questions-container').innerHTML = '';

            // Update scores
            loadScore();
        } else {
            alert('Erreur: ' + data.error);
        }
    } catch (error) {
        console.error('Erreur soumission:', error);
        alert('Erreur lors de la soumission');
    }
}
