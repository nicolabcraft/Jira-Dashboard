// dashboard.js
// Charge les données du backend Flask et met à jour le dashboard

// Palette de couleurs commune pour les graphiques
const chartColors = ['#7ecfff','#b47eff','#7fff7e','#ffb347','#ff7e7e','#7eafff'];

// Fonction utilitaire pour afficher une erreur
function showError(message, selector) {
    const el = document.querySelector(selector);
    if (el) {
        el.innerHTML = `<div style="color:#ff7e7e;padding:15px;text-align:center;font-weight:bold;">${message}</div>`;
    } else {
        console.error(message);
    }
}

async function fetchOrFallback(url, fallback) {
    // Build full API URL using base URL
    const apiUrl = url.startsWith('http')
        ? url
        : `${url.startsWith('/') ? url : '/' + url}`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('API error');
        return await res.json();
    } catch (e) {
        return fallback;
    }
}

// Fonction utilitaire pour afficher un loader sur une zone donnée
function showLoader(selector) {
    const el = document.querySelector(selector);
    if (el) {
        el.innerHTML = `<div style='color:#7ecfff;font-weight:bold;margin:20px 0;text-align:center;'>En attente de la récupération des données</div>`;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Affichage initial des KPIs principaux
    document.getElementById('kpi-total').textContent = 'En attente...';
    document.getElementById('kpi-resolved').textContent = 'En attente...';
    // Affiche un loader sur chaque graphique
    showLoader('#chart-created-resolved');
    showLoader('#chart-department');
    showLoader('#chart-label');
    showLoader('#chart-status');

    // KPIs dynamiques
    let kpis;
    try {
        kpis = await fetchOrFallback('/api/kpis', {});
    } catch (e) {
        showError('Erreur de chargement des KPIs', '.dashboard-row');
        return;
    }
    document.getElementById('kpi-total').textContent = kpis.total_open_tickets;
    document.getElementById('kpi-resolved').textContent = kpis.tickets_closed;
    document.getElementById('kpi-relaunched').textContent = kpis.relaunch_sent || kpis.relaunched || 0;
    document.getElementById('kpi-closed').textContent = kpis.relaunch_closed || kpis.closed || 0;
    // Update support health icons
    const pct = kpis.support_health;
    const icons = document.querySelectorAll('#weather-row .weather-icon');
    let idx = pct >= 80 ? 0 : pct >= 60 ? 1 : pct >= 40 ? 2 : pct >= 20 ? 3 : 4;
    // Define background colors for each health status
    const healthColors = [
        'var(--health-good, #7fff7e)',      // Good (green)
        'var(--health-fair, #ffe066)',      // Fair (yellow)
        'var(--health-warning, #ffb347)',   // Warning (orange)
        'var(--health-bad, #ff7e7e)',       // Bad (red)
        'var(--health-critical, #ff4d4d)'  // Critical (darker red)
    ];
    icons.forEach((el, i) => {
        if (i === idx) {
            el.style.background = 'none';
            el.style.border = `3px solid ${healthColors[idx]}`;
            el.style.borderRadius = '16px';
            el.style.boxShadow = 'none';
            el.style.padding = '4px';
            
            // Ajouter le titre avec le pourcentage arrondi
            el.title = `Support Health: ${Math.round(pct)}%`;
            
            // Ajouter les événements hover
            el.addEventListener('mouseenter', () => {
                el.style.cursor = 'pointer';
            });
        } else {
            el.style.background = 'none';
            el.style.border = '3px solid transparent';
            el.style.boxShadow = 'none';
            el.style.padding = '4px';
            el.title = '';
        }
    });
    // Request Types (remplace Workload leaderboard)
    const requestTypes = kpis.request_types || kpis.workload || [];
    const leaderboardDiv = document.getElementById('leaderboard');
    leaderboardDiv.innerHTML = requestTypes.length ? '' : '<span style="color:#ff7e7e">Aucune donnée de demande</span>';

    requestTypes.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'member'; // Réutilisation de la classe pour le style
        
        let tooltipHtml = '';
        if (item.name === 'Autre' && item.details && item.details.length > 0) {
            const detailsList = item.details.map(d => `<li>${d.name}: ${d.score}</li>`).join('');
            tooltipHtml = `<div class="tooltip-custom"><ul>${detailsList}</ul></div>`;
            div.classList.add('has-tooltip');
        }

        div.innerHTML = `
            <div class="avatar" style="background:${chartColors[i % chartColors.length]}"></div>
            <div class="name">${item.name}</div>
            <div class="score">${item.score}</div>
            ${tooltipHtml}
        `;
        leaderboardDiv.appendChild(div);
    });
    // Charts with params
    const respCR = await fetchOrFallback(`/tickets_created_vs_resolved`, {created:{},resolved:{}});
    console.log('API /tickets_created_vs_resolved:', respCR);
    if (respCR && respCR.created) {
        // Limite à 30 derniers jours
        const allDatesSorted = Array.from(new Set([
            ...Object.keys(respCR.created),
            ...Object.keys(respCR.resolved)
        ])).sort();
        const last30 = allDatesSorted.slice(-30);
        const createdData = last30.map(date => respCR.created[date] || 0);
        const resolvedData = last30.map(date => respCR.resolved[date] || 0);
        if(document.getElementById('chart-created-resolved')) {
            new Chart(document.getElementById('chart-created-resolved'), {
                type: 'line',
                data: {
                    labels: last30,
                    datasets: [
                        { label: 'Créés', data: createdData, borderColor: '#7ecfff', fill: false },
                        { label: 'Résolus', data: resolvedData, borderColor: '#7fff7e', fill: false }
                    ]
                },
                options: {
                    responsive:true,
                    plugins:{legend:{position:'bottom'}},
                    scales: { x: { ticks: { maxRotation: 45, minRotation: 45 } } }
                }
            });
        }
    } else {
        showError('Aucune donnée tickets créés/résolus', '#chart-created-resolved');
    }

    // Le rendu des graphiques est maintenant géré par refreshAllBlocks

    // Le code ci-dessus gère déjà l'affichage, cette section peut être supprimée ou commentée
    // pour éviter la duplication.

    // Tickets par statut (barres horizontales individuelles, triées par %)
    let statusDataRaw;
    let lastStatusData = null;
    async function updateStatusBlock() {
        // Supprime le loader sur le conteneur de statut
        const statusContainer = document.getElementById('chart-status');
        if (statusContainer) { statusContainer.style.display = 'none'; }
        try {
            statusDataRaw = await fetchOrFallback('/tickets_by_status', {});
            console.log('API /tickets_by_status:', statusDataRaw);
            // Si la réponse n'est pas vide, on la stocke
            if (statusDataRaw && Object.keys(statusDataRaw).length > 0) {
                lastStatusData = statusDataRaw;
            }
        } catch (e) {
            showError('Erreur de chargement des statuts', '#chart-status');
            return;
        }
        
        const card = document.getElementById('chart-status')?.parentElement;
        if (!card) return;
        
        // Crée ou cible le conteneur pour les barres
        let barsDiv = card.querySelector('#status-bars');
        if (!barsDiv) {
            barsDiv = document.createElement('div');
            barsDiv.id = 'status-bars';
            card.appendChild(barsDiv);
        }
        
        // Utilise la dernière donnée connue si la réponse est vide
        const dataToDisplay = (statusDataRaw && Object.keys(statusDataRaw).length > 0) ? statusDataRaw : lastStatusData;
        
        if (dataToDisplay && Object.keys(dataToDisplay).length > 0) {
            const statusLabels = Object.keys(dataToDisplay);
            const statusValues = Object.values(dataToDisplay);
            const total = statusValues.reduce((a,b)=>a+b,0);
            let statusArr = statusLabels.map((label, i) => ({
                label,
                value: statusValues[i],
                percent: total ? (statusValues[i]/total*100) : 0
            }));
            statusArr = statusArr.sort((a,b)=>b.percent-a.percent);
            let html = '<div style="display:flex;flex-direction:column;gap:12px;width:100%;">';
            statusArr.forEach((s, i) => {
                const color = chartColors[i % chartColors.length];
                html += `<div style='width:100%;'>
                    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>
                        <span style='font-weight:600;'>${s.label}</span>
                        <span style='font-size:0.95em;'>${s.percent.toFixed(1)}% <span style='color:#b0b8c9;'>(${s.value})</span></span>
                    </div>
                    <div style='height:14px;width:100%;background:#e8eef6;border-radius:6px;overflow:hidden;'>
                        <div style='height:100%;width:${s.percent}%;background:${color};transition:width 0.3s ease-in-out'></div>
                    </div>
                </div>`;
            });
            html += '</div>';
            barsDiv.innerHTML = html;
        } else {
            barsDiv.innerHTML = '<span style="color:#ff7e7e;text-align:center;width:100%;display:block;margin-top:20px;">Aucune donnée de statut</span>';
        }
    }
    // --- Fonctions de mise à jour des blocs ---
    let lastCreatedVsResolved = null;
    async function updateCreatedVsResolved() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ffffff' : '#000000';

    try {
        const createdVsResolved = await fetchOrFallback('/tickets_created_vs_resolved', {created: {}, resolved: {}});
        lastCreatedVsResolved = createdVsResolved;
        const allDatesSorted = Array.from(new Set([...Object.keys(createdVsResolved.created), ...Object.keys(createdVsResolved.resolved)])).sort();
        const last30 = allDatesSorted.slice(-30);
        const createdData = last30.map(date => createdVsResolved.created[date] || 0);
        const resolvedData = last30.map(date => createdVsResolved.resolved[date] || 0);

        const chartEl = document.getElementById('chart-created-resolved');
        if(chartEl) {
            const existingChart = Chart.getChart(chartEl);
            if (existingChart) existingChart.destroy();

            new Chart(chartEl, {
                type: 'line',
                data: {
                    labels: last30,
                    datasets: [
                        { label: 'Créés', data: createdData, borderColor: '#7ecfff', fill: false },
                        { label: 'Résolus', data: resolvedData, borderColor: '#7fff7e', fill: false }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: textColor
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                color: textColor
                            }
                        },
                        y: {
                            ticks: {
                                color: textColor
                            }
                        }
                    }
                }
            });
        }
    } catch (e) {
        showError('Erreur de chargement des tickets créés/résolus', '#chart-created-resolved');
    }
}


    let lastDepartmentData = null;
    async function updateDepartment() {
        try {
            const departmentData = await fetchOrFallback('/tickets_by_department', {});
            lastDepartmentData = departmentData;
            const chartEl = document.getElementById('chart-department');
            if (departmentData && Object.keys(departmentData).length > 0 && chartEl) {
                const existingChart = Chart.getChart(chartEl);
                if (existingChart) existingChart.destroy();
                renderDoughnutChart(chartEl, departmentData);
            } else if (chartEl) {
                showError('Aucune donnée pôle', '#chart-department');
            }
        } catch (e) {
            showError('Erreur de chargement des pôles', '#chart-department');
        }
    }

    let lastLabelData = null;
    async function updateLabel() {
        try {
            const labelData = await fetchOrFallback('/tickets_by_label', {});
            lastLabelData = labelData;
            const chartEl = document.getElementById('chart-label');
            if (labelData && Object.keys(labelData).length > 0 && chartEl) {
                const existingChart = Chart.getChart(chartEl);
                if (existingChart) existingChart.destroy();
                renderDoughnutChart(chartEl, labelData);
            } else if (chartEl) {
                showError('Aucune donnée étiquette', '#chart-label');
            }
        } catch (e) {
            showError('Erreur de chargement des étiquettes', '#chart-label');
        }
    }

    // --- Fonction de rafraîchissement global ---
    function refreshAllBlocks() {
        updateStatusBlock();
        updateCreatedVsResolved();
        updateDepartment();
        updateLabel();
    }

    window.refreshAllBlocks = refreshAllBlocks;

    // --- Initialisation ---
    refreshAllBlocks(); // Premier chargement
    setInterval(refreshAllBlocks, 60000); // Auto-refresh toutes les 60 secondes
});

