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
        : `${window.API_BASE}${url.startsWith('/') ? url : '/' + url}`;
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
    document.getElementById('kpi-total').textContent = kpis.total_tickets;
    document.getElementById('kpi-resolved').textContent = kpis.tickets_resolved;
    document.getElementById('kpi-relaunched').textContent = kpis.relaunch_sent || kpis.relaunched || 0;
    document.getElementById('kpi-closed').textContent = kpis.relaunch_closed || kpis.closed || 0;
    // Update support health icons
    const pct = kpis.support_health;
    const icons = document.querySelectorAll('#weather-row .weather-icon');
    let idx = pct >= 80 ? 0 : pct >= 60 ? 1 : pct >= 30 ? 2 : 3;
    icons.forEach((el, i) => {
        if (i === idx) {
            el.classList.add('selected');
            const colors = ['#7fff7e','#7ecfff','#ffb347','#ff7e7e'];
            el.style.color = colors[i];
        } else {
            el.classList.remove('selected'); el.style.color = ''; }
    });
    // Workload leaderboard
    const workload = kpis.workload || kpis.leaderboard || [];
    const leaderboardDiv = document.getElementById('leaderboard');
    leaderboardDiv.innerHTML = workload.length ? '' : '<span style="color:#ff7e7e">Aucune donnée équipe</span>';
    workload.forEach((member,i)=>{
        if(member.name && member.name!=='Inconnu'){
            const div = document.createElement('div');
            div.className='member';
            div.innerHTML=`<div class="avatar" style="background:${chartColors[i%chartColors.length]}"></div><div class="name">${member.name}</div><div class="score">${member.score}</div>`;
            leaderboardDiv.appendChild(div);
        }
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

    // Tickets par pôle (pie chart) dynamique (loader déjà affiché)
    let departmentData;
    try {
        departmentData = await fetchOrFallback(`/tickets_by_department`, {});
        console.log('API /tickets_by_department:', departmentData);
    } catch (e) {
        showError('Erreur de chargement des pôles', '#chart-department');
    }
    if (departmentData && Object.keys(departmentData).length > 0) {
        const entries = Object.entries(departmentData).sort((a,b)=>b[1]-a[1]);
        const top = entries.slice(0,5);
        const otherCount = entries.slice(5).reduce((sum,[,v])=>sum+v,0);
        if(otherCount>0) top.push(['Autre', otherCount]);
        const labels = top.map(([k])=>k);
        const values = top.map(([,v])=>v);
        new Chart(document.getElementById('chart-department'), {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: chartColors, borderWidth: 3 }] },
            options: {
                devicePixelRatio: window.devicePixelRatio || 1,
                responsive: true,
                cutout: '50%',
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const val = ctx.parsed;
                                const data = ctx.dataset.data;
                                const tot = data.reduce((a,b)=>a+b,0);
                                const pct = ((val/tot)*100).toFixed(1);
                                return `${ctx.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw(chart) {
                    const active = chart.tooltip._active && chart.tooltip._active[0];
                    if (active) {
                        const val = chart.data.datasets[0].data[active.index];
                        const tot = chart.data.datasets[0].data.reduce((a,b) => a + b, 0);
                        if (tot > 0) {
                            const pct = ((val / tot) * 100).toFixed(1) + '%';
                            const { ctx, chartArea: { left, right, top, bottom } } = chart;
                            ctx.save();
                            ctx.font = 'bold 18px sans-serif';
                            ctx.fillStyle = '#000';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(pct, (left + right) / 2, (top + bottom) / 2);
                            ctx.restore();
                        }
                    }
                }
            }]
        });
    } else {
        showError('Aucune donnée pôle', '#chart-department');
    }

    // Tickets par étiquette (pie chart) dynamique (loader déjà affiché)
    let labelData;
    try {
        labelData = await fetchOrFallback(`/tickets_by_label`, {});
        console.log('API /tickets_by_label:', labelData);
    } catch (e) {
        showError('Erreur de chargement des étiquettes', '#chart-label');
    }
    if (labelData && Object.keys(labelData).length > 0) {
        const entries = Object.entries(labelData).sort((a,b)=>b[1]-a[1]);
        const top = entries.slice(0,5);
        const otherCount = entries.slice(5).reduce((sum,[,v])=>sum+v,0);
        if(otherCount>0) top.push(['Autre', otherCount]);
        const labels = top.map(([k])=>k);
        const values = top.map(([,v])=>v);
        new Chart(document.getElementById('chart-label'), {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: chartColors, borderWidth: 3 }] },
            options: {
                devicePixelRatio: window.devicePixelRatio || 1,
                responsive: true,
                cutout: '50%',
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const val = ctx.parsed;
                                const data = ctx.dataset.data;
                                const tot = data.reduce((a,b)=>a+b,0);
                                const pct = ((val/tot)*100).toFixed(1);
                                return `${ctx.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw(chart) {
                    const active = chart.tooltip._active && chart.tooltip._active[0];
                    if (active) {
                        const val = chart.data.datasets[0].data[active.index];
                        const tot = chart.data.datasets[0].data.reduce((a,b) => a + b, 0);
                        if (tot > 0) {
                            const pct = ((val / tot) * 100).toFixed(1) + '%';
                            const { ctx, chartArea: { left, right, top, bottom } } = chart;
                            ctx.save();
                            ctx.font = 'bold 18px sans-serif';
                            ctx.fillStyle = '#000';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(pct, (left + right) / 2, (top + bottom) / 2);
                            ctx.restore();
                        }
                    }
                }
            }]
        });
    } else {
        showError('Aucune donnée étiquette', '#chart-label');
    }

    // Classement équipe : affiche le nom réel ou rien si "Inconnu"
    leaderboardDiv.innerHTML = '';
    if (workload.length === 0) {
        leaderboardDiv.innerHTML = '<span style="color:#ff7e7e">Aucune donnée équipe</span>';
    } else {
        workload.forEach((member, i) => {
            if(member.name && member.name !== 'Inconnu') {
                const colors = chartColors;
                const div = document.createElement('div');
                div.className = 'member';
                div.innerHTML = `<div class="avatar" style="background:${colors[i%colors.length]}"></div><div class="name">${member.name}</div><div class="score">${member.score}</div>`;
                leaderboardDiv.appendChild(div);
            }
        });
        if(leaderboardDiv.innerHTML === '') leaderboardDiv.innerHTML = '<span style="color:#ff7e7e">Aucun membre identifié</span>';
    }

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
            let html = '<div style="display:flex;flex-direction:column;gap:12px;width:100%;margin-top:20px;">';
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
    updateStatusBlock();
    // setInterval(updateStatusBlock, 60000); // SUPPRIMÉ    // Même logique pour les autres blocs graphiques :
    // Ajoute un rafraîchissement auto toutes les 60s, et affiche la dernière donnée connue sans loader bloquant
    // Tickets créés vs résolus
    let lastCreatedVsResolved = null;
    async function updateCreatedVsResolved() {
        try {
            const createdVsResolved = await fetchOrFallback('/tickets_created_vs_resolved', {created: {}, resolved: {}});

            lastCreatedVsResolved = createdVsResolved;
            // Limite à 30 derniers jours
            const allDatesSorted = Array.from(new Set([
                ...Object.keys(createdVsResolved.created),
                ...Object.keys(createdVsResolved.resolved)
            ])).sort();            const last30 = allDatesSorted.slice(-30);
            const createdData = last30.map(date => createdVsResolved.created[date] || 0);
            const resolvedData = last30.map(date => createdVsResolved.resolved[date] || 0);

            if(document.getElementById('chart-created-resolved')) {
                // Destroy existing chart instance if it exists
                const existingChart = Chart.getChart('chart-created-resolved');
                if (existingChart) {
                    existingChart.destroy();
                }

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
        } catch (e) {
            showError('Erreur de chargement des tickets créés/résolus ou non résolus', '#chart-created-resolved');
        }
    }
    updateCreatedVsResolved();
    // setInterval(updateCreatedVsResolved, 60000); // SUPPRIMÉ
    // Tickets par pôle
    let lastDepartmentData = null;
    async function updateDepartment() {
        try {
            departmentData = await fetchOrFallback('/tickets_by_department', {});
            lastDepartmentData = departmentData;
            if (departmentData && Object.keys(departmentData).length > 0) {
                const entries = Object.entries(departmentData).sort((a,b)=>b[1]-a[1]);
                const top = entries.slice(0,5);
                const otherCount = entries.slice(5).reduce((sum,[,v])=>sum+v,0);
                if(otherCount>0) top.push(['Autre', otherCount]);
                const labels = top.map(([k])=>k);
                const values = top.map(([,v])=>v);
                new Chart(document.getElementById('chart-department'), {
                    type: 'doughnut',
                    data: { labels, datasets: [{ data: values, backgroundColor: chartColors, borderWidth: 6 }] },
                    options: {
                        devicePixelRatio: window.devicePixelRatio || 1,
                        responsive: true,
                        cutout: '50%',
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label(ctx) {
                                        const val = ctx.parsed;
                                        const data = ctx.dataset.data;
                                        const tot = data.reduce((a,b)=>a+b,0);
                                        const pct = ((val/tot)*100).toFixed(1);
                                        return `${ctx.label}: ${val} (${pct}%)`;
                                    }
                                }
                            }
                        }
                    },
                    plugins: [{
                        id: 'centerText',
                        afterDraw(chart) {
                            const active = chart.tooltip._active && chart.tooltip._active[0];
                            if(active) {
                                const val = chart.data.datasets[0].data[active.index];
                                const tot = chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
                                if (tot > 0) {
                                    const pct = ((val/tot)*100).toFixed(1) + '%';
                                    const {ctx, chartArea:{left,right,top,bottom}} = chart;
                                    ctx.save(); ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#000';
                                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                                    ctx.fillText(pct, (left+right)/2, (top+bottom)/2);
                                    ctx.restore();
                                }
                            }
                        }
                    }]
                });
            } else {
                showError('Aucune donnée pôle', '#chart-department');
            }
        } catch (e) {
            showError('Erreur de chargement des pôles', '#chart-department');
        }
    }
    updateDepartment();
    // setInterval(updateDepartment, 60000); // SUPPRIMÉ
    // Tickets par étiquette
    let lastLabelData = null;
    async function updateLabel() {
        try {
            labelData = await fetchOrFallback('/tickets_by_label', {});
            lastLabelData = labelData;
            if (labelData && Object.keys(labelData).length > 0) {
                const entries = Object.entries(labelData).sort((a,b)=>b[1]-a[1]);
                const top = entries.slice(0,5);
                const otherCount = entries.slice(5).reduce((sum,[,v])=>sum+v,0);
                if(otherCount>0) top.push(['Autre', otherCount]);
                const labels = top.map(([k])=>k);
                const values = top.map(([,v])=>v);
                new Chart(document.getElementById('chart-label'), {
                    type: 'doughnut',
                    data: { labels, datasets: [{ data: values, backgroundColor: chartColors, borderWidth: 6 }] },
                    options: {
                        devicePixelRatio: window.devicePixelRatio || 1,
                        responsive: true,
                        cutout: '50%',
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label(ctx) {
                                        const val = ctx.parsed;
                                        const data = ctx.dataset.data;
                                        const tot = data.reduce((a,b)=>a+b,0);
                                        const pct = ((val/tot)*100).toFixed(1);
                                        return `${ctx.label}: ${val} (${pct}%)`;
                                    }
                                }
                            }
                        }
                    },
                    plugins: [{
                        id: 'centerText',
                        afterDraw(chart) {
                            const active = chart.tooltip._active && chart.tooltip._active[0];
                            if(active) {
                                const val = chart.data.datasets[0].data[active.index];
                                const tot = chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
                                if (tot > 0) {
                                    const pct = ((val/tot)*100).toFixed(1) + '%';
                                    const { ctx, chartArea: { left, right, top, bottom } } = chart;
                                    ctx.save();
                                    ctx.font = 'bold 18px sans-serif';
                                    ctx.fillStyle = '#000';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillText(pct, (left + right) / 2, (top + bottom) / 2);
                                    ctx.restore();
                                }
                            }
                        }
                    }]
                });
            } else {
                showError('Aucune donnée étiquette', '#chart-label');
            }
        } catch (e) {
            showError('Erreur de chargement des étiquettes', '#chart-label');
        }
    }
    updateLabel();    // setInterval(updateLabel, 60000); // SUPPRIMÉ

    // --- Rafraîchissement automatique paramétrable par l'utilisateur ---
    let refreshInterval = 60; // valeur par défaut en secondes
    let refreshTimer = null;

    function setRefreshInterval(seconds) {
        refreshInterval = seconds;
        if (refreshTimer) clearInterval(refreshTimer);
        // Stocker la préférence utilisateur
        localStorage.setItem('refresh_interval', seconds);
        // Mettre à jour l'input
        const input = document.getElementById('refresh-interval');
        if (input) input.value = seconds;
        // Démarrer le nouveau timer
        refreshTimer = setInterval(refreshAllBlocks, seconds * 1000);
        console.log(`[Refresh] Intervalle mis à jour : ${seconds} secondes`);
    }

    // Ajoute un input pour choisir l'intervalle de rafraîchissement
    function addRefreshIntervalInput() {
        const container = document.createElement('div');
        container.style = 'position:fixed;top:16px;right:32px;z-index:1000;background:#fff;padding:8px 16px;border-radius:8px;box-shadow:0 2px 8px #0001;font-size:1em;';
        
        // Récupérer la dernière valeur sauvegardée ou utiliser la valeur par défaut
        const savedInterval = parseInt(localStorage.getItem('refresh_interval'), 10) || 60;
        refreshInterval = savedInterval;
        
        container.innerHTML = `⟳ Rafraîchissement : <input id="refresh-interval" type="number" min="10" max="600" value="${savedInterval}" style="width:60px;"> s`;
        document.body.appendChild(container);
        
        const input = document.getElementById('refresh-interval');
        input.addEventListener('change', e => {
            let v = parseInt(e.target.value, 10);
            if (isNaN(v) || v < 10) v = 10;
            if (v > 600) v = 600;
            e.target.value = v;
            setRefreshInterval(v);
        });
        
        // Activer le rafraîchissement initial avec la valeur sauvegardée
        setRefreshInterval(savedInterval);
    }

    // Rafraîchit tous les blocs (données dynamiques)
    function refreshAllBlocks() {        updateStatusBlock();
        updateDepartment();
        updateLabel();
        updateCreatedVsResolved();
    }

    // --- Initialisation ---
    // Ajout du bouton de rafraîchissement
    addRefreshIntervalInput();
    // Premier chargement
    refreshAllBlocks();
    // Configuration du timer
    setRefreshInterval(refreshInterval);
});

