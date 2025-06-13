# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.0   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public issue**. Instead, contact the maintainer directly by email or via a private channel. We will investigate and address the issue as soon as possible.

## Security Features

### Authentication & Session Management
- **Password Hashing**: All user passwords are hashed with bcrypt before storage. No password is ever stored or transmitted in plaintext.
- **Legacy Password Upgrade**: If a legacy (plaintext) password is detected at login, it is automatically upgraded to a bcrypt hash after successful authentication.
- **Session Security**: User sessions are stored in MongoDB and protected by a strong secret key. Session hijacking and fixation are mitigated by using secure cookies and session expiration.
- **Google SSO**: Secure OAuth2 implementation with state validation and PKCE support.

### API & Data Protection
- **No Password Exposure**: Passwords are never returned in any API response or exposed to the frontend.
- **ObjectId Validation**: All user-related endpoints validate MongoDB ObjectIds to prevent injection and enumeration.
- **Neutral Error Messages**: Authentication and user management endpoints return generic error messages to prevent user enumeration and brute-force attacks.
- **Jira Token Security**: Jira API tokens are stored securely and never exposed to the frontend.
- **Google Drive Security**: Export functionality uses OAuth2 scopes with minimal permissions.

### Infrastructure Security
- **CORS**: CORS is enabled and can be restricted to trusted origins in production.
- **Rate Limiting**: Not enabled by default. It is recommended to add a rate limiter (e.g., Flask-Limiter) in production.
- **HTTPS**: It is strongly recommended to serve the application behind HTTPS in production.

## Recommendations

### Configuration Security
- **Change the default secret key** in production (`SECRET_KEY` in `.env`).
- **Restrict CORS** to trusted domains only.
- **Enable HTTPS** for all deployments.
- **Use strong Jira tokens** with minimal required permissions.
- **Configure Google OAuth** with appropriate redirect URIs and scopes.

### Operational Security
- **Monitor dependencies** for vulnerabilities:
  ```sh
  pip install safety
  safety check
  ```
- **Backup MongoDB** securely and regularly.
- **Review access logs** periodically for suspicious activity.
- **Audit user permissions** regularly to ensure least privilege.
- **Rotate credentials** (Jira tokens, Google API keys) periodically.

### Development Practices
- **Use environment variables** for all sensitive configuration.
- **Never commit secrets** to version control.
- **Implement input validation** for all user-supplied data.
- **Keep dependencies updated** to patch security vulnerabilities.

## Contact

For any security concerns, please contact the maintainer directly.
Mail : [contact@nicolabcraft.xyz]