// Force high DPI for crisp rendering
if (window.Chart && Chart.defaults) {
    Chart.defaults.devicePixelRatio = window.devicePixelRatio || 1;
}

function prepareTopData(rawData, topN = 5) {
    const entries = Object.entries(rawData).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, topN);
    const otherCount = entries.slice(topN).reduce((sum, [, v]) => sum + v, 0);
    if (otherCount > 0) {
        top.push(['Autre', otherCount]);
    }
    const labels = top.map(([k]) => k);
    const data = top.map(([, v]) => v);
    return { labels, data };
}

function renderDoughnutChart(ctx, rawData) {
    const { labels, data } = prepareTopData(rawData);
    const backgroundColor = labels.map((_, i) => chartColors[i % chartColors.length]);

    const chartEl = (typeof ctx === 'string') ? document.getElementById(ctx) : ctx;
    if (!chartEl) return;

    const existingChart = Chart.getChart(chartEl);
    if (existingChart) {
        existingChart.destroy();
    }

    // 🎨 Détecte les couleurs selon le thème actif
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const legendTextColor = isDark ? '#fff' : '#000';
    const tooltipBackground = isDark ? '#333' : '#f9f9f9';
    const tooltipTextColor = isDark ? '#fff' : '#000';

    return new Chart(chartEl, {
        type: 'doughnut',
        data: {
        labels,
        datasets: [{
            data,
            backgroundColor,
            borderWidth: 3
        }]
        },
        options: {
        responsive: true,
        cutout: '50%',
        plugins: {
            legend: {
            position: 'bottom',
            labels: {
                color: legendTextColor,
                font: {
                size: 12
                },
                padding: 15,
                boxWidth: 20
            }
            },
            tooltip: {
            backgroundColor: tooltipBackground,
            titleColor: tooltipTextColor,
            bodyColor: tooltipTextColor,
            callbacks: {
                label(tooltipItem) {
                const val = tooltipItem.parsed;
                const total = tooltipItem.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total ? ((val / total) * 100).toFixed(1) : 0;
                return `${tooltipItem.label}: ${val} (${percentage}%)`;
                }
            }
            }
        }
        }
    });
}
