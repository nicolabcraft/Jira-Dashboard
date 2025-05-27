# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.0   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public issue**. Instead, contact the maintainer directly by email or via a private channel. We will investigate and address the issue as soon as possible.

## Security Features

- **Password Hashing**: All user passwords are hashed with bcrypt before storage. No password is ever stored or transmitted in plaintext.
- **Legacy Password Upgrade**: If a legacy (plaintext) password is detected at login, it is automatically upgraded to a bcrypt hash after successful authentication.
- **Session Security**: User sessions are stored in MongoDB and protected by a strong secret key. Session hijacking and fixation are mitigated by using secure cookies and session expiration.
- **No Password Exposure**: Passwords are never returned in any API response or exposed to the frontend.
- **ObjectId Validation**: All user-related endpoints validate MongoDB ObjectIds to prevent injection and enumeration.
- **Neutral Error Messages**: Authentication and user management endpoints return generic error messages to prevent user enumeration and brute-force attacks.
- **CORS**: CORS is enabled and can be restricted to trusted origins in production.
- **Rate Limiting**: Not enabled by default. It is recommended to add a rate limiter (e.g., Flask-Limiter) in production.
- **HTTPS**: It is strongly recommended to serve the application behind HTTPS in production.

## Recommendations

- **Change the default secret key** in production (`SECRET_KEY` in `.env`).
- **Restrict CORS** to trusted domains.
- **Enable HTTPS** for all deployments.
- **Monitor dependencies** for vulnerabilities (`pip install --upgrade` regularly).
- **Backup your MongoDB database** securely and regularly.
- **Review user roles and permissions** to ensure least privilege.

## Contact

For any security concerns, please contact the maintainer directly.
Mail : [contact@nicolabcraft.xyz]
