document.addEventListener('DOMContentLoaded', () => {
    async function checkApi() {
        // Determine API test URL
        const url = `/api/mongo/test`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('API not reachable');
        } catch (e) {
            showErrorOverlay();
        }
    }
    function showErrorOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'api-error-overlay';
        overlay.innerHTML = `
            <div class="api-error-box">
                <h2>Problème API</h2>
                <p>Suite à un incident sur l'API, nous ne pouvons vous transmettre les données actuellement.</p>
                <button id="api-retry-button">Actualiser</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('api-retry-button').onclick = () => location.reload();
    }
    checkApi();
});
