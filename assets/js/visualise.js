// Fichier JavaScript pour la page Visualise
document.addEventListener('DOMContentLoaded', () => {
    const dateRangeSelect = document.getElementById('date-range-select');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const applyFiltersButton = document.getElementById('apply-filters');

    const granularitySelect = document.getElementById('granularity-select');
    const cumulativeToggle = document.getElementById('cumulative-toggle');

    const slaBreakdownSelect = document.getElementById('sla-breakdown');

    const agentSearchInput = document.getElementById('agent-search');
    const agentPerformanceTableBody = document.querySelector('#agent-performance-table tbody');
    const agentTicketsOverlay = document.getElementById('agent-tickets-overlay');
    const overlayAgentName = document.getElementById('overlay-agent-name');
    const overlayTicketList = document.getElementById('overlay-ticket-list');
    const closeOverlayButton = document.querySelector('.close-overlay');

    const departmentStatusFilter = document.getElementById('department-status-filter');
    const tagFilter = document.getElementById('tag-filter');

    const exportCsvButton = document.getElementById('export-csv');
    const exportPdfButton = document.getElementById('export-pdf');
    const exportImageButton = document.getElementById('export-image');

    // Initialisation des graphiques
    let ticketTrendChart, backlogTrendChart, slaComplianceChart, healthAndSlaTrendChart, departmentDistributionChart, departmentTrendChart, tagDistributionChart, tagTrendChart;

    // Fonction pour mettre à jour les dates en fonction de la sélection
    const updateDateInputs = () => {
        const today = new Date();
        let startDate, endDate;

        switch (dateRangeSelect.value) {
            case 'day':
                startDate = new Date(today);
                endDate = new Date(today);
                break;
            case 'week':
                startDate = new Date(today.setDate(today.getDate() - today.getDay())); // Début de la semaine (dimanche)
                endDate = new Date(today.setDate(today.getDate() + 6)); // Fin de la semaine (samedi)
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
            case 'custom':
                startDateInput.style.display = 'inline-block';
                endDateInput.style.display = 'inline-block';
                return; // Ne pas définir les valeurs par défaut pour le mode personnalisé
        }

        startDateInput.value = startDate.toISOString().split('T')[0];
        endDateInput.value = endDate.toISOString().split('T')[0];
        startDateInput.style.display = 'none';
        endDateInput.style.display = 'none';
    };

    // Gestionnaire d'événements pour le sélecteur de plage de dates
    dateRangeSelect.addEventListener('change', updateDateInputs);

    // Appel initial pour définir les dates par défaut (mois)
    updateDateInputs();

    // Fonction de simulation de données (à remplacer par des appels API réels)
    const fetchData = async (filters) => {
        const params = new URLSearchParams(filters);
        const response = await fetch(`/api/visualise/data?${params.toString()}`);
        if (!response.ok) {
            console.error('Failed to fetch data from API');
            return null;
        }
        return await response.json();
    };

    // Fonction pour initialiser ou mettre à jour les graphiques
    const updateCharts = async () => {
        const selectedStartDate = startDateInput.value;
        const selectedEndDate = endDateInput.value;
        let selectedGranularity = granularitySelect.value;
        if (dateRangeSelect.value === 'day') {
            selectedGranularity = 'hourly';
        }
        const isCumulative = cumulativeToggle.checked;
        const statusFilter = document.getElementById('status-filter').value;
        const priorityFilter = document.getElementById('priority-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        const agentFilter = document.getElementById('agent-filter').value;
        const departmentFilter = document.getElementById('department-filter').value;

        const data = await fetchData({
            startDate: selectedStartDate,
            endDate: selectedEndDate,
            granularity: selectedGranularity,
            cumulative: isCumulative,
            status: statusFilter,
            priority: priorityFilter,
            type: typeFilter,
            agent: agentFilter,
            department: departmentFilter
        });

        // Courbe de Tendance des Tickets
        if (ticketTrendChart) ticketTrendChart.destroy();
        const ticketTrendCtx = document.getElementById('chart-ticket-trend').getContext('2d');
        let createdData = data.ticketTrend.created;
        let resolvedData = data.ticketTrend.resolved;

        if (isCumulative) {
            createdData = createdData.map((sum => value => sum += value)(0));
            resolvedData = resolvedData.map((sum => value => sum += value)(0));
        }

        ticketTrendChart = new Chart(ticketTrendCtx, {
            type: 'line',
            data: {
                labels: data.ticketTrend.labels,
                datasets: [
                    {
                        label: 'Tickets Créés',
                        data: createdData,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'Tickets Résolus',
                        data: resolvedData,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100 // Définir une valeur maximale pour l'axe Y
                    }
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: false,
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    }
                }
            }
        });

        // KPI du Support
        document.getElementById('kpi-backlog').textContent = data.kpis.backlog;

        if (backlogTrendChart) backlogTrendChart.destroy();
        const backlogTrendCtx = document.getElementById('chart-backlog-trend').getContext('2d');
        backlogTrendChart = new Chart(backlogTrendCtx, {
            type: 'line',
            data: {
                labels: data.ticketTrend.labels, // Réutiliser les mêmes labels de date
                datasets: [{
                    label: 'Volume du Backlog',
                    data: Object.values(data.kpis.backlogTrend),
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1,
                    fill: true,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    zoom: {
                        pan: {
                            enabled: false,
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    }
                },
                scales: {
                    x: {
                        display: true
                    },
                    y: {
                        display: true,
                        beginAtZero: true
                    }
                }
            }
        });

        // Tendance SLA et Santé du Support
        if (healthAndSlaTrendChart) healthAndSlaTrendChart.destroy();
        const healthAndSlaTrendCtx = document.getElementById('chart-health-sla-trend').getContext('2d');
        healthAndSlaTrendChart = new Chart(healthAndSlaTrendCtx, {
            type: 'line',
            data: {
                labels: data.healthAndSlaTrend.labels,
                datasets: [
                    {
                        label: 'Santé du Support (%)',
                        data: data.healthAndSlaTrend.health,
                        borderColor: 'rgb(255, 205, 86)',
                        yAxisID: 'yHealth',
                        tension: 0.1
                    },
                    {
                        label: 'SLA de Résolution (min)',
                        data: data.healthAndSlaTrend.sla,
                        borderColor: 'rgb(54, 162, 235)',
                        yAxisID: 'ySla',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    zoom: {
                        pan: {
                            enabled: false,
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    }
                },
                scales: {
                    yHealth: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Santé (%)'
                        }
                    },
                    ySla: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'SLA (minutes)'
                        },
                        grid: {
                            drawOnChartArea: false, // seulement les lignes de la grille pour l'axe de gauche
                        },
                    }
                }
            }
        });

        // Tableau Récapitulatif par Agent
        renderAgentTable(data.agentPerformance, data.kpis.totalTickets);

        // Courbe de Distribution des Tickets par Département
        if (departmentDistributionChart) departmentDistributionChart.destroy();
        const departmentDistributionCtx = document.getElementById('chart-department-distribution').getContext('2d');
        departmentDistributionChart = new Chart(departmentDistributionCtx, {
            type: 'bar',
            data: {
                labels: data.departmentDistribution.map(d => d.name),
                datasets: [{
                    label: 'Nombre de Tickets',
                    data: data.departmentDistribution.map(d => d.count),
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Courbe de Distribution des Tickets par Étiquette
        if (tagDistributionChart) tagDistributionChart.destroy();
        const tagDistributionCtx = document.getElementById('chart-tag-distribution').getContext('2d');
        const sortedTags = data.tagDistribution.sort((a, b) => b.count - a.count);
        tagDistributionChart = new Chart(tagDistributionCtx, {
            type: 'bar',
            data: {
                labels: sortedTags.map(t => t.name),
                datasets: [{
                    label: 'Fréquence des Étiquettes',
                    data: sortedTags.map(t => t.count),
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y', // Pour un graphique à barres horizontal
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100 // Définir une valeur maximale pour l'axe X
                    }
                }
            }
        });

        // Tendance par Département
        if (departmentTrendChart) departmentTrendChart.destroy();
        const departmentTrendCtx = document.getElementById('chart-department-trend').getContext('2d');
        const departmentTrendData = {
            labels: data.ticketTrend.labels,
            datasets: Object.keys(data.departmentTrend).map((dept, index) => {
                const color = `hsl(${(index * 360 / Object.keys(data.departmentTrend).length)}, 70%, 50%)`;
                const dailyData = data.ticketTrend.labels.map(label => data.departmentTrend[dept][label] || 0);
                return {
                    label: dept,
                    data: dailyData,
                    borderColor: color,
                    fill: false,
                    tension: 0.1
                };
            })
        };
        departmentTrendChart = new Chart(departmentTrendCtx, {
            type: 'line',
            data: departmentTrendData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { y: { beginAtZero: true } },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: false,
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    }
                }
            }
        });

        // Tendance par Étiquette
        if (tagTrendChart) tagTrendChart.destroy();
        const tagTrendCtx = document.getElementById('chart-tag-trend').getContext('2d');
        const tagTrendData = {
            labels: data.ticketTrend.labels,
            datasets: Object.keys(data.tagTrend).map((tag, index) => {
                const color = `hsl(${(index * 360 / Object.keys(data.tagTrend).length)}, 70%, 50%)`;
                const dailyData = data.ticketTrend.labels.map(label => data.tagTrend[tag][label] || 0);
                return {
                    label: tag,
                    data: dailyData,
                    borderColor: color,
                    fill: false,
                    tension: 0.1
                };
            })
        };
        tagTrendChart = new Chart(tagTrendCtx, {
            type: 'line',
            data: tagTrendData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { y: { beginAtZero: true } },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: false,
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    }
                }
            }
        });
    };

    // Fonction pour rendre le tableau des agents
    const renderAgentTable = (agents, totalTickets) => {
        agentPerformanceTableBody.innerHTML = '';
        agents.forEach(agent => {
            const row = agentPerformanceTableBody.insertRow();
            row.insertCell().textContent = agent.name;
            row.insertCell().textContent = agent.assigned;
            row.insertCell().textContent = agent.resolved;
            const totalResolved = agent.resolved;
            const resolutionRate = totalTickets > 0 ? ((totalResolved / totalTickets) * 100).toFixed(1) + '%' : '0%';
            row.insertCell().textContent = resolutionRate;
            const actionsCell = row.insertCell();
            const drillDownButton = document.createElement('button');
            drillDownButton.textContent = 'Voir tickets';
            drillDownButton.classList.add('drill-down-button');
            drillDownButton.addEventListener('click', () => showAgentTickets(agent));
            actionsCell.appendChild(drillDownButton);
        });
    };

    // Fonction pour afficher les tickets d'un agent dans l'overlay
    const showAgentTickets = (agent) => {
        overlayAgentName.textContent = agent.name;
        overlayTicketList.innerHTML = '';
        if (agent.tickets && agent.tickets.length > 0) {
            agent.tickets.forEach(ticket => {
                const li = document.createElement('li');
                li.textContent = ticket;
                overlayTicketList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'Aucun ticket trouvé pour cet agent.';
            overlayTicketList.appendChild(li);
        }
        agentTicketsOverlay.style.display = 'flex';
    };

    // Fermer l'overlay
    closeOverlayButton.addEventListener('click', () => {
        agentTicketsOverlay.style.display = 'none';
    });

    // Gestionnaire d'événements pour les filtres
    applyFiltersButton.addEventListener('click', updateCharts);

    document.getElementById('reset-zoom').addEventListener('click', () => {
        if (ticketTrendChart) ticketTrendChart.resetZoom();
        if (backlogTrendChart) backlogTrendChart.resetZoom();
        if (healthAndSlaTrendChart) healthAndSlaTrendChart.resetZoom();
        if (departmentTrendChart) departmentTrendChart.resetZoom();
        if (tagTrendChart) tagTrendChart.resetZoom();
    });

    granularitySelect.addEventListener('change', updateCharts);
    cumulativeToggle.addEventListener('change', updateCharts);
    departmentStatusFilter.addEventListener('change', updateCharts);
    tagFilter.addEventListener('change', updateCharts);
    // Ajouter des écouteurs pour les autres filtres si nécessaire

    // Recherche d'agent
    agentSearchInput.addEventListener('keyup', () => {
        const searchTerm = agentSearchInput.value.toLowerCase();
        const rows = agentPerformanceTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const agentName = row.cells[0].textContent.toLowerCase();
            if (agentName.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // Fonctions d'exportation (placeholders)
    exportCsvButton.addEventListener('click', () => alert('Exportation CSV non implémentée.'));
    exportPdfButton.addEventListener('click', () => alert('Exportation PDF non implémentée.'));
    exportImageButton.addEventListener('click', () => alert('Exportation Image non implémentée.'));

    // Appel initial pour charger les graphiques
    updateCharts();
});