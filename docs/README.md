# Site Monitoring – Gestion des Utilisateurs & Dashboard Jira

Ce projet est une application web Flask permettant de gérer des utilisateurs (CRUD sécurisé avec MongoDB) et de visualiser des statistiques Jira (tickets, KPIs, rapports, etc.).

## Fonctionnalités principales

- **Authentification sécurisée** (bcrypt, session MongoDB, SSO Google)
- **Gestion des utilisateurs** (création, édition, suppression, listing, changement de mot de passe)
- **Affichage du profil** (infos à jour, changement de mot de passe pour comptes locaux)
- **Dashboard Jira** (KPIs, tickets, rapports dynamiques)
- **Sécurité** :
  - Mots de passe jamais exposés
  - Hashage automatique des anciens mots de passe en clair à la connexion
  - Validation stricte des ObjectId
  - Messages d’erreur neutres (anti-énumération)

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
3. **Créez un fichier `.env`** à la racine avec vos variables (exemple) :
   ```env
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
   MONGODB_DB=studiapijira
   MONGODB_COLLECTION=stats
   USERS_DB=users
   USERS_COLLECTION=users
   SESSION_DB=users
   SESSION_COLLECTION=sessions
   JIRA_URL=https://votreinstance.atlassian.net
   JIRA_USERNAME=...@....
   JIRA_TOKEN=...
   JIRA_PROJECT_DEFAULT=HEL
   JIRA_ASSIGNEES=nom1,nom2
   SECRET_KEY=unsecret
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/login/google/callback
   GOOGLE_API_CREDENTIALS_PATH=/path/to/your/google_api_credentials.json
   GOOGLE_DRIVE_SHARE_EMAIL=your_google_drive_share_email
   PORT=5000
   ```
4. **Lancez le serveur** :
   ```sh
   python main.py
   ```
5. **Accédez à l’interface** :
   - http://localhost:5000/
   - http://localhost:5000/pages/users.html (gestion utilisateurs)
   - http://localhost:5000/pages/profile.html (profil)
   - http://localhost:5000/pages/dashboard.html (dashboard)

## Structure du projet

- `main.py` : Backend Flask (API, sécurité, gestion utilisateurs, Jira)
- `requirements.txt` : Dépendances Python
- `assets/` :
  - `js/` : scripts front (users.js, profile.js, etc.)
  - `css/` : styles (modele.css, sidebar.css)
  - `img/` : images et logos
- `pages/` : pages HTML (users, profile, dashboard, etc.)

## Sécurité & bonnes pratiques
- Les mots de passe sont toujours hashés (bcrypt)
- Les anciens comptes avec mot de passe en clair sont automatiquement migrés au hash lors de la connexion
- Les endpoints API ne révèlent jamais le mot de passe
- Les erreurs d’authentification sont neutres
- Les ObjectId sont validés côté backend

## FAQ

**Q : Je n’arrive pas à me connecter, mon mot de passe date d’avant la migration ?**
> Connectez-vous une fois avec votre ancien mot de passe, il sera automatiquement sécurisé (hashé) pour les prochaines connexions.

**Q : Comment ajouter un utilisateur ?**
> Utilisez la page `/pages/users.html` ou l’API `/api/users` (POST).

**Q : Comment activer le SSO Google ?**
> Renseignez les variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, et `GOOGLE_REDIRECT_URI` dans `.env`.

**Q : Comment activer les exports Google Drive ?**
> Renseignez les variables `GOOGLE_API_CREDENTIALS_PATH` et `GOOGLE_DRIVE_SHARE_EMAIL` dans `.env`.

## Licence
MIT
