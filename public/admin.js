// Variables globales
let candidates = [];
let predictionTypes = [];
let isAuthenticated = false;

// Charger les données au démarrage
document.addEventListener('DOMContentLoaded', async () => {
    checkAuth();
});

// Vérifier l'authentification
function checkAuth() {
    const adminToken = sessionStorage.getItem('adminToken');
    if (adminToken === 'authenticated') {
        isAuthenticated = true;
        showAdminInterface();
    }
}

// Login Admin
async function adminLogin(event) {
    event.preventDefault();
    const password = document.getElementById('admin-password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('adminToken', 'authenticated');
            isAuthenticated = true;
            showAdminInterface();
        } else {
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = '❌ Mot de passe incorrect';
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        alert('Erreur de connexion');
    }
}

// Afficher l'interface admin
async function showAdminInterface() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-interface').style.display = 'block';

    await loadCandidates();
    await loadPredictionTypes();
    await loadStats();
    initializeInterface();
}

// Logout
function logout() {
    sessionStorage.removeItem('adminToken');
    isAuthenticated = false;
    location.reload();
}

// Charger les candidates
async function loadCandidates() {
    try {
        const response = await fetch('/api/admin/candidates');
        candidates = await response.json();
    } catch (error) {
        console.error('Erreur chargement candidates:', error);
    }
}

// Charger les types de prédictions
async function loadPredictionTypes() {
    try {
        const response = await fetch('/api/admin/prediction-types');
        predictionTypes = await response.json();
    } catch (error) {
        console.error('Erreur chargement prédictions:', error);
    }
}

// Charger les statistiques
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();

        document.getElementById('stat-users').textContent = stats.totalUsers || 0;
        document.getElementById('stat-pronostics').textContent = stats.totalPronostics || 0;
        document.getElementById('stat-predictions').textContent = stats.totalPredictions || 0;
    } catch (error) {
        console.error('Erreur chargement stats:', error);
    }
}

// Initialiser l'interface
function initializeInterface() {
    // Top 15 grid
    const top15Grid = document.getElementById('top15-real-grid');
    top15Grid.innerHTML = '';

    candidates.forEach(candidate => {
        const div = document.createElement('div');
        div.className = 'candidate-select-item';
        div.innerHTML = `
            <input type="checkbox" id="top15-${candidate}" value="${candidate}" data-type="top15">
            <label for="top15-${candidate}" style="cursor: pointer; flex: 1;">${candidate}</label>
        `;
        top15Grid.appendChild(div);
    });

    // Limiter à 15 sélections
    document.querySelectorAll('input[data-type="top15"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-type="top15"]:checked');
            if (checked.length > 15) {
                checkbox.checked = false;
                alert('Maximum 15 candidates !');
            }
        });
    });

    // Top 5 grid
    const top5Grid = document.getElementById('top5-real-grid');
    top5Grid.innerHTML = '';

    candidates.forEach(candidate => {
        const div = document.createElement('div');
        div.className = 'candidate-select-item';
        div.innerHTML = `
            <input type="checkbox" id="top5-${candidate}" value="${candidate}" data-type="top5">
            <label for="top5-${candidate}" style="cursor: pointer; flex: 1;">${candidate}</label>
        `;
        top5Grid.appendChild(div);
    });

    // Limiter à 5 sélections
    document.querySelectorAll('input[data-type="top5"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[data-type="top5"]:checked');
            if (checked.length > 5) {
                checkbox.checked = false;
                alert('Maximum 5 candidates !');
            }
        });
    });

    // Remplir les selects
    fillSelects();

    // Charger les prédictions à valider
    loadPredictionsValidation();
}

// Remplir les selects
function fillSelects() {
    // Bonus Top 15
    const bonusTop15 = document.getElementById('bonus-top15-real');
    bonusTop15.innerHTML = '<option value="">-- Sélectionne --</option>';
    candidates.forEach(candidate => {
        const option = document.createElement('option');
        option.value = candidate;
        option.textContent = candidate;
        bonusTop15.appendChild(option);
    });

    // Bonus Top 5
    const bonusTop5 = document.getElementById('bonus-top5-real');
    bonusTop5.innerHTML = '<option value="">-- Sélectionne --</option>';
    candidates.forEach(candidate => {
        const option = document.createElement('option');
        option.value = candidate;
        option.textContent = candidate;
        bonusTop5.appendChild(option);
    });

    // Classement final
    document.querySelectorAll('.final-rank').forEach(select => {
        select.innerHTML = select.querySelector('option').outerHTML;
        candidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate;
            option.textContent = candidate;
            select.appendChild(option);
        });
    });
}

