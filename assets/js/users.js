// users.js
// Gestion utilisateurs via API backend (CRUD)

document.addEventListener('DOMContentLoaded', function() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const content = document.getElementById('admin-users-content');
  const formContainer = document.getElementById('user-form-container');
  const form = document.getElementById('user-form');
  const nameInput = document.getElementById('user-name');
  const emailInput = document.getElementById('user-email');
  const roleInput = document.getElementById('user-role');
  const idInput = document.getElementById('user-id');
  const cancelBtn = document.getElementById('cancel-user-btn');
  // Ajout des nouveaux champs du formulaire
  const prenomInput = document.getElementById('user-prenom');
  const usernameInput = document.getElementById('user-username');
  const passwordInput = document.getElementById('user-password');
  const typeConnexionInput = document.getElementById('user-type_connexion');
  let editingId = null;

  if (!user || user.role !== 'admin') {
    content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;font-size:1.2em;margin:40px 0;">Accès refusé : réservé aux administrateurs.</div>';
    formContainer.style.display = 'none';
    return;
  }

  // API helpers
  async function fetchUsers() {
    const res = await fetch('/api/users');
    if (!res.ok) {
      content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;">Erreur lors de la récupération des utilisateurs.</div>';
      return [];
    }
    return await res.json();
  }
  async function createUser(data) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  }
  async function updateUser(id, data) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  }
  async function deleteUser(id) {
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
  }

  // Render users table
  async function renderUsers() {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Erreur API');
      const users = await res.json();
      if (!Array.isArray(users)) throw new Error('Format API invalide');
      let html = `<table class="users-table">
        <thead><tr>
          <th>Nom</th>
          <th>Email</th>
          <th>Rôle</th>
          <th>Actions</th>
        </tr></thead><tbody>`;
      users.forEach(u => {
        html += `<tr>
          <td>${u.nom || u.username || u.email || ''}</td>
          <td>${u.email || ''}</td>
          <td>${u.role || ''}</td>
          <td>
            <div class="users-actions">
              <button class="users-action-btn edit-user-btn" data-id="${u.id}" title="Modifier">✏️</button>
              <button class="users-action-btn delete-user-btn" data-id="${u.id}" title="Supprimer">🗑️</button>
            </div>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      html += '<button id="add-user-btn" style="margin-top:18px;">Ajouter un utilisateur</button>';
      content.innerHTML = html;
      document.getElementById('add-user-btn').onclick = () => {
        editingId = null;
        form.reset();
        formContainer.style.display = 'block';
      };
      // Bind edit/delete
      content.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.onclick = async () => {
          const res = await fetch('/api/users');
          const users = await res.json();
          const u = users.find(x => x.id == btn.dataset.id);
          if (u) {
            editingId = u.id;
            nameInput.value = u.nom || '';
            prenomInput.value = u.prenom || '';
            emailInput.value = u.email || '';
            usernameInput.value = u.username || '';
            passwordInput.value = u.password || '';
            typeConnexionInput.value = u.type_connexion || '';
            roleInput.value = u.role || 'user';
            idInput.value = u.id;
            formContainer.style.display = 'block';
          }
        };
      });
      content.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.onclick = async () => {
          if (confirm('Supprimer cet utilisateur ?')) {
            await fetch(`/api/users/${btn.dataset.id}`, { method: 'DELETE' });
            renderUsers();
          }
        };
      });
    } catch (e) {
      content.innerHTML = '<div style="color:#ff7e7e;font-weight:bold;">Erreur lors de la récupération des utilisateurs.</div>';
    }
  }

  cancelBtn.onclick = function() {
    formContainer.style.display = 'none';
    editingId = null;
  };

  form.onsubmit = async function(e) {
    e.preventDefault();
    const data = {
      nom: nameInput.value,
      prenom: prenomInput.value,
      email: emailInput.value,
      username: usernameInput.value,
      password: passwordInput.value,
      type_connexion: typeConnexionInput.value,
      role: roleInput.value
    };
    if (editingId) {
      await updateUser(editingId, data);
    } else {
      await createUser(data);
    }
    formContainer.style.display = 'none';
    editingId = null;
    renderUsers();
  };

  renderUsers();
});
