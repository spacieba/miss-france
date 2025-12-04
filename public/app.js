// Variables globales
let currentUser = null;
let candidates = [];
let quizQuestions = [];
let currentQuestionIndex = 0;
let bingoGrid = [];
let bingoChecked = [];
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
    document.getElementById('predictions-score').textContent = `${score.predictions_score} pts`;
    document.getElementById('bingo-score').textContent = `${score.bingo_score} pts`;
    document.getElementById('defis-score').textContent = `${score.defis_score} pts`;
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
    } else if (sectionName === 'predictions') {
        loadPredictionsSection();
    } else if (sectionName === 'bingo') {
        loadBingoSection();
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

async function loadQuizSection() {
    const response = await fetch('/api/quiz/score');
    const score = await response.json();
    
    document.getElementById('quiz-answered').textContent = score.totalAnswers;
    document.getElementById('quiz-correct').textContent = score.correctAnswers;
    document.getElementById('quiz-points').textContent = score.totalPoints;
}

async function startQuiz() {
    const response = await fetch('/api/quiz/questions');
    quizQuestions = await response.json();
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
    
    document.getElementById('question-number').textContent = `Question ${currentQuestionIndex + 1}/${quizQuestions.length}`;
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

// === PREDICTIONS LIVE ===

async function loadPredictionsSection() {
    const response = await fetch('/api/predictions/types');
    const predictionTypes = await response.json();
    
    const container = document.getElementById('predictions-list');
    container.innerHTML = '';
    
    predictionTypes.forEach(pred => {
        const card = document.createElement('div');
        card.className = 'prediction-card';
        
        let inputHTML = '';
        if (pred.type === 'number') {
            inputHTML = `<input type="number" id="pred-${pred.id}" class="prediction-input" placeholder="Nombre">`;
        } else if (pred.options) {
            inputHTML = `
                <select id="pred-${pred.id}" class="prediction-select">
                    <option value="">-- Choisis --</option>
                    ${pred.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            `;
        } else {
            inputHTML = `<input type="text" id="pred-${pred.id}" class="prediction-input" placeholder="Ta prédiction">`;
        }
        
        card.innerHTML = `
            <h4>${pred.label}</h4>
            <p class="prediction-points">${pred.points} points</p>
            ${inputHTML}
            <button onclick="savePrediction('${pred.id}')" class="btn-primary">Valider</button>
        `;
        
        container.appendChild(card);
    });
}

async function savePrediction(predictionType) {
    const input = document.getElementById(`pred-${predictionType}`);
    const value = input.value;
    
    if (!value) {
        alert('Entre une prédiction !');
        return;
    }
    
    await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionType, value })
    });
    
    alert('✅ Prédiction enregistrée !');
    input.disabled = true;
}

// === BINGO ===

async function loadBingoSection() {
    const response = await fetch('/api/bingo/items');
    bingoGrid = await response.json();
    bingoChecked = new Array(25).fill(false);
    
    const container = document.getElementById('bingo-grid');
    container.innerHTML = '';
    
    bingoGrid.forEach((item, index) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        cell.textContent = item;
        cell.onclick = () => toggleBingoCell(index);
        cell.dataset.index = index;
        container.appendChild(cell);
    });
}

function toggleBingoCell(index) {
    bingoChecked[index] = !bingoChecked[index];
    const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
    cell.classList.toggle('checked');
    
    checkBingoLines();
}

async function checkBingoLines() {
    let completedLines = 0;
    
    // Vérifier les lignes horizontales
    for (let i = 0; i < 5; i++) {
        if (bingoChecked.slice(i * 5, i * 5 + 5).every(c => c)) {
            completedLines++;
        }
    }
    
    // Vérifier les colonnes
    for (let i = 0; i < 5; i++) {
        if ([0, 1, 2, 3, 4].every(j => bingoChecked[i + j * 5])) {
            completedLines++;
        }
    }
    
    // Vérifier les diagonales
    if ([0, 6, 12, 18, 24].every(i => bingoChecked[i])) {
        completedLines++;
    }
    if ([4, 8, 12, 16, 20].every(i => bingoChecked[i])) {
        completedLines++;
    }
    
    document.getElementById('bingo-lines').textContent = completedLines;
    document.getElementById('bingo-points-display').textContent = completedLines * 20;
    
    // Sauvegarder
    await fetch('/api/bingo/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid: bingoChecked, completedLines })
    });
    
    loadScore();
}