// Charger les prédictions à valider
function loadPredictionsValidation() {
    const container = document.getElementById('predictions-validation-container');
    container.innerHTML = '';

    predictionTypes.forEach(pred => {
        const div = document.createElement('div');
        div.className = 'prediction-validation';

        let inputHTML = '';
        if (pred.type === 'number') {
            inputHTML = `<input type="number" id="pred-result-${pred.id}" placeholder="Nombre réel">`;
        } else if (pred.options) {
            inputHTML = `
                <select id="pred-result-${pred.id}">
                    <option value="">-- Sélectionne --</option>
                    ${pred.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            `;
        } else {
            inputHTML = `<input type="text" id="pred-result-${pred.id}" placeholder="Valeur réelle">`;
        }

        div.innerHTML = `
            <h4>${pred.label}</h4>
            <div class="prediction-input-group">
                ${inputHTML}
                <button onclick="validatePrediction('${pred.id}')" class="btn-small">Valider</button>
            </div>
            <div id="pred-status-${pred.id}" style="margin-top: 10px; color: green; font-weight: bold;"></div>
        `;

        container.appendChild(div);
    });
}

// Valider une prédiction individuelle
async function validatePrediction(predictionId) {
    const input = document.getElementById(`pred-result-${predictionId}`);
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

        const status = document.getElementById(`pred-status-${predictionId}`);
        status.textContent = `✅ Validé ! ${data.usersAwarded || 0} utilisateur(s) ont gagné des points`;

        setTimeout(() => {
            status.textContent = '';
        }, 5000);
    } catch (error) {
        alert('Erreur lors de la validation');
    }
}

// Valider tous les résultats
async function validateAllResults() {
    // Récupérer le top 15
    const top15Checkboxes = document.querySelectorAll('input[data-type="top15"]:checked');
    const top15Real = Array.from(top15Checkboxes).map(cb => cb.value);

    const bonusTop15Real = document.getElementById('bonus-top15-real').value;

    // Récupérer le top 5
    const top5Checkboxes = document.querySelectorAll('input[data-type="top5"]:checked');
    const top5Real = Array.from(top5Checkboxes).map(cb => cb.value);

    const bonusTop5Real = document.getElementById('bonus-top5-real').value;

    // Récupérer le classement final
    const classementFinalReal = [];
    for (let i = 1; i <= 5; i++) {
        const select = document.querySelector(`.final-rank[data-rank="${i}"]`);
        classementFinalReal.push(select.value);
    }

    // Validation
    if (top15Real.length !== 15) {
        alert('Tu dois sélectionner exactement 15 candidates pour le top 15 !');
        return;
    }

    if (!bonusTop15Real) {
        alert('Tu dois choisir une candidate bonus pour le top 15 !');
        return;
    }

    if (top5Real.length !== 5) {
        alert('Tu dois sélectionner exactement 5 candidates pour le top 5 !');
        return;
    }

    if (!bonusTop5Real) {
        alert('Tu dois choisir une candidate bonus pour le top 5 !');
        return;
    }

    if (classementFinalReal.some(c => !c)) {
        alert('Tu dois remplir tout le classement final !');
        return;
    }

    // Confirmer avant de valider
    const confirmation = confirm(
        `⚠️ ATTENTION ⚠️\n\n` +
        `Tu vas valider les résultats et recalculer TOUS les scores.\n\n` +
        `Miss France 2025: ${classementFinalReal[0]}\n` +
        `1ère Dauphine: ${classementFinalReal[1]}\n\n` +
        `Cette action est irréversible. Continuer ?`
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

        const statusDiv = document.getElementById('validation-status');
        statusDiv.textContent = `✅ ${data.message} - ${data.usersUpdated || 0} utilisateur(s) mis à jour !`;
        statusDiv.className = 'status-message status-success';
        statusDiv.style.display = 'block';

        // Recharger les stats
        await loadStats();

        // Scroll vers le haut
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        const statusDiv = document.getElementById('validation-status');
        statusDiv.textContent = '❌ Erreur lors de la validation des résultats';
        statusDiv.className = 'status-message status-error';
        statusDiv.style.display = 'block';
    }
}
