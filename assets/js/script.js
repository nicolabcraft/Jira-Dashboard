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
                    // Correction : force le rôle admin si username === 'admin'
                    let userObj = data.user || { name: username, email: data.email || '', role: data.role || 'user' };
                    if (username === 'admin') userObj.role = 'admin';
                    localStorage.setItem('user', JSON.stringify(userObj));
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
        // Logout button (fonctionne partout)
        function doLogout() {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
            localStorage.removeItem('user');
            window.location.href = '../index.html';
        }
        // Sidebar logout (icône ou lien)
        const logoutNav = document.querySelector('.nav-link .material-symbols-rounded, .nav-link .material-symbols-rounded');
        if (logoutNav && logoutNav.textContent.trim() === 'logout') {
            logoutNav.closest('.nav-link').addEventListener('click', function(e) {
                e.preventDefault();
                doLogout();
            });
        }
        // Ancien bouton logout (si présent)
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', doLogout);
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
        // Profile page: affiche infos user
        if (path === 'profile.html') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const content = document.getElementById('profile-content');
            if (!user || !user.name) {
                content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;font-size:1.2em;margin:40px 0;">Aucune information utilisateur trouvée.</div>';
            } else {
                content.innerHTML = `
                  <div style="display:flex;flex-direction:column;gap:18px;padding:24px 0;align-items:flex-start;">
                    <div><strong>Nom :</strong> ${user.name}</div>
                    <div><strong>Email :</strong> ${user.email || 'Non renseigné'}</div>
                    <div><strong>Rôle :</strong> ${user.role || 'Utilisateur'}</div>
                  </div>
                `;
            }
        }
        // Users page: admin only
        if (path === 'users.html') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const content = document.getElementById('admin-users-content');
            if (user.role !== 'admin') {
                content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;font-size:1.2em;margin:40px 0;">Accès refusé : réservé aux administrateurs.</div>';
            } else {
                // Simule une liste d'utilisateurs (à remplacer par un vrai appel API)
                const users = [
                  {name: 'Alice', email: 'alice@exemple.com', role: 'admin'},
                  {name: 'Bob', email: 'bob@exemple.com', role: 'user'},
                  {name: 'Charlie', email: 'charlie@exemple.com', role: 'user'}
                ];
                let html = `<table class="user-table" style="width:100%;border-collapse:collapse;margin-top:10px;">
                  <thead><tr style="background:var(--sidebar-hover);">
                    <th style="padding:10px 8px;text-align:left;">Nom</th>
                    <th style="padding:10px 8px;text-align:left;">Email</th>
                    <th style="padding:10px 8px;text-align:left;">Rôle</th>
                  </tr></thead><tbody>`;
                users.forEach(u => {
                  html += `<tr style="border-bottom:1px solid #e8eef6;">
                    <td style="padding:8px 8px;">${u.name}</td>
                    <td style="padding:8px 8px;">${u.email}</td>
                    <td style="padding:8px 8px;">${u.role}</td>
                  </tr>`;
                });
                html += '</tbody></table>';
                content.innerHTML = html;
            }
        }
    }
});
