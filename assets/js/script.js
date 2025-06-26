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
        const handleLogin = async () => {
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
                    // Stocke l'objet utilisateur complet retourné par le backend
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'pages/dashboard.html';
                } else {
                    alert(data.error || 'Identifiants invalides');
                }
            } else {
                alert('Veuillez entrer un utilisateur et un mot de passe valides');
            }
        };

        loginBtn.addEventListener('click', async e => {
            e.preventDefault();
            await handleLogin();
        });

        // Trigger login on Enter key press
        const passwordField = document.getElementById('password');
        passwordField.addEventListener('keydown', async e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await handleLogin();
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
            fetch('/api/user').then(r => r.json()).then(user => {
                const content = document.getElementById('profile-content');
                function renderProfile(u) {
                    let infos = `<div style="display:flex;flex-direction:column;gap:18px;padding:24px 0;align-items:flex-start;">
                      <div><strong>ID :</strong> ${u.id || 'Non disponible'}</div>
                      <div><strong>Nom :</strong> ${u.name}</div>
                      <div><strong>Prénom :</strong> ${u.prenom || 'Non renseigné'}</div>
                      <div><strong>Email :</strong> ${u.email || 'Non renseigné'}</div>
                      <div><strong>Nom d'utilisateur :</strong> ${u.username || 'Non renseigné'}</div>
                      <div><strong>Type de connexion :</strong> ${u.type_connexion || 'Local'}</div>
                      <div><strong>Rôle :</strong> ${u.role || 'Utilisateur'}</div>`;
                    if (u.type_connexion === 'SSO-Google') {
                      infos += `<div style='color:#2196f3;font-size:1em;margin-top:10px;'><strong>Note :</strong> Il est impossible de modifier le mot de passe ici. Merci de vous rapprocher de l’IT si vous avez oublié votre mot de passe.<br>Petit rappel : dans la majorité des comptes Studi, votre mot de passe Google est celui du OneLogin GGE.</div>`;
                    } else {
                      infos += `<button id='change-password-btn' style='margin-top:10px;'>Changer le mot de passe</button>`;
                    }
                    infos += '</div>';
                    content.innerHTML = infos;
                    // Gestion du changement de mot de passe pour compte local
                    if (u.type_connexion !== 'SSO-Google') {
                      const btn = document.getElementById('change-password-btn');
                      if (btn) {
                        btn.onclick = function() {
                          const newPwd = prompt('Nouveau mot de passe :');
                          if (newPwd && newPwd.length >= 4) {
                            fetch(`/api/users/${u.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ password: newPwd })
                            }).then(r => r.json()).then(result => {
                              if (result && !result.error) {
                                alert('Mot de passe modifié avec succès.');
                              } else {
                                alert(result.error || 'Erreur lors de la modification.');
                              }
                            });
                          } else if (newPwd) {
                            alert('Le mot de passe doit contenir au moins 4 caractères.');
                          }
                        };
                      }
                    }
                }
                if (!user || user.error) {
                    content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;font-size:1.2em;margin:40px 0;">Aucune information utilisateur trouvée.</div>';
                } else {
                    renderProfile(user);
                }
            });
        }
        // Users page: admin only
        if (path === 'users.html') {
            // Do nothing here! users.js handles all user management and rendering.
        }
    }
});
