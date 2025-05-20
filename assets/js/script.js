document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    // Login page logic
    if (path === 'index.html' || path === '') {
        if (localStorage.getItem('isLoggedIn')) {
            window.location.href = 'pages/dashboard.html';
            return;
        }
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            if (username && password) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                window.location.href = 'pages/dashboard.html';
            } else {
                alert('Veuillez entrer un utilisateur et un mot de passe valides');
            }
        });
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
