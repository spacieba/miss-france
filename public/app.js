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
    // Charger les pronostics existants
    const response = await fetch('/api/pronostics');
    const pronostics = await response.json();

    // Remplir les sélections de candidates
    const top15Container = document.getElementById('top15-selection');
    top15Container.innerHTML = '';

    candidates.forEach(candidate => {
        const label = document.createElement('label');
        label.className = 'candidate-checkbox';
        label.innerHTML = `
            <input type="checkbox" value="${candidate}" data-type="top15">
            <span>${candidate}</span>
        `;
        top15Container.appendChild(label);
    });

    // Top 5
    const top5Container = document.getElementById('top5-selection');
    top5Container.innerHTML = '';

    candidates.forEach(candidate => {
        const label = document.createElement('label');
        label.className = 'candidate-checkbox';
        label.innerHTML = `
            <input type="checkbox" value="${candidate}" data-type="top5">
            <span>${candidate}</span>
        `;
        top5Container.appendChild(label);
    });

    // Remplir les selects
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
    const selects = ['bonus-top15', 'bonus-top5'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        candidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });
    });
    
    // Classement final
    document.querySelectorAll('.select-rank').forEach(select => {
        candidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });
    });
}

async function saveTop15() {
    const top15 = Array.from(document.querySelectorAll('input[data-type="top15"]:checked')).map(cb => cb.value);
    const bonusTop15 = document.getElementById('bonus-top15').value;

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
            body: JSON.stringify({ top15, bonusTop15 })
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
    const response = await fetch('/api/defis');
    const defi = await response.json();
    
    const container = document.getElementById('defi-card');
    
    if (!defi) {
        container.innerHTML = `
            <div class="no-defi">
                <p>🎉 Tu as complété tous les défis disponibles !</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="defi-content">
            <h3>${defi.title}</h3>
            <p>${defi.description}</p>
            <div class="defi-points">🌟 ${defi.points} points</div>
            <button onclick="completeDefi(${defi.id})" class="btn-primary btn-large">✅ J'ai fait le défi !</button>
        </div>
    `;
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
    
    alert(`🎉 Défi validé ! +${data.points} points`);
    loadDefisSection();
    loadScore();
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
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();

        document.getElementById('admin-stat-users').textContent = stats.totalUsers || 0;
        document.getElementById('admin-stat-pronostics').textContent = stats.totalPronostics || 0;
        document.getElementById('admin-stat-predictions').textContent = stats.totalPredictions || 0;
    } catch (error) {
        console.error('Erreur chargement stats admin:', error);
    }
}

async function loadAdminInterface() {
    // Vérifier que les éléments existent
    const top15Grid = document.getElementById('admin-top15-grid');
    const top5Grid = document.getElementById('admin-top5-grid');

    if (!top15Grid || !top5Grid) {
        console.error('Éléments admin non trouvés');
        return;
    }

    // Vérifier que candidates est chargé
    if (!candidates || candidates.length === 0) {
        console.log('Chargement des candidates...');
        await loadCandidates();
    }

    top15Grid.innerHTML = '';
    top5Grid.innerHTML = '';

    candidates.forEach(candidate => {
        // Top 15
        const label15 = document.createElement('label');
        label15.innerHTML = `
            <input type="checkbox" value="${candidate}" data-admin-type="top15">
            ${candidate}
        `;
        top15Grid.appendChild(label15);

        // Top 5
        const label5 = document.createElement('label');
        label5.innerHTML = `
            <input type="checkbox" value="${candidate}" data-admin-type="top5">
            ${candidate}
        `;
        top5Grid.appendChild(label5);
    });

    // Limiter les sélections
    document.querySelectorAll('input[data-admin-type="top15"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-admin-type="top15"]:checked');
            if (checked.length > 15) {
                cb.checked = false;
                alert('Maximum 15 candidates !');
            }
        });
    });

    document.querySelectorAll('input[data-admin-type="top5"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-admin-type="top5"]:checked');
            if (checked.length > 5) {
                cb.checked = false;
                alert('Maximum 5 candidates !');
            }
        });
    });

    // Remplir les selects
    const bonusTop15 = document.getElementById('admin-bonus-top15');
    const bonusTop5 = document.getElementById('admin-bonus-top5');

    candidates.forEach(candidate => {
        const opt15 = document.createElement('option');
        opt15.value = candidate;
        opt15.textContent = candidate;
        bonusTop15.appendChild(opt15);

        const opt5 = document.createElement('option');
        opt5.value = candidate;
        opt5.textContent = candidate;
        bonusTop5.appendChild(opt5);
    });

    // Classement final
    document.querySelectorAll('.admin-final-rank').forEach(select => {
        candidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });
    });

    // Charger les prédictions
    await loadAdminPredictions();
}

async function loadAdminPredictions() {
    try {
        const response = await fetch('/api/admin/prediction-types');
        const predictionTypes = await response.json();

        const container = document.getElementById('admin-predictions-container');
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
    } catch (error) {
        console.error('Erreur chargement prédictions admin:', error);
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

async function adminValidateResults() {
    // Récupérer les données
    const top15Real = Array.from(document.querySelectorAll('input[data-admin-type="top15"]:checked')).map(cb => cb.value);
    const bonusTop15Real = document.getElementById('admin-bonus-top15').value;
    const top5Real = Array.from(document.querySelectorAll('input[data-admin-type="top5"]:checked')).map(cb => cb.value);
    const bonusTop5Real = document.getElementById('admin-bonus-top5').value;
    const classementFinalReal = [];

    for (let i = 1; i <= 5; i++) {
        const select = document.querySelector(`.admin-final-rank[data-rank="${i}"]`);
        classementFinalReal.push(select.value);
    }

    // Validation
    if (top15Real.length !== 15) {
        alert('Sélectionne exactement 15 candidates pour le top 15 !');
        return;
    }

    if (!bonusTop15Real) {
        alert('Choisis une candidate bonus pour le top 15 !');
        return;
    }

    if (top5Real.length !== 5) {
        alert('Sélectionne exactement 5 candidates pour le top 5 !');
        return;
    }

    if (!bonusTop5Real) {
        alert('Choisis une candidate bonus pour le top 5 !');
        return;
    }

    if (classementFinalReal.some(c => !c)) {
        alert('Remplis tout le classement final !');
        return;
    }

    // Confirmation
    const confirmation = confirm(
        `⚠️ ATTENTION ⚠️\n\n` +
        `Tu vas valider les résultats et recalculer TOUS les scores.\n\n` +
        `Miss France 2025: ${classementFinalReal[0]}\n` +
        `1ère Dauphine: ${classementFinalReal[1]}\n\n` +
        `Cette action recalculera les scores de tous les joueurs. Continuer ?`
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/api/admin/validate-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                top15Real,
                bonusTop15Real,
                top5Real,
                bonusTop5Real,
                classementFinalReal
            })
        });

        const data = await response.json();

        const statusDiv = document.getElementById('admin-status');
        statusDiv.textContent = `✅ ${data.message} - ${data.usersUpdated || 0} joueur(s) mis à jour !`;
        statusDiv.className = 'admin-status-message success';
        statusDiv.style.display = 'block';

        // Recharger les stats et le classement
        await loadAdminStats();
        await loadLeaderboard();
        await loadScore();

        // Scroll vers le haut
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        const statusDiv = document.getElementById('admin-status');
        statusDiv.textContent = '❌ Erreur lors de la validation des résultats';
        statusDiv.className = 'admin-status-message error';
        statusDiv.style.display = 'block';
    }
}
