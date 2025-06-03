const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");
const menuToggler = document.querySelector(".menu-toggler");
// Ensure these heights match the CSS sidebar height values
let collapsedSidebarHeight = "56px"; // Height in mobile view (collapsed)
let fullSidebarHeight = "calc(100vh - 32px)"; // Height in larger screen
// Toggle sidebar's collapsed state
sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  // Forcer l'affichage des icônes
  document.querySelectorAll('.nav-link .nav-icon').forEach(icon => {
    icon.style.display = 'inline-flex';
  });
});
// Update sidebar height and menu toggle text
const toggleMenu = (isMenuActive) => {
  sidebar.style.height = isMenuActive ? `${sidebar.scrollHeight}px` : collapsedSidebarHeight;
  menuToggler.querySelector("span").innerText = isMenuActive ? "close" : "menu";
}
// Toggle menu-active class and adjust height
menuToggler.addEventListener("click", () => {
  toggleMenu(sidebar.classList.toggle("menu-active"));
});
// (Optional code): Adjust sidebar height on window resize
window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) {
    sidebar.style.height = fullSidebarHeight;
  } else {
    sidebar.classList.remove("collapsed");
    sidebar.style.height = "auto";
    toggleMenu(sidebar.classList.contains("menu-active"));
  }
});
// Thème clair/sombre
const storageKey = 'theme-preference';
const getColorPreference = () => {
  if (localStorage.getItem(storageKey))
    return localStorage.getItem(storageKey);
  else
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const setPreference = () => {
  localStorage.setItem(storageKey, theme.value);
  reflectPreference();
};
const reflectPreference = () => {
  document.firstElementChild.setAttribute('data-theme', theme.value);
  document.querySelector('#theme-toggle')?.setAttribute('aria-label', theme.value);
};
const theme = { value: getColorPreference() };
reflectPreference();
window.onload = () => {
  reflectPreference();
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    setPreference();
  });
};
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ({matches:isDark}) => {
  theme.value = isDark ? 'dark' : 'light';
  setPreference();
});
// Logout button handler (fonctionne partout, même si plusieurs boutons)
document.querySelectorAll('.nav-link .material-symbols-rounded').forEach(icon => {
  if (icon.textContent.trim() === 'logout') {
    icon.closest('.nav-link').addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('user');
      // Redirige vers la page de login (ou index.html si pas de page login)
      window.location.href = '../index.html';
    });
  }
});
// --- GARDER L'ÉTAT DE LA SIDEBAR ENTRE LES PAGES ---
const sidebarStateKey = 'sidebar-collapsed';
// Appliquer l'état sauvegardé au chargement
if (localStorage.getItem(sidebarStateKey) === 'true') {
  sidebar.classList.add('collapsed');
  // Forcer l'affichage des icônes si la sidebar est fermée
  document.querySelectorAll('.nav-link .nav-icon').forEach(icon => {
    icon.style.display = 'inline-flex';
  });
}
// Sauvegarder l'état à chaque toggle
sidebarToggler.addEventListener('click', () => {
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem(sidebarStateKey, isCollapsed);
});
// --- SÉLECTEUR DE PROJET JIRA MODERNE ---
function createModernProjectSelector(projects, selectedKey) {
  // Conteneur principal
  let container = document.createElement('div');
  container.id = 'jira-project-selector-container';
  container.className = 'modern-project-selector';

  // Bouton arrondi affichant le projet sélectionné
  let button = document.createElement('button');
  button.type = 'button';
  button.className = 'project-selector-btn';
  button.innerHTML = `
    <span class="material-symbols-rounded">folder_open</span>
    <span class="selected-project-label">${projects.find(p => p.key === selectedKey)?.name || 'Sélectionner...'}</span>
    <span class="material-symbols-rounded arrow">expand_more</span>
  `;
  container.appendChild(button);

  // Menu déroulant stylé
  let menu = document.createElement('ul');
  menu.className = 'project-selector-menu';
  projects.forEach(project => {
    let item = document.createElement('li');
    item.className = 'project-selector-item';
    item.textContent = project.name;
    if (project.key === selectedKey) item.classList.add('selected');
    item.onclick = () => {
      localStorage.setItem('selectedJiraProject', project.key);
      window.location.reload();
    };
    menu.appendChild(item);
  });
  container.appendChild(menu);

  // Affichage/fermeture du menu
  button.onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    button.classList.toggle('active');
  };
  document.addEventListener('click', () => {
    menu.classList.remove('open');
    button.classList.remove('active');
  });

  return container;
}

// Afficher/Masquer le sélecteur selon l'état de la sidebar
function updateProjectSelectorVisibility() {
  const container = document.getElementById('jira-project-selector-container');
  if (!container) return;
  if (sidebar.classList.contains('collapsed')) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
  }
}

async function fetchJiraProjects() {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error('Erreur lors de la récupération des projets Jira');
    return await response.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

// Initialisation du sélecteur de projet moderne
(async function initModernProjectSelector() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const selectedKey = localStorage.getItem('selectedJiraProject') || '';
  const projects = await fetchJiraProjects();
  if (projects && projects.length) {
    // Supprime l'ancien sélecteur s'il existe
    document.getElementById('jira-project-selector-container')?.remove();
    const selectorContainer = createModernProjectSelector(projects, selectedKey);
    sidebar.insertBefore(selectorContainer, sidebar.firstChild);
    updateProjectSelectorVisibility();
    sidebarToggler.addEventListener('click', updateProjectSelectorVisibility);
    window.addEventListener('resize', updateProjectSelectorVisibility);
  }
})();
// --- SÉLECTEUR DE PROJET JIRA POUR RAPPORTS ---
document.addEventListener('DOMContentLoaded', async () => {
  // Ajoute le sélecteur de projet si la page contient un formulaire de rapport
  const form = document.getElementById('report-form');
  if (!form && !document.querySelector('.sidebar')) return;
  // Récupère la liste des projets via l'API sécurisée
  const projects = await fetchJiraProjects();
  if (projects && projects.length && form) {
    let selectedKey = localStorage.getItem('selectedJiraProject') || projects[0].key;
    let selector = document.createElement('select');
    selector.id = 'jira-project-selector';
    selector.style.margin = '16px 0';
    projects.forEach(project => {
      let option = document.createElement('option');
      option.value = project.key;
      option.textContent = project.name;
      if (project.key === selectedKey) option.selected = true;
      selector.appendChild(option);
    });
    selector.addEventListener('change', function() {
      localStorage.setItem('selectedJiraProject', this.value);
    });
    // Ajoute le sélecteur en haut du formulaire
    form.insertBefore(selector, form.firstChild);
  }
});
