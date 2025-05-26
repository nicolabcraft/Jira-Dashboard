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
          <td>${u.name || u.username || u.email || ''}</td>
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
        document.getElementById('user-id-view').value = '';
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
            document.getElementById('user-id-view').value = u.id || '';
            nameInput.value = u.name || '';
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

  // Error message element
  const errorMsg = document.createElement('div');
  errorMsg.id = 'user-form-error';
  errorMsg.style.color = '#ff7e7e';
  errorMsg.style.fontWeight = 'bold';
  errorMsg.style.marginBottom = '10px';
  form.insertAdjacentElement('beforebegin', errorMsg);
  errorMsg.style.display = 'none';

  cancelBtn.onclick = function() {
    formContainer.style.display = 'none';
    editingId = null;
  };

  function clearError() {
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
    [nameInput, emailInput, usernameInput, passwordInput, roleInput].forEach(input => {
      input.classList.remove('input-error');
    });
  }
  [nameInput, emailInput, usernameInput, passwordInput, roleInput].forEach(input => {
    input.addEventListener('input', clearError);
  });

  form.onsubmit = async function(e) {
    e.preventDefault();
    clearError();
    // Client-side validation
    let hasError = false;
    if (!nameInput.value.trim()) { nameInput.classList.add('input-error'); hasError = true; }
    if (!emailInput.value.trim()) { emailInput.classList.add('input-error'); hasError = true; }
    if (!usernameInput.value.trim()) { usernameInput.classList.add('input-error'); hasError = true; }
    if (!passwordInput.value.trim() && !editingId) { passwordInput.classList.add('input-error'); hasError = true; }
    if (!roleInput.value.trim()) { roleInput.classList.add('input-error'); hasError = true; }
    if (hasError) {
      errorMsg.textContent = 'Veuillez remplir tous les champs obligatoires.';
      errorMsg.style.display = 'block';
      return;
    }
    // Construction des données à envoyer
    let data = {};
    if (nameInput.value.trim()) data.name = nameInput.value;
    if (prenomInput.value.trim()) data.prenom = prenomInput.value;
    if (emailInput.value.trim()) data.email = emailInput.value;
    if (usernameInput.value.trim()) data.username = usernameInput.value;
    if (typeConnexionInput.value.trim()) data.type_connexion = typeConnexionInput.value;
    if (roleInput.value.trim()) data.role = roleInput.value;
    // Password : seulement si rempli OU création
    if (passwordInput.value.trim()) data.password = passwordInput.value;
    try {
      let res, result;
      if (editingId) {
        res = await fetch(`/api/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Création : tous les champs obligatoires doivent être envoyés
        data = {
          name: nameInput.value,
          prenom: prenomInput.value,
          email: emailInput.value,
          username: usernameInput.value,
          password: passwordInput.value,
          type_connexion: typeConnexionInput.value,
          role: roleInput.value
        };
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      result = await res.json();
      if (!res.ok) {
        errorMsg.textContent = result.detail || result.error || 'Erreur lors de la soumission.';
        errorMsg.style.display = 'block';
        // Optionally highlight fields from backend error
        if (result.detail && result.detail.includes("'name'")) nameInput.classList.add('input-error');
        if (result.detail && result.detail.includes("'email'")) emailInput.classList.add('input-error');
        if (result.detail && result.detail.includes("'username'")) usernameInput.classList.add('input-error');
        if (result.detail && result.detail.includes("'password'")) passwordInput.classList.add('input-error');
        if (result.detail && result.detail.includes("'role'")) roleInput.classList.add('input-error');
        return;
      }
      formContainer.style.display = 'none';
      editingId = null;
      renderUsers();
    } catch (err) {
      errorMsg.textContent = 'Erreur réseau ou serveur.';
      errorMsg.style.display = 'block';
    }
  };

  renderUsers();
});