// === DEFIS ===

async function loadDefisSection() {
    // Charger le défi classique
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

    // Charger le vote costume
    await loadCostumeVoting();
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

// === VOTE MEILLEUR COSTUME ===

async function loadCostumeVoting() {
    // Charger la liste des joueurs
    const playersResponse = await fetch('/api/costume/players');
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

async function loadLeaderboard() {
    const response = await fetch('/api/leaderboard');
    const leaderboard = await response.json();
    
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    leaderboard.forEach((player, index) => {
        const row = document.createElement('tr');
        if (currentUser && player.user_id === currentUser.id) {
            row.className = 'current-user';
        }
        
        row.innerHTML = `
            <td class="rank">${index + 1}</td>
            <td class="player-name">${player.pseudo}</td>
            <td>${player.quiz_score}</td>
            <td>${player.pronostics_score}</td>
            <td>${player.predictions_score}</td>
            <td>${player.bingo_score}</td>
            <td>${player.defis_score}</td>
            <td class="total-score">${player.total_score}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Mettre à jour le rang de l'utilisateur
    if (currentUser) {
        const userRank = leaderboard.findIndex(p => p.user_id === currentUser.id) + 1;
        document.getElementById('user-rank').textContent = `#${userRank}`;
    }
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
        const predictionsEl = document.getElementById('admin-stat-predictions');

        console.log('Elements trouvés:', { usersEl, pronosticsEl, predictionsEl });

        if (usersEl) usersEl.textContent = stats.totalUsers || 0;
        if (pronosticsEl) pronosticsEl.textContent = stats.totalPronostics || 0;
        if (predictionsEl) predictionsEl.textContent = stats.totalPredictions || 0;
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

    // Mettre à jour l'affichage de l'étape actuelle
    updateAdminStepDisplay();

    // Mettre à jour la grille Top 5 (filtrée selon Top 15 validé)
    updateAdminTop5Grid();

    // Mettre à jour les selects du classement final (filtrés selon Top 5 validé)
    updateAdminFinalSelects();

    // Si le top 15 a déjà été validé, pré-cocher les cases
    if (officialResults.top15 && officialResults.top15.length > 0) {
        officialResults.top15.forEach(candidate => {
            const checkbox = document.querySelector(`input[data-admin-type="top15"][value="${candidate}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Si le top 5 a déjà été validé, pré-cocher les cases
    if (officialResults.top5 && officialResults.top5.length > 0) {
        officialResults.top5.forEach(candidate => {
            const checkbox = document.querySelector(`input[data-admin-type="top5"][value="${candidate}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Si le classement final a déjà été validé, pré-remplir les selects
    if (officialResults.classement_final && officialResults.classement_final.length > 0) {
        officialResults.classement_final.forEach((candidate, index) => {
            const select = document.querySelector(`.admin-final-rank[data-rank="${index + 1}"]`);
            if (select) select.value = candidate;
        });
    }

    // Charger les prédictions
    await loadAdminPredictions();

    // Charger le preview des votes costume
    await loadAdminCostumePreview();

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

async function loadAdminPredictions() {
    console.log('🔧 loadAdminPredictions appelée');
    try {
        const response = await fetch('/api/admin/prediction-types');
        const predictionTypes = await response.json();
        console.log('🎯 Prediction types reçus:', predictionTypes.length);

        const container = document.getElementById('admin-predictions-container');
        console.log('📦 Container prédictions:', container);
        container.innerHTML = '';

        predictionTypes.forEach(pred => {
            const div = document.createElement('div');
            div.className = 'admin-prediction-item';

            let inputHTML = '';
            if (pred.type === 'number') {
                inputHTML = `<input type="number" id="admin-pred-${pred.id}" placeholder="Nombre réel">`;
            } else if (pred.options) {
                inputHTML = `
                    <select id="admin-pred-${pred.id}">
                        <option value="">-- Sélectionne --</option>
                        ${pred.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                `;
            } else {
                inputHTML = `<input type="text" id="admin-pred-${pred.id}" placeholder="Valeur réelle">`;
            }

            div.innerHTML = `
                <h4>${pred.label}</h4>
                <div class="admin-prediction-input-group">
                    ${inputHTML}
                    <button onclick="validatePrediction('${pred.id}')" class="btn-admin-small">Valider</button>
                </div>
                <div id="admin-pred-status-${pred.id}" style="margin-top: 10px; color: green; font-weight: bold;"></div>
            `;

            container.appendChild(div);
        });
        console.log('✅ loadAdminPredictions terminée - prédictions ajoutées:', container.children.length);
    } catch (error) {
        console.error('❌ Erreur chargement prédictions admin:', error);
    }
}

async function validatePrediction(predictionId) {
    const input = document.getElementById(`admin-pred-${predictionId}`);
    const value = input.value;

    if (!value) {
        alert('Entre une valeur !');
        return;
    }

    try {
        const response = await fetch('/api/admin/validate-prediction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                predictionType: predictionId,
                correctValue: value
            })
        });

        const data = await response.json();

        const status = document.getElementById(`admin-pred-status-${predictionId}`);
        status.textContent = `✅ Validé ! ${data.usersAwarded || 0} joueur(s) ont gagné des points`;

        await loadAdminStats();
        await loadLeaderboard();

        setTimeout(() => {
            status.textContent = '';
        }, 5000);
    } catch (error) {
        alert('Erreur lors de la validation');
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

    if (step1Status) {
        if (officialResults.current_step >= 1) {
            step1Status.textContent = '✅ Validé';
            step1Status.style.color = '#27ae60';
        } else {
            step1Status.textContent = '⏳ En attente';
            step1Status.style.color = '#f39c12';
        }
    }

    if (step2Status) {
        if (officialResults.current_step >= 2) {
            step2Status.textContent = '✅ Validé';
            step2Status.style.color = '#27ae60';
        } else if (officialResults.current_step >= 1) {
            step2Status.textContent = '⏳ En attente';
            step2Status.style.color = '#f39c12';
        } else {
            step2Status.textContent = '🔒 Bloqué (valider Top 15 d\'abord)';
            step2Status.style.color = '#888';
        }
    }

    if (step3Status) {
        if (officialResults.current_step >= 3) {
            step3Status.textContent = '✅ Validé - Miss France élue !';
            step3Status.style.color = '#27ae60';
        } else if (officialResults.current_step >= 2) {
            step3Status.textContent = '⏳ En attente';
            step3Status.style.color = '#f39c12';
        } else {
            step3Status.textContent = '🔒 Bloqué (valider Top 5 d\'abord)';
            step3Status.style.color = '#888';
        }
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

    candidatesToShow.forEach((candidate, index) => {
        const label = document.createElement('label');
        const inputId = `admin-top5-${index}`;
        label.setAttribute('for', inputId);
        label.innerHTML = `
            <input type="checkbox" id="${inputId}" value="${candidate}" data-admin-type="top5">
            ${candidate}
        `;
        top5Grid.appendChild(label);
    });

    // Réappliquer les listeners
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

// Mettre à jour les selects du classement final (afficher seulement les candidates du Top 5 validé)
function updateAdminFinalSelects() {
    const selects = document.querySelectorAll('.admin-final-rank');

    // Si le top 5 n'est pas encore validé, afficher toutes les candidates
    const candidatesToShow = officialResults.current_step >= 2 && officialResults.top5.length > 0
        ? officialResults.top5
        : candidates;

    selects.forEach((select, idx) => {
        const defaultLabels = ['-- Miss France 2026 --', '-- 1ère Dauphine --', '-- 2ème Dauphine --', '-- 3ème Dauphine --', '-- 4ème Dauphine --'];
        select.innerHTML = `<option value="">${defaultLabels[idx]}</option>`;
        candidatesToShow.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });
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
