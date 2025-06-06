document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('report-form');
    const customControls = document.getElementById('custom-date-controls');
    const statusDiv = document.getElementById('report-status');

    // Affiche ou cache le sélecteur de date personnalisé
    form.querySelectorAll('input[name="period"]').forEach(radio => {
        radio.addEventListener('change', () => {
            customControls.style.display =
                form.period.value === 'custom' ? 'block' : 'none';
        });
    });

    // Gestion de la soumission du formulaire
    form.addEventListener('submit', async e => {
        e.preventDefault();
        statusDiv.textContent = 'Génération du rapport en cours, veuillez patienter...';
        statusDiv.style.color = '#7ecfff';

        // 1. Déterminer la plage de dates
        let year, month;
        const today = new Date();

        if (form.period.value === 'current') {
            year = today.getFullYear();
            month = today.getMonth() + 1;
        } else {
            const monthValue = document.getElementById('report-month').value;
            if (!monthValue) {
                statusDiv.textContent = 'Veuillez sélectionner un mois et une année.';
                statusDiv.style.color = '#ff7e7e';
                return;
            }
            [year, month] = monthValue.split('-').map(Number);
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
        const monthName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' });

        try {
            // 2. Appeler l'API backend pour obtenir les données traitées
            const apiUrl = `/api/reports?startDate=${startDate}&endDate=${endDate}`;
            const resp = await fetch(apiUrl);

            if (!resp.ok) {
                const errorData = await resp.json();
                throw new Error(`Erreur de l'API: ${errorData.error || resp.statusText}`);
            }

            const reportSheets = await resp.json();

            if (reportSheets.every(sheet => sheet.data.length === 0)) {
                 statusDiv.textContent = 'Aucune donnée trouvée pour la période sélectionnée. Le rapport est vide.';
                 statusDiv.style.color = '#ffb347';
                 return;
            }

            // 3. Construire le fichier Excel avec SheetJS
            const wb = XLSX.utils.book_new();

            // Feuille d'introduction
            const introData = [
                ["Date de génération", new Date().toLocaleString('fr-FR')],
                ["Période du rapport", `${monthName} ${year}`],
                ["Dossier de destination", form.dest.value === 'download' ? 'Téléchargement local' : 'Google Drive (non supporté)'],
                ["URL du dossier", form.dest.value === 'download' ? 'N/A' : 'https://drive.google.com/'],
                ["Ces données sont issues de l\'API Jira et peuvent être sujettes à des modifications ultérieures."],
                [""],
                ["Chaque onglet représente un filtre spécifique et contient un tableau de données ainsi qu'un graphique associé."],
                ["Onglets du rapport :"],
                ["- [ER] Etiquettes : Répartition des étiquettes utilisées dans les tickets Jira."],
                ["- [ER] Département / Pôle : Répartition des tickets par département et pôle."],
                ["- [ER] Suivi de l'état des tickets Jira : Ce graphique présente l'évolution des états au cours des 30 jours."],
                ["Les données sont extraites pour la période spécifiée dans la feuille 'Introduction'."],
                ["Pour toute question relative à ce rapport, veuillez contacter l'équipe Emergency Room."]
            ];
            const wsIntro = XLSX.utils.aoa_to_sheet(introData);
            XLSX.utils.book_append_sheet(wb, wsIntro, 'Introduction');

            // Ajouter une feuille pour chaque jeu de données reçu
            reportSheets.forEach(sheetData => {
                const dataForSheet = [sheetData.columns].concat(sheetData.data);
                const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
                XLSX.utils.book_append_sheet(wb, ws, sheetData.name);
            });

            // 4. Générer et télécharger le fichier
            const fileName = `Rapport Jira - ${monthName} ${year}.xlsx`;
            if (form.dest.value === 'download') {
                XLSX.writeFile(wb, fileName);
                statusDiv.textContent = `Rapport "${fileName}" généré et téléchargé avec succès.`;
                statusDiv.style.color = '#7fff7e';
            } else {
                statusDiv.textContent = 'L\'export vers Google Drive n\'est pas pris en charge depuis cette interface.';
                statusDiv.style.color = '#ffb347';
            }

        } catch (err) {
            console.error('Erreur lors de la génération du rapport:', err);
            statusDiv.textContent = `Erreur: ${err.message}`;
            statusDiv.style.color = '#ff7e7e';
        }
    });
});
