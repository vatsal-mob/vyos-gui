# Contributing to VyOS GUI

Thanks for taking the time to contribute! Here is everything you need to get started.

## Table of Contents

- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)

---

## Reporting Bugs

Before opening an issue, please:

1. Search [existing issues](https://github.com/vatsal-mob/vyos-gui/issues) — your bug may already be reported.
2. Check the [SECURITY.md](.github/SECURITY.md) for security vulnerabilities — report those privately, not as public issues.

When filing a bug, include:
- VyOS version (output of `show version` on your router)
- GUI deployment method (Docker Compose / Portainer)
- Browser and OS
- Steps to reproduce
- Expected vs. actual behaviour
- Relevant logs (`docker compose logs backend` or `docker compose logs frontend`)

## Suggesting Features

Open a [feature request](https://github.com/vatsal-mob/vyos-gui/issues/new?template=feature_request.md) with:
- What you want to do and why
- Whether VyOS supports it natively (CLI command or REST API path)

## Development Setup

### Prerequisites

- Docker & Docker Compose v2
- Python 3.12+
- Node.js 22+

### 1. Clone and configure

```bash
git clone https://github.com/vatsal-mob/vyos-gui.git
cd vyos-gui
cp .env.example .env
# Edit .env with your VyOS router details
```

### 2. Start with hot-reload

```bash
docker compose -f docker-compose.dev.yml up -d
```

- Frontend: http://localhost:3000  (Vite dev server)
- Backend API docs: http://localhost:8000/docs

### 3. Run tests

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest tests/
```

### 4. Type checks

```bash
# Backend
python -m py_compile backend/main.py

# Frontend
cd frontend && npm run lint
```

## Pull Request Process

1. **Fork** the repository and create a branch from `main`.
2. **One concern per PR** — keep changes focused.
3. If adding a new feature, update the README feature table.
4. Make sure `npm run lint` and `pytest tests/` pass locally.
5. Open a PR against `main` with a clear description of what and why.
6. A maintainer will review within a reasonable timeframe.

## Code Style

**Backend (Python)**
- [PEP 8](https://peps.python.org/pep-0008/) conventions
- Type annotations on all public functions
- One router file per feature area under `backend/routers/`

**Frontend (TypeScript / React)**
- Functional components with hooks only
- `useMemo` for AG Grid `columnDefs`, `useCallback` for cell renderers
- Zustand for global state; local state for component-scoped UI
- Tailwind CSS utility classes; avoid inline styles

**Security**
- Never log credentials, tokens, or sensitive config values
- All user-controlled path segments must pass the existing injection guard regex in `vyos/ssh_client.py`
- Destructive operations must go through the 60-second confirmation token flow
