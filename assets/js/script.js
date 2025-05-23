document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    // Login page logic
    if (path === 'index.html' || path === '') {
        if (localStorage.getItem('isLoggedIn')) {
            window.location.href = 'pages/dashboard.html';
            return;
        }
        // Login with username/password
        const loginBtn = document.getElementById('submit');
        loginBtn.addEventListener('click', async e => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            if (username && password) {
                // Call backend for auth
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('username', username);
                    window.location.href = 'pages/dashboard.html';
                } else {
                    alert(data.error || 'Identifiants invalides');
                }
            } else {
                alert('Veuillez entrer un utilisateur et un mot de passe valides');
            }
        });
        // Google SSO
        const googleBtn = document.querySelector('.signg');
        if (googleBtn) {
            googleBtn.addEventListener('click', e => {
                e.preventDefault();
                window.location.href = '/api/login/google';
            });
        }
    } else {
        // Auth check for other pages
        if (!localStorage.getItem('isLoggedIn')) {
            window.location.href = '../index.html';
            return;
        }
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('username');
                window.location.href = '../index.html';
            });
        }
        // Sidebar toggle
        const toggleBtn = document.getElementById('toggle-sidebar-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('collapsed');
            });
        }
        // Theme toggle (for dashboard)
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            // Restore saved mode
            const darkMode = localStorage.getItem('darkMode') === 'true';
            document.body.classList.toggle('dark-mode', darkMode);
            themeToggle.checked = darkMode;
            // On change, toggle mode and reload for chart re-render
            themeToggle.addEventListener('change', e => {
                const isDark = e.target.checked;
                localStorage.setItem('darkMode', isDark);
                document.body.classList.toggle('dark-mode', isDark);
                setTimeout(() => window.location.reload(), 100);
            });
        }
    }
});
