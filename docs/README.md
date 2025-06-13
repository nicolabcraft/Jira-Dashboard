# 📊 Site Monitoring – Dashboard Jira & Gestion Utilisateurs

🌟 Application web moderne permettant de visualiser des statistiques Jira et gérer les utilisateurs de manière sécurisée.

## 📦 Versions supportées

| Version | Support            |
| ------- | ------------------ |
| 1.3.0   | :white_check_mark: |
| 1.2.4   | :warning:          |
| 1.2.3   | :warning:          |
| 1.2.2   | :warning:          |
| 1.2.1   | :x:                |
| 1.2.0   | :x:                |
| 1.1.0   | :x:                |
| 1.0.0   | :x:                |
| < 1.0   | :x:                |

### 📝 Notes de version

- **v1.2.3** : Dernières améliorations et corrections de bugs
- **v1.2.2** : Optimisations de performance
- **v1.2.1** : Corrections mineures
- **v1.2.0** : Nouvelles fonctionnalités majeures
- **v1.1.0** : Améliorations significatives
- **v1.0.0** : Première version stable

Pour plus de détails sur chaque version, consultez les [notes de version complètes](https://github.com/nicolabcraft/Jira-Dashboard/releases).

## 🎯 Vue d'ensemble

- **Frontend** : Application web responsive avec visualisation dynamique des données (Chart.js)
- **Backend** : API REST Flask avec intégration Jira et authentification sécurisée
- **Base de données** : MongoDB pour le stockage des utilisateurs, sessions et statistiques
- **Intégrations** : API Jira, Google OAuth (SSO), Google Drive (exports)

## ✨ Fonctionnalités principales

### 📈 Dashboard Jira
- Visualisation des KPIs et métriques clés
- Suivi des tickets en temps réel
- Génération de rapports dynamiques
- Export des données vers Google Drive

### 👥 Gestion des utilisateurs
- Interface CRUD complète et sécurisée
- Authentification locale ou SSO Google
- Gestion des profils utilisateurs
- Changement de mot de passe sécurisé

### 🔒 Sécurité renforcée
- Hashage bcrypt des mots de passe
- Sessions MongoDB sécurisées
- Migration automatique des anciens mots de passe
- Validation stricte des données
- Messages d'erreur neutres (anti-énumération)

## Installation

### Prérequis
- Python 3.8+
- MongoDB (local ou Atlas)
- Un compte Jira avec accès API
- (Optionnel) Un compte Google Cloud pour SSO

### Déploiement local
1. **Clonez le repo et placez-vous dans le dossier**
2. **Installez les dépendances** :
   ```sh
   pip install -r requirements.txt
   ```
3. **Configuration** : Créez un fichier `.env` à la racine en vous basant sur `.env.example` dans le dossier `docs/`. Les principales sections sont :
   - Configuration MongoDB (connexion, bases de données)
   - Paramètres d'authentification (secret key, Google OAuth)
   - Configuration Jira (URL, credentials, projet par défaut)
   - Intégration Google Drive (optionnel)
   - Configuration serveur (port)
4. **Lancez le serveur** :
   ```sh
   python main.py
   ```
5. **Accédez à l’interface** :
   - http://localhost:5000/
   - http://localhost:5000/pages/users.html (gestion utilisateurs)
   - http://localhost:5000/pages/profile.html (profil)
   - http://localhost:5000/pages/dashboard.html (dashboard)

## 📁 Structure du projet

```
.
├── main.py                 # Backend Flask (API REST)
├── requirements.txt        # Dépendances Python
├── assets/                 # Ressources statiques
│   ├── js/                # Scripts frontend
│   │   ├── dashboard.js   # Logique du dashboard
│   │   ├── users.js       # Gestion utilisateurs
│   │   └── ...
│   ├── css/               # Styles
│   └── img/               # Images et logos
├── pages/                 # Pages HTML
│   ├── dashboard.html     # Vue principale
│   ├── users.html        # Gestion utilisateurs
│   └── ...
└── docs/                 # Documentation
    ├── .env.example      # Template configuration
    ├── architecture.md   # Documentation technique
    └── SECURITY.md       # Guide de sécurité
```

## 📚 Documentation complémentaire

- [Architecture détaillée](./architecture.md) - Vue d'ensemble technique de l'application
- [Guide de sécurité](./SECURITY.md) - Guide des bonnes pratiques et mesures de sécurité
- [Notes de version](https://github.com/nicolabcraft/Jira-Dashboard/releases) - Historique des versions et changements

## ❓ FAQ & Dépannage

### 🔑 Authentification
- **Ancien mot de passe non reconnu** : La première connexion avec un ancien mot de passe le migrera automatiquement vers le format sécurisé (bcrypt)
- **Activation SSO Google** : Configurez les variables GOOGLE_* dans `.env` et assurez-vous que l'URL de redirection est autorisée dans la console Google Cloud

### ⚡ Fonctionnalités
- **Ajout d'utilisateurs** : Via l'interface `/pages/users.html` ou l'API `/api/users` (POST)
- **Export Google Drive** : Nécessite la configuration des variables GOOGLE_API_CREDENTIALS_PATH et GOOGLE_DRIVE_SHARE_EMAIL

### 🔧 API & Développement
- **Logs** : Consultez les logs du serveur Flask pour le diagnostic des erreurs

## 📄 Licence

MIT - Voir [LICENCE](./LICENCE) pour plus de détails
