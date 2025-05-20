document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('report-form');
    const customControls = document.getElementById('custom-date-controls');
    const statusDiv = document.getElementById('report-status');
    const projectSelect = document.getElementById('project-select');
    const teamSelect = document.getElementById('team-select');

    // Toggle custom date input
    form.querySelectorAll('input[name="period"]').forEach(radio => {
        radio.addEventListener('change', () => {
            customControls.style.display =
                form.period.value === 'custom' ? 'block' : 'none';
        });
    });

    // Fetch and fill selectors
    async function fetchOrFallback(url, fallback) {
        const apiUrl = url.startsWith('http') ? url : `${window.API_BASE}${url.startsWith('/') ? url : '/' + url}`;
        try { const res = await fetch(apiUrl); if(!res.ok) throw new Error(); return await res.json(); } catch { return fallback; }
    }
    // No project/team selectors in rapports

    // Form submission
    form.addEventListener('submit', async e => {
        e.preventDefault();
        statusDiv.textContent = 'Génération en cours...';

        // Determine dates
        let year, month;
        if (form.period.value === 'current') {
            const today = new Date();
            year = today.getFullYear();
            month = today.getMonth() + 1;
        } else {
            [year, month] = document.getElementById('report-month').value.split('-').map(Number);
        }
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;

        try {
            // Original API call without projectKey and teamId
            const params = `startDate=${startDate}&endDate=${endDate}`;
            const resp = await fetch(`${window.API_BASE}/api/reports?${params}`);
            if (!resp.ok) throw new Error('API reports error');
            const { labels, statuses, departments } = await resp.json();

            // Prepare workbook
            const wb = XLSX.utils.book_new();

            // Build Introduction sheet
            const monthName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' });
            const introData = [
                ["Date de génération", new Date().toLocaleString()],
                ["Période du rapport", `${monthName} ${year}`],
                ["Méthode de sortie", form.dest.value === 'download' ? 'Téléchargement' : 'Google Drive'],
                ["API/Base URL", window.API_BASE]
            ];
            const explanationText = [
                "Ce rapport contient des données extraites de Jira et organisées par différents filtres.",
                "Chaque onglet représente un filtre spécifique et contient un tableau de données ainsi qu'un graphique associé.",
                "Les données sont extraites pour la période spécifiée dans l'Introduction.",
                "Pour toute question relative à ce rapport, veuillez contacter l'équipe d'exploitation LMS."
            ];
            explanationText.forEach(textLine => introData.push([textLine]));
            const wsIntro = XLSX.utils.aoa_to_sheet(introData);
            XLSX.utils.book_append_sheet(wb, wsIntro, 'Introduction');

            // Etiquettes
            const labelData = [['Étiquette', 'Nombre']].concat(Object.entries(labels));
            const wsLabels = XLSX.utils.aoa_to_sheet(labelData);
            XLSX.utils.book_append_sheet(wb, wsLabels, 'Étiquettes');
            // États
            const statusData = [['Statut', 'Nombre']].concat(Object.entries(statuses));
            const wsStatus = XLSX.utils.aoa_to_sheet(statusData);
            XLSX.utils.book_append_sheet(wb, wsStatus, 'États');
            // Départements
            const deptData = [['Département / Pôle', 'Nombre']].concat(Object.entries(departments));
            const wsDept = XLSX.utils.aoa_to_sheet(deptData);
            XLSX.utils.book_append_sheet(wb, wsDept, 'Départements');

            // Output
            const fileName = `${monthName}-${year}.xlsx`;
            if (form.dest.value === 'download') {
                XLSX.writeFile(wb, fileName);
                statusDiv.textContent = 'Téléchargement terminé.';
            } else {
                statusDiv.textContent = 'Export vers Google Drive non implémenté.';
            }
        } catch (err) {
            console.error(err);
            statusDiv.textContent = 'Erreur lors de la génération du rapport.';
        }
    });
});
