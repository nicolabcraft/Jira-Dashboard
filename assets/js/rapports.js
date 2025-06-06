document.addEventListener('DOMContentLoaded', () => {
    // --- Éléments du formulaire mensuel ---
    const monthlyForm = document.getElementById('report-form-monthly');
    const monthlyStatusDiv = document.getElementById('report-status-monthly');
    const customControls = document.getElementById('custom-date-controls');

    // --- Éléments du formulaire annuel ---
    const annualForm = document.getElementById('report-form-annual');
    const annualStatusDiv = document.getElementById('report-status-annual');

    // Affiche ou cache le sélecteur de date personnalisé pour le formulaire mensuel
    if (monthlyForm) {
        monthlyForm.querySelectorAll('input[name="period"]').forEach(radio => {
            radio.addEventListener('change', () => {
                customControls.style.display =
                    monthlyForm.period.value === 'custom' ? 'block' : 'none';
            });
        });

        monthlyForm.addEventListener('submit', async e => {
            e.preventDefault();
            let year, month;
            const today = new Date();

            if (monthlyForm.period.value === 'current') {
                year = today.getFullYear();
                month = today.getMonth() + 1;
            } else {
                const monthValue = document.getElementById('report-month').value;
                if (!monthValue) {
                    monthlyStatusDiv.textContent = 'Veuillez sélectionner un mois et une année.';
                    monthlyStatusDiv.className = 'status-error';
                    return;
                }
                [year, month] = monthValue.split('-').map(Number);
            }

            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
            const periodName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' }) + ` ${year}`;
            
            generateReport(startDate, endDate, monthlyStatusDiv, monthlyForm.dest.value, periodName);
        });
    }

    // Gestion de la soumission du formulaire annuel
    if (annualForm) {
        annualForm.addEventListener('submit', async e => {
            e.preventDefault();
            const year = document.getElementById('report-year').value;
            if (!year) {
                annualStatusDiv.textContent = 'Veuillez sélectionner une année.';
                annualStatusDiv.className = 'status-error';
                return;
            }

            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            const periodName = `Année ${year}`;

            generateReport(startDate, endDate, annualStatusDiv, annualForm['dest-annual'].value, periodName);
        });
    }

    /**
     * Fonction générique pour générer un rapport.
     * @param {string} startDate - Date de début (YYYY-MM-DD)
     * @param {string} endDate - Date de fin (YYYY-MM-DD)
     * @param {HTMLElement} statusDiv - L'élément pour afficher le statut
     * @param {string} dest - La destination ('download' ou 'drive')
     * @param {string} periodName - Le nom de la période pour le nom du fichier (ex: "Juin 2024" ou "Année 2024")
     */
    async function generateReport(startDate, endDate, statusDiv, dest, periodName) {
        // Amélioration: Utilisation de innerHTML pour un formatage riche et de classes pour les styles.
        statusDiv.className = 'status-warning'; // Applique une classe pour le style
        statusDiv.innerHTML = `
            <span>Génération du rapport en cours, veuillez patienter...</span>
            <br>
            <small>⚠️ Cela peut prendre plusieurs minutes, merci de ne pas relancer la génération</small>
        `;

        try {
            // 1. Appeler l'API backend
            const apiUrl = `/api/reports?startDate=${startDate}&endDate=${endDate}`;
            const resp = await fetch(apiUrl);

            if (!resp.ok) {
                const errorData = await resp.json();
                throw new Error(`Erreur de l'API: ${errorData.error || resp.statusText}`);
            }

            const reportSheets = await resp.json();

            if (!Array.isArray(reportSheets) || reportSheets.every(sheet => sheet.data.length === 0)) {
                statusDiv.textContent = 'Aucune donnée trouvée pour la période sélectionnée. Le rapport est vide.';
                statusDiv.className = 'status-warning';
                return;
            }

            // 2. Construire le fichier Excel
            const wb = XLSX.utils.book_new();
            const introData = [
                ["Date de génération", new Date().toLocaleString('fr-FR')],
                ["Période du rapport", periodName],
                ["Dossier de destination", dest === 'download' ? 'Téléchargement local' : 'Google Drive'],
                ["URL du dossier de destination", dest === 'download' ? 'N/A' : 'https://drive.google.com/drive/folders/1BTHlJBxN1hG39-aKZCU8kyucJBaEfsBR'],
                ["Ce rapport contient des données extraites de Jira et organisées par différents filtres."],
                ["Chaque onglet représente un filtre spécifique et contient un tableau de données ainsi qu'un graphique associé."],
                ["Onglets du rapport :"],
                ["- [ER] Etiquettes : Répartition des étiquettes utilisées dans les tickets Jira."],
                ["- [ER] Département / Pôle : Répartition des tickets par département et pôle."],
                ["- [ER] Suivi de l'état des tickets Jira : Ce graphique présente l'évolution des états au cours des 30 jours."],
                ["Les données sont extraites pour la période spécifiée dans la feuille 'Introduction'."],
                ["Pour toute question relative à ce rapport, veuillez contacter l'équipe d'exploitation LMS."]
            ];
            const wsIntro = XLSX.utils.aoa_to_sheet(introData);
            XLSX.utils.book_append_sheet(wb, wsIntro, 'Introduction');

            reportSheets.forEach(sheetData => {
                if (sheetData.data.length > 0) {
                    const dataForSheet = [sheetData.columns].concat(sheetData.data);
                    const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
                    XLSX.utils.book_append_sheet(wb, ws, sheetData.name);
                }
            });

            // 3. Générer et télécharger le fichier
            const fileName = `Rapport Jira - ${periodName}.xlsx`;
            if (dest === 'download') {
                XLSX.writeFile(wb, fileName);
                statusDiv.textContent = `Rapport "${fileName}" généré et téléchargé.`;
                statusDiv.className = 'status-success';
            } else {
                statusDiv.textContent = 'L\'export vers Google Drive n\'est pas pris en charge.';
                statusDiv.className = 'status-warning';
            }

        } catch (err) {
            console.error('Erreur lors de la génération du rapport:', err);
            statusDiv.textContent = `Erreur: ${err.message}`;
            statusDiv.className = 'status-error';
        }
    }
    // --- Éléments du formulaire de statistiques de relance (mensuel) ---
    const relanceStatsForm = document.getElementById('relance-stats-form');
    const relanceStatsStatusDiv = document.getElementById('relance-stats-status');
    const customStatsDateControls = document.getElementById('custom-stats-date-controls');
    const relanceStatsResultsDiv = document.getElementById('relance-stats-results');

    // --- Éléments du formulaire de statistiques de relance (annuel) ---
    const relanceStatsFormAnnual = document.getElementById('relance-stats-form-annual');
    const relanceStatsStatusDivAnnual = document.getElementById('relance-stats-status-annual');
    const relanceStatsResultsDivAnnual = document.getElementById('relance-stats-results-annual');

    if (relanceStatsForm) {
        relanceStatsForm.querySelectorAll('input[name="stats_period"]').forEach(radio => {
            radio.addEventListener('change', () => {
                customStatsDateControls.style.display =
                    relanceStatsForm.stats_period.value === 'custom' ? 'block' : 'none';
            });
        });

        relanceStatsForm.addEventListener('submit', async e => {
            e.preventDefault();
            let year, month;
            const today = new Date();

            if (relanceStatsForm.stats_period.value === 'current') {
                year = today.getFullYear();
                month = today.getMonth() + 1;
            } else {
                const monthValue = document.getElementById('stats-month').value;
                if (!monthValue) {
                    relanceStatsStatusDiv.textContent = 'Veuillez sélectionner un mois et une année.';
                    relanceStatsStatusDiv.className = 'status-error';
                    return;
                }
                [year, month] = monthValue.split('-').map(Number);
            }

            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
            
            fetchRelanceStats(startDate, endDate);
        });
    }

    async function fetchRelanceStats(startDate, endDate) {
        relanceStatsStatusDiv.className = 'status-warning';
        relanceStatsStatusDiv.textContent = 'Chargement des statistiques...';
        relanceStatsResultsDiv.style.display = 'none';

        try {
            const apiUrl = `/api/stats/relance?startDate=${startDate}&endDate=${endDate}`;
            const resp = await fetch(apiUrl);

            if (!resp.ok) {
                const errorData = await resp.json();
                throw new Error(`Erreur de l'API: ${errorData.error || resp.statusText}`);
            }

            const stats = await resp.json();

            document.getElementById('relanced-count').textContent = stats.relanced_tickets;
            document.getElementById('closed-with-relance-count').textContent = stats.closed_with_relance;
            document.getElementById('relanced-percentage').textContent = `${stats.percentage.toFixed(2)}%`;
            document.getElementById('total-tickets-count').textContent = stats.total_tickets;

            relanceStatsResultsDiv.style.display = 'block';
            relanceStatsStatusDiv.textContent = 'Statistiques chargées.';
            relanceStatsStatusDiv.className = 'status-success';

        } catch (err) {
            console.error('Erreur lors de la récupération des statistiques de relance:', err);
            relanceStatsStatusDiv.textContent = `Erreur: ${err.message}`;
            relanceStatsStatusDiv.className = 'status-error';
        }
    }

    // Gestion du formulaire de statistiques annuelles
    if (relanceStatsFormAnnual) {
        relanceStatsFormAnnual.addEventListener('submit', async e => {
            e.preventDefault();
            const year = document.getElementById('stats-year').value;
            if (!year) {
                relanceStatsStatusDivAnnual.textContent = 'Veuillez sélectionner une année.';
                relanceStatsStatusDivAnnual.className = 'status-error';
                return;
            }

            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            
            fetchRelanceStatsAnnual(startDate, endDate);
        });
    }

    async function fetchRelanceStatsAnnual(startDate, endDate) {
        relanceStatsStatusDivAnnual.className = 'status-warning';
        relanceStatsStatusDivAnnual.textContent = 'Chargement des statistiques annuelles...';
        relanceStatsResultsDivAnnual.style.display = 'none';

        try {
            const apiUrl = `/api/stats/relance?startDate=${startDate}&endDate=${endDate}`;
            const resp = await fetch(apiUrl);

            if (!resp.ok) {
                const errorData = await resp.json();
                throw new Error(`Erreur de l'API: ${errorData.error || resp.statusText}`);
            }

            const stats = await resp.json();

            document.getElementById('relanced-count-annual').textContent = stats.relanced_tickets;
            document.getElementById('closed-with-relance-count-annual').textContent = stats.closed_with_relance;
            document.getElementById('relanced-percentage-annual').textContent = `${stats.percentage.toFixed(2)}%`;
            document.getElementById('total-tickets-count-annual').textContent = stats.total_tickets;

            relanceStatsResultsDivAnnual.style.display = 'block';
            relanceStatsStatusDivAnnual.textContent = 'Statistiques annuelles chargées.';
            relanceStatsStatusDivAnnual.className = 'status-success';

        } catch (err) {
            console.error('Erreur lors de la récupération des statistiques de relance annuelles:', err);
            relanceStatsStatusDivAnnual.textContent = `Erreur: ${err.message}`;
            relanceStatsStatusDivAnnual.className = 'status-error';
        }
    }
});
