// users.js
// Affiche la liste des utilisateurs si admin, sinon accès refusé

document.addEventListener('DOMContentLoaded', function() {
  // Simule l'authentification (à remplacer par un vrai appel API)
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const content = document.getElementById('admin-users-content');
  if (user.role !== 'admin') {
    content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;font-size:1.2em;margin:40px 0;">Accès refusé : réservé aux administrateurs.</div>';
    return;
  }
  // Simule une liste d'utilisateurs (à remplacer par un vrai appel API)
  const users = [
    {name: 'Alice', email: 'alice@exemple.com', role: 'admin'},
    {name: 'Bob', email: 'bob@exemple.com', role: 'user'},
    {name: 'Charlie', email: 'charlie@exemple.com', role: 'user'}
  ];
  let html = '<table class="user-table"><tr><th>Nom</th><th>Email</th><th>Rôle</th></tr>';
  users.forEach(u => {
    html += `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td></tr>`;
  });
  html += '</table>';
  content.innerHTML = html;
});
