# 🛡️ Politique de Sécurité

## 📦 Versions Supportées

| Version | Support            | État de sécurité            |
| ------- | ------------------ | ----------------------------|
| 1.3.0   | :white_check_mark: | Dernière version stable     |
| 1.2.4   | :warning:          | Correctifs de sécurité      |
| 1.2.3   | :warning:          | Correctifs de sécurité      |
| 1.2.2   | :warning:          | Support de sécurité minimal |
| 1.2.1   | :x:                | Non supporté                |
| 1.2.0   | :x:                | Non supporté                |
| 1.1.0   | :x:                | Non supporté                |
| 1.0.0   | :x:                | Non supporté                |
| < 1.0   | :x:                | Non supporté                |

Il est recommandé d'utiliser la dernière version (1.2.3) pour bénéficier des derniers correctifs de sécurité.

## 🔔 Signalement des Vulnérabilités

Si vous découvrez une vulnérabilité de sécurité, merci de **ne pas ouvrir de ticket public**. Contactez plutôt directement le mainteneur par email ou via un canal privé. Nous examinerons et traiterons le problème dans les plus brefs délais.

## 🔒 Fonctionnalités de Sécurité

### 🔑 Authentification & Gestion des Sessions
- **Hashage des Mots de Passe** : Tous les mots de passe sont hashés avec bcrypt avant stockage. Aucun mot de passe n'est stocké ou transmis en clair.
- **Migration des Anciens Mots de Passe** : Si un ancien mot de passe en clair est détecté à la connexion, il est automatiquement migré vers un hash bcrypt.
- **Sécurité des Sessions** : Les sessions utilisateur sont stockées dans MongoDB et protégées par une clé secrète forte. Protection contre le détournement et la fixation de session.
- **SSO Google** : Implémentation OAuth2 sécurisée avec validation d'état et support PKCE.

### 🔐 Protection API & Données
- **Protection des Mots de Passe** : Les mots de passe ne sont jamais renvoyés dans les réponses API ni exposés au frontend.
- **Validation des ObjectId** : Tous les endpoints liés aux utilisateurs valident les ObjectId MongoDB pour prévenir l'injection et l'énumération.
- **Messages d'Erreur Neutres** : Les endpoints d'authentification renvoient des messages génériques pour prévenir l'énumération et les attaques par force brute.
- **Sécurité des Tokens Jira** : Les tokens API Jira sont stockés de manière sécurisée et jamais exposés au frontend.
- **Sécurité Google Drive** : La fonctionnalité d'export utilise des scopes OAuth2 avec permissions minimales.

### 🏰 Sécurité Infrastructure
- **CORS** : CORS est activé et peut être restreint aux origines de confiance en production.
- **Rate Limiting** : Non activé par défaut. Il est recommandé d'ajouter un limiteur de débit (ex: Flask-Limiter) en production.
- **HTTPS** : Il est fortement recommandé de servir l'application derrière HTTPS en production.

## ✅ Recommandations

### ⚙️ Sécurité de la Configuration
- **Changez la clé secrète par défaut** en production (`SECRET_KEY` dans `.env`).
- **Limitez le CORS** aux domaines de confiance uniquement.
- **Activez HTTPS** pour tous les déploiements.
- **Utilisez des tokens Jira forts** avec les permissions minimales requises.
- **Configurez Google OAuth** avec les URIs de redirection et scopes appropriés.

### 🔧 Sécurité Opérationnelle
- **Surveillez les dépendances** pour les vulnérabilités :
  ```sh
  pip install safety
  safety check
  ```
- **Sauvegardez MongoDB** de manière sécurisée et régulière.
- **Examinez les logs d'accès** périodiquement pour détecter les activités suspectes.
- **Auditez les permissions** régulièrement pour assurer le principe du moindre privilège.
- **Faites tourner les credentials** (tokens Jira, clés Google API) périodiquement.

### 👨‍💻 Bonnes Pratiques de Développement
- **Utilisez des variables d'environnement** pour toute configuration sensible.
- **Ne committez jamais de secrets** dans le contrôle de version.
- **Implémentez la validation des entrées** pour toutes les données utilisateur.
- **Maintenez les dépendances à jour** pour corriger les vulnérabilités.

## 📧 Contact

Pour toute préoccupation de sécurité, veuillez contacter directement le mainteneur.
Email : [contact@nicolabcraft.xyz]
