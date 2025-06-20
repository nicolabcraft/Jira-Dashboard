# 🏗️ Architecture du Dashboard Jira

🔍 Ce document détaille l'architecture technique du Dashboard Jira (v1.2.3), une application web permettant de visualiser et gérer les tickets Jira ainsi que les utilisateurs.

## 🎯 Vue d'ensemble

### 📂 Modules JavaScript
Les fichiers JavaScript suivants jouent un rôle clé dans l'application :
- `admin_dashboard.js` : Gestion des KPI, mise à jour de la santé du support, et interactions avec l'API.
- `dashboard.js` : Visualisation des données via Chart.js et gestion des erreurs.
- `rapports.js` : Génération de rapports et intégration avec Google Drive.
- `users.js` : Gestion des utilisateurs via l'API.
- `particles.js` : Effets visuels pour l'interface utilisateur.
- `sidebar.js` : Gestion des préférences utilisateur et du menu.

### 🔄 Flux de données supplémentaires
```mermaid
sequenceDiagram
    Frontend->>API: Fetch user data
    API->>MongoDB: Query user collection
    MongoDB-->>API: Return user data
    API-->>Frontend: Send user data
    Frontend->>Google Drive: Export report
    Google Drive-->>Frontend: Confirmation
```

```mermaid
graph TD
    subgraph "Frontend (Browser)"
        A[Pages HTML/CSS]
        B[JavaScript Modules]
        C[Chart.js Visualizations]
        D[Particles.js Effects]
        E[Sidebar Preferences]
        A --> B
        B --> C
        B --> D
        B --> E
    end

    subgraph "Backend (Flask)"
        F[API REST]
        G[Worker Thread]
        H[Authentication]
        I[Session Manager]
        F <--> G
        F <--> H
        H <--> I
    end

    subgraph "Storage"
        J[MongoDB Atlas]
        subgraph "Collections"
            K[Stats]
            L[Users]
            M[Sessions]
        end
        J --> K
        J --> L
        J --> M
    end

    subgraph "External Services"
        N[Jira API]
        O[Google OAuth]
        P[Google Drive]
    end

    B -- "API Calls" --> F
    G -- "Stats Update" --> K
    H -- "Auth" --> O
    F -- "Ticket Data" --> N
    F -- "Export" --> P
    F -- "User Data" --> L
    B -- "Export Reports" --> P
```

## 🔧 Architecture Backend

### 🧩 Composants Principaux

1. **🌐 API REST (Flask)**
   - Endpoints sécurisés avec authentification requise
   - Gestion des routes pour les statistiques, utilisateurs et rapports
   - Middleware CORS et gestion des sessions
   - Support des requêtes HTTPS

2. **⚡ Worker Thread**
   - Mise à jour automatique des statistiques toutes les 5 minutes
   - Exécution asynchrone des requêtes Jira
   - Cache des données dans MongoDB
   - Gestion intelligente des erreurs

3. **🔐 Gestionnaire d'authentification**
   - Support multi-méthodes (local + Google SSO)
   - Hashage bcrypt des mots de passe
   - Migration automatique des anciens mots de passe
   - Protection contre les attaques par force brute

4. **🔌 Intégrations**
   - Client Jira (requêtes REST avec authentification)
   - Google OAuth2 pour SSO
   - Google Drive pour l'export des rapports
   - Gestion sécurisée des tokens

### 💾 Structure de la base de données

```mermaid
erDiagram
    STATS {
        string _id
        int total_tickets
        int tickets_resolved
        int support_health
        object request_types
        object status_counts
        datetime updated_at
    }
    USERS {
        ObjectId _id
        string username
        string password
        string email
        string role
        string type_connexion
    }
    SESSIONS {
        string session_id
        string user_id
        datetime expires
    }
```

## 🎨 Architecture Frontend

### 📦 Structure des modules

1. **Core Modules**
   - `dashboard.js`: Visualisation des KPIs et graphiques
   - `users.js`: Gestion des utilisateurs
   - `rapports.js`: Génération et export des rapports

2. **Composants UI**
   - Chart.js pour les visualisations
   - Interface responsive avec thème clair/sombre
   - Composants réutilisables (sidebar, overlay)

3. **Gestion des données**
   - Requêtes API avec gestion d'erreurs
   - Cache local des données
   - Rafraîchissement automatique (60s)

## 🔄 Flux de données

### 📊 Diagramme de séquence
```mermaid
sequenceDiagram
    Frontend->>API: Fetch user data
    API->>MongoDB: Query user collection
    MongoDB-->>API: Return user data
    API-->>Frontend: Send user data
    Frontend->>Google Drive: Export report
    Google Drive-->>Frontend: Confirmation
```

### 🛠️ Gitgraph
```mermaid
gitGraph
    commit id: "Initial commit"
    branch dev
    checkout dev
    commit id: "Fonctionnality"
    checkout main
    merge dev id: "Merge dev into main"
    commit id: "Release vX.X.X"
```

### 🗺️ Diagramme RD
```mermaid
graph RL
    A[Frontend] --> B[Backend]
    B --> C[Database]
    C --> D[External Services]
    D --> E[Google Drive]
    D --> F[Jira API]
    B --> G[Authentication]
    G --> H[OAuth]
    G --> I[Session Manager]
```

1. **📊 Statistiques Jira**
   ```mermaid
   sequenceDiagram
       Worker->>Jira: Fetch ticket data
       Jira-->>Worker: Raw ticket data
       Worker->>Worker: Process statistics
       Worker->>MongoDB: Store processed stats
       Frontend->>API: Request stats
       API->>MongoDB: Fetch cached stats
       MongoDB-->>API: Return stats
       API-->>Frontend: Send formatted stats
   ```

2. **🔐 Authentification**
   ```mermaid
   sequenceDiagram
       User->>Frontend: Login attempt
       Frontend->>API: Auth request
       alt Local Auth
           API->>MongoDB: Verify credentials
           MongoDB-->>API: User data
       else Google SSO
           API->>Google: OAuth2 flow
           Google-->>API: User info
           API->>MongoDB: Create/Update user
       end
       API-->>Frontend: Auth token + user data
   ```

## 🛡️ Sécurité

### 🔒 Mesures implémentées

1. **Authentification**
   - Hashage bcrypt des mots de passe
   - Sessions MongoDB sécurisées
   - Support SSO Google avec OAuth2

2. **API Security**
   - Validation des ObjectId
   - Messages d'erreur neutres
   - Protection CORS configurable

3. **Data Security**
   - Pas d'exposition des mots de passe
   - Validation des entrées utilisateur
   - Tokens Jira et Google sécurisés

### ✅ Bonnes pratiques

- Variables d'environnement pour les secrets
- Rotation régulière des credentials
- Validation stricte des données entrantes
- Logs sécurisés sans données sensibles

## 🚀 Déploiement

L'application utilise une architecture modulaire permettant un déploiement flexible :

- 🌐 Backend Flask avec Waitress comme serveur WSGI
- 💾 MongoDB Atlas pour la scalabilité de la base de données
- 🔄 Intégration continue avec les variables d'environnement
- 🛠️ Support des modes développement et production
- 📊 Monitoring des performances
- 🔒 Configuration sécurisée par défaut

Pour plus de détails sur les versions et les mises à jour, consultez les [notes de version](https://github.com/nicolabcraft/Jira-Dashboard/releases).