// Force high DPI for crisp rendering
if (window.Chart && Chart.defaults) {
    Chart.defaults.devicePixelRatio = window.devicePixelRatio || 1;
}

// ...existing renderDoughnutChart helper...
function renderDoughnutChart(ctx, rawData) {
    const { labels: rawLabels, data: rawValues } = prepareTopData(rawData);
    // Combine and sort ascending
    const combined = rawLabels.map((label, i) => ({ label, value: rawValues[i], color: chartColors[i % chartColors.length] }));
    combined.sort((a, b) => a.value - b.value);
    const labels = combined.map(d => d.label);
    const data = combined.map(d => d.value);
    const backgroundColor = combined.map(d => d.color);
    return new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor, borderWidth: 0, borderRadius: 8 }] },
         options: {
             devicePixelRatio: window.devicePixelRatio || 1,
             responsive: true,
             cutout: '50%',
             plugins: {
                 legend: { position: 'bottom', labels: { color: '#000' } },
                 tooltip: { callbacks: { label(ctx) {
                     const val = ctx.parsed;
                     const tot = ctx.dataset.data.reduce((a,b) => a + b, 0);
                     const pct = tot ? (val/tot*100).toFixed(1) : 0;
                     return `${ctx.label}: ${val} (${pct}%)`;
                 } } }
             }
         },
         plugins: [{
             id: 'centerText',
             afterDraw(chart) {
                 const active = chart.tooltip._active && chart.tooltip._active[0];
                 if (active) {
                     const val = chart.data.datasets[0].data[active.index];
                     const tot = chart.data.datasets[0].data.reduce((a,b) => a + b, 0);
                     if (tot > 0) {
                         const pct = (val/tot*100).toFixed(1) + '%';
                         const { ctx, chartArea: { left, right, top, bottom } } = chart;
                         ctx.save(); ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#000';
                         ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                         ctx.fillText(pct, (left+right)/2, (top+bottom)/2);
                         ctx.restore();
                     }
                 }
             }
         }]
     });
}
