# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately via [GitHub Security Advisories](https://github.com/vatsal-mob/vyos-gui/security/advisories/new).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within **72 hours**. If the issue is confirmed, a fix will be released as soon as possible and credited to you (unless you prefer anonymity).

## Security Design Notes

- VyOS credentials are AES-encrypted inside the JWT session cookie and **never stored on disk or in any database**
- Passwords are hashed with PBKDF2-SHA256 at 260,000 iterations
- All SSH commands are validated server-side with strict regex injection guards before execution
- Destructive operations (reboot, poweroff, rule deletion) require a short-lived 60-second confirmation token
- The `SECRET_KEY` environment variable is required — the app will not start without it

## Threat Model

This GUI is designed for **homelab / private network use** behind a trusted network boundary. It is not hardened for exposure to the public internet. If you need to access it remotely, place it behind a VPN or reverse proxy with strong authentication.
