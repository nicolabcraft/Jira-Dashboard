// Palette de couleurs commune pour les graphiques
const chartColors = ['#7ecfff','#b47eff','#7fff7e','#ffb347','#ff7e7e','#7eafff'];

// Fonction pour formater les nombres
const formatNumber = (num) => new Intl.NumberFormat('fr-FR').format(num);

// Fonction pour formater le temps en heures et minutes
const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins}m`;
};

// Fonction pour calculer le temps entre deux dates en minutes
function getMinutesBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.round((end - start) / (1000 * 60));
}

// Fonction pour obtenir les données des 30 derniers jours
async function getLast30DaysData() {
    try {
        // Récupérer les statistiques générales
        const fetchOptions = {
            credentials: 'include' // Pour envoyer les cookies de session
        };

        const kpisResponse = await fetch('/api/kpis', fetchOptions);
        if (!kpisResponse.ok) {
            if (kpisResponse.status === 403) {
                const overlay = document.createElement('div');
                overlay.className = 'access-denied';
                overlay.innerHTML = `
                    <span class="material-symbols-rounded icon">block</span>
                    <div>Accès refusé : réservé aux administrateurs.</div>
                `;
                document.body.appendChild(overlay);
                setTimeout(() => {
                    window.location.href = '/pages/dashboard.html';
                }, 2000);
                return;
            }
            throw new Error('Erreur lors de la récupération des KPIs');
        }
        const kpisData = await kpisResponse.json();

        // Récupérer les statistiques détaillées
        const statsResponse = await fetch('/api/stats', fetchOptions);
        if (!statsResponse.ok) throw new Error('Erreur lors de la récupération des stats');
        const statsData = await statsResponse.json();

        // Récupérer les tickets résolus des 30 derniers jours pour le SLA et resolved-by-assignee
        const recentTicketsResponse = await fetch('/api/tickets/recent', fetchOptions);
        if (!recentTicketsResponse.ok) throw new Error('Erreur lors de la récupération des tickets récents');
        const recentTickets = await recentTicketsResponse.json();

        // Récupérer tous les tickets pour assigned-by-person
        const allTicketsResponse = await fetch('/api/tickets/all', fetchOptions);
        if (!allTicketsResponse.ok) throw new Error('Erreur lors de la récupération de tous les tickets');
        const allTickets = await allTicketsResponse.json();

        // Calculer le SLA réel à partir des tickets résolus
        let totalResolutionTime = 0;
        let resolvedCount = 0;
        let previousTotalTime = 0;
        let previousCount = 0;

        // Trier les tickets récents par date de mise à jour pour le SLA
        const sortedRecentTickets = recentTickets
            .filter(ticket => ticket.status === 'Done' || ticket.status === 'Fermée')
            .sort((a, b) => new Date(b.updated) - new Date(a.updated));

        // Calculer le SLA actuel (30 derniers tickets résolus)
        sortedRecentTickets.slice(0, 30).forEach(ticket => {
            const resolutionTime = getMinutesBetweenDates(ticket.created, ticket.updated);
            totalResolutionTime += resolutionTime;
            resolvedCount++;
        });

        // Calculer le SLA précédent (30 tickets résolus suivants)
        sortedRecentTickets.slice(30, 60).forEach(ticket => {
            const resolutionTime = getMinutesBetweenDates(ticket.created, ticket.updated);
            previousTotalTime += resolutionTime;
            previousCount++;
        });

        const avgResolutionTime = resolvedCount > 0 ? Math.round(totalResolutionTime / resolvedCount) : 0;
        const previousAvgTime = previousCount > 0 ? Math.round(previousTotalTime / previousCount) : 0;
        const slaTrend = previousAvgTime > 0 ? ((previousAvgTime - avgResolutionTime) / previousAvgTime) * 100 : 0;

        // Préparer les données des assignés (pour resolved-by-assignee, utiliser les tickets récents)
        const assignees = recentTickets.reduce((acc, ticket) => {
            const name = ticket.assignee;
            if (!acc[name]) {
                acc[name] = { name, resolvedCount: 0, assignedCount: 0 };
            }
            if (ticket.status === 'Fermée') {
                acc[name].resolvedCount++;
            }
            return acc;
        }, {});

        // Convertir l'objet en tableau et trier par nombre de tickets résolus
        const assigneesList = Object.values(assignees)
            .sort((a, b) => b.resolvedCount - a.resolvedCount);

        return {
            openTickets: kpisData.total_open_tickets || 0,
            resolvedTickets: kpisData.tickets_closed || 0,
            totalTickets: kpisData.total_tickets || 0,
            averageResolutionTime: avgResolutionTime,
            slaTrend: slaTrend,
            supportHealth: kpisData.support_health / 100 || 0,
            assignees: assigneesList,
            allTickets: allTickets // Stocker allTickets dans l'objet data
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return null;
    }
}

// Fonction pour mettre à jour les KPIs
function updateKPIs(data) {
    document.getElementById('kpi-open').textContent = formatNumber(data.openTickets);
    document.getElementById('kpi-resolved').textContent = formatNumber(data.resolvedTickets);
    document.getElementById('kpi-total').textContent = formatNumber(data.totalTickets);
    
    // Mise à jour du SLA
    const slaElement = document.getElementById('kpi-sla');
    const slaTrendElement = document.getElementById('sla-trend');

    if (data.averageResolutionTime > 0) {
        slaElement.textContent = formatTime(data.averageResolutionTime);
    
        const trend = data.slaTrend;
        const isImprovement = trend > 0;
        const trendIcon = isImprovement ? '../assets/img/up.svg' : '../assets/img/down.svg';
        const trendText = isImprovement ? 'Plus rapide' : 'Plus lent';
        const trendColor = isImprovement ? '#4CAF50' : '#f44336';
        
        slaTrendElement.innerHTML = `
            <div style="display:flex;align-items:center;gap:4px;color:${trendColor}">
                <img src="${trendIcon}" alt="${trendText}" style="width:16px;height:16px;"/>
                <span>${Math.abs(trend).toFixed(1)}% ${trendText}</span>
            </div>
        `;
    } else {
        slaElement.textContent = 'Aucune donnée';
        slaTrendElement.innerHTML = '';
    }
}

// Fonction pour mettre à jour la santé du support
function updateSupportHealth(data) {
    const weatherRow = document.getElementById('weather-row');
    const icons = weatherRow.querySelectorAll('.weather-icon');
    
    // Calcul de l'index basé sur le pourcentage de santé
    const health = data.supportHealth * 100;
    const healthIndex = health >= 80 ? 0 :
                       health >= 60 ? 1 :
                       health >= 40 ? 2 :
                       health >= 20 ? 3 : 4;

    // Définition des couleurs pour chaque niveau de santé
    const healthColors = [
        'var(--health-good, #7fff7e)',      // Good (green)
        'var(--health-fair, #ffe066)',      // Fair (yellow)
        'var(--health-warning, #ffb347)',   // Warning (orange)
        'var(--health-bad, #ff7e7e)',       // Bad (red)
        'var(--health-critical, #ff4d4d)'   // Critical (darker red)
    ];

    // Mise à jour du style de chaque icône
    icons.forEach((icon, index) => {
        if (index === healthIndex) {
            icon.style.background = 'none';
            icon.style.border = `3px solid ${healthColors[healthIndex]}`;
            icon.style.borderRadius = '16px';
            icon.style.boxShadow = 'none';
            icon.style.padding = '4px';
            
            // Ajouter le titre avec le pourcentage arrondi
            icon.title = `Support Health: ${Math.round(health)}%`;
            
            // Ajouter les événements hover
            icon.style.cursor = 'pointer';
        } else {
            icon.style.background = 'none';
            icon.style.border = '3px solid transparent';
            icon.style.boxShadow = 'none';
            icon.style.padding = '4px';
            icon.title = '';
            icon.style.cursor = 'default';
        }
    });
}

// Fonction pour créer la liste des tickets résolus par assigné
function createResolvedByAssigneeList(data) {
    const maxResolved = Math.max(...data.assignees.map(a => a.resolvedCount));
    const total = data.assignees.reduce((sum, a) => sum + a.resolvedCount, 0);
    const container = document.getElementById('chart-resolved-by-assignee');
    let html = '<div style="display:flex;flex-direction:column;gap:12px;width:100%;min-width:100%;">';
    
    data.assignees
        .sort((a, b) => b.resolvedCount - a.resolvedCount)
        .forEach((assignee, i) => {
            const percent = total ? ((assignee.resolvedCount / total) * 100).toFixed(1) : 0;
            const color = chartColors[i % chartColors.length];
            html += `
                <div style='width:100%;min-width:100%;'>
                    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>
                        <span style='font-weight:600;'>${assignee.name}</span>
                        <span style='font-size:0.95em;'>${percent}% <span style='color:#b0b8c9;'>(${assignee.resolvedCount})</span></span>
                    </div>
                    <div style='height:14px;width:100%;min-width:100%;background:#e8eef6;border-radius:6px;overflow:hidden;'>
                        <div style='height:100%;width:${(assignee.resolvedCount / total) * 100}%;background:${color};transition:width 0.3s ease-in-out'></div>
                    </div>
                </div>
            `;
        });
    
    html += '</div>';
    container.innerHTML = html;
}

// Fonction pour créer la liste des tickets assignés par personne
function createAssignedByPersonList(data, allTickets) {
    // Calculer les assignations à partir de tous les tickets
    const assignees = allTickets.reduce((acc, ticket) => {
        const name = ticket.assignee;
        if (!acc[name]) {
            acc[name] = { name, assignedCount: 0 };
        }
        if (ticket.status !== 'Fermée') {
            acc[name].assignedCount++;
        }
        return acc;
    }, {});

    const assigneesList = Object.values(assignees);
    const maxAssigned = Math.max(...assigneesList.map(a => a.assignedCount));
    const total = assigneesList.reduce((sum, a) => sum + a.assignedCount, 0);
    const container = document.getElementById('chart-assigned-by-person');
    let html = '<div style="display:flex;flex-direction:column;gap:12px;width:100%;min-width:100%;">';
    
    assigneesList
        .sort((a, b) => b.assignedCount - a.assignedCount)
        .forEach((assignee, i) => {
            const percent = total ? ((assignee.assignedCount / total) * 100).toFixed(1) : 0;
            const color = chartColors[i % chartColors.length];
            html += `
                <div style='width:100%;min-width:100%;'>
                    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>
                        <span style='font-weight:600;'>${assignee.name}</span>
                        <span style='font-size:0.95em;'>${percent}% <span style='color:#b0b8c9;'>(${assignee.assignedCount})</span></span>
                    </div>
                    <div style='height:14px;width:100%;min-width:100%;background:#e8eef6;border-radius:6px;overflow:hidden;'>
                        <div style='height:100%;width:${(assignee.assignedCount / total) * 100}%;background:${color};transition:width 0.3s ease-in-out'></div>
                    </div>
                </div>
            `;
        });
    
    html += '</div>';
    container.innerHTML = html;
}

// Fonction pour afficher un loader
function showLoader(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.opacity = '0.5';
        element.style.position = 'relative';
        element.insertAdjacentHTML('beforeend', '<div class="loader"></div>');
    }
}

// Fonction pour cacher un loader
function hideLoader(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.opacity = '1';
        const loader = element.querySelector('.loader');
        if (loader) loader.remove();
    }
}

// Fonction pour afficher une erreur
function showError(message, selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

// Fonction principale pour initialiser le dashboard
async function initAdminDashboard() {
    try {
        // Affichage des états de chargement initiaux
        document.getElementById('kpi-open').textContent = 'En attente...';
        document.getElementById('kpi-resolved').textContent = 'En attente...';
        document.getElementById('kpi-total').textContent = 'En attente...';
        document.getElementById('kpi-sla').textContent = 'En attente...';
        
        showLoader('#chart-resolved-by-assignee');
        showLoader('#chart-assigned-by-person');

        const data = await getLast30DaysData();
        if (!data) {
            showError('Erreur lors de la récupération des données', '.dashboard-row');
            return;
        }

        updateKPIs(data);
        updateSupportHealth(data);
        createResolvedByAssigneeList(data);
        createAssignedByPersonList(data, data.allTickets);

        // Cacher les loaders une fois les données chargées
        hideLoader('#chart-resolved-by-assignee');
        hideLoader('#chart-assigned-by-person');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation du dashboard:', error);
        showError('Erreur lors du chargement des données', '.dashboard-row');
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', initAdminDashboard);

// Rafraîchissement des données toutes les 5 minutes
setInterval(initAdminDashboard, 5 * 60 * 1000);

// Gestion du bouton de redémarrage
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('restart-server').addEventListener('click', async () => {
    if (!confirm('Êtes-vous sûr de vouloir redémarrer le serveur ?')) {
        return;
    }

    const button = document.getElementById('restart-server');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Redémarrage...';

    try {
        const response = await fetch('/api/restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        // Si le serveur se ferme avant d'envoyer la réponse, considérer que c'est un succès
        if (!response.ok && response.status !== 502 && response.status !== 503 && response.status !== 504) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Essayer de parser la réponse JSON
        try {
            const data = await response.json();
            if (data.success) {
                button.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Redémarrage en cours...';
            }
        } catch (e) {
            // Si on ne peut pas parser la réponse JSON, c'est probablement que le serveur redémarre déjà
            button.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Redémarrage en cours...';
        }

        // Dans tous les cas, recharger la page après 5 secondes
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    } catch (error) {
        console.error('Erreur:', error);
        button.innerHTML = '<span class="material-symbols-rounded">error</span> Erreur de redémarrage';
        setTimeout(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        }, 3000);
    }
    });
});