// Fonction pour vérifier si l'utilisateur est admin
async function checkAndShowAdminButton() {
    try {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });
        if (!response.ok) return;
        
        const user = await response.json();
        const adminButton = document.querySelector('.nav-item a[href="admin_dashboard.html"]')?.parentElement;
        const visualizeButton = document.querySelector('.nav-item a[href="visualise.html"]')?.parentElement;

        if (adminButton) {
            if (user.role === 'admin') {
                adminButton.style.display = 'block';
                visualizeButton.style.display = 'block';
            } else {
                adminButton.style.display = 'none';
                visualizeButton.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des droits admin:', error);
    }
}

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
window.onload = async () => {
    await checkAndShowAdminButton();
  reflectPreference();
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    setPreference();
    if (typeof window.refreshAllBlocks === 'function') {
      window.refreshAllBlocks();
    }
    renderDoughnutChart('chart', yourRawData); // Remplace "yourRawData" par tes données réelles
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
