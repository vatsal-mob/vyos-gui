# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack web GUI for managing VyOS routers. Architecture:

```
Browser (React) → Frontend (port 3000) → Backend FastAPI (port 8000) → VyOS Router (REST API / SSH)
```

## Commands

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Tests
pytest tests/
pytest tests/test_routers.py   # single test file

# Type check
python -m py_compile main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # dev server on port 5173
npm run build      # tsc + vite production build
npm run lint       # ESLint for .ts/.tsx files
npm run preview    # preview production build
```

### Docker (primary workflow)
```bash
cp .env.example .env   # first-time setup
docker compose -f docker-compose.dev.yml up -d   # dev with hot-reload
docker compose up -d                             # production
```

Frontend: http://localhost:3000 | Backend API docs: http://localhost:8000/docs

## Architecture

### Backend (`/backend`)
- **`main.py`** — FastAPI app entry, mounts all routers
- **`core/config.py`** — Pydantic Settings loaded from `.env`
- **`core/security.py`** — JWT (session cookies), PBKDF2-SHA256 password hashing (260k iterations), AES encryption for VyOS credentials inside JWT
- **`core/dependencies.py`** — FastAPI dependency injection (auth, VyOS client)
- **`vyos/client.py`** — Unified async client: tries REST API first, falls back to SSH
- **`vyos/rest_client.py`** — VyOS HTTP API wrapper
- **`vyos/ssh_client.py`** — Paramiko SSH with connection pooling and injection guards
- **`routers/`** — One file per feature: `auth`, `system`, `interfaces`, `routing`, `firewall`, `nat`, `dhcp`, `dns`, `vpn`, `diagnostics`, `services`, `configure`, `audit`

### Frontend (`/frontend`)
- **`src/api/client.ts`** — Axios instance with 401 interceptor (redirects to login)
- **`src/store/`** — Zustand global state stores
- **`src/pages/`** — One page component per feature area (14 pages)
- **`src/components/shared/DataGrid.tsx`** — AG Grid Community wrapper (`domLayout="autoHeight"`, dark/light theme via `useThemeStore`); requires `ModuleRegistry.registerModules([AllCommunityModule])` at module load
- **`src/components/dashboard/GaugeChart.tsx`** — D3 semi-circle arc gauge (0–100%, green→amber→red), used in SystemStats
- **`src/components/dashboard/ProtocolDonut.tsx`** — D3 pie/donut chart for protocol distribution, rendered on Dashboard
- **`src/components/`** — Reusable shadcn/ui + custom components
- **`vite.config.ts`** — Proxies `/api/*` to backend; `optimizeDeps.include: ["apexcharts", "react-apexcharts"]` required to pre-bundle these CJS packages

### Frontend Key Dependencies (branch: `frontend-revamp`)
- **ApexCharts** (`apexcharts`, `react-apexcharts`) — replaces Recharts for dashboard area charts; use `type="area"` with `sparkline: { enabled: true }` for interface sparklines
- **D3.js** (`d3`, `@types/d3`) — gauge and donut charts rendered into SVG refs via `useEffect`
- **AG Grid Community** (`ag-grid-community@35`, `ag-grid-react`) — replaces HTML tables across all pages; CSS imported in `src/main.tsx`; theme class `ag-theme-quartz-dark` / `ag-theme-quartz` driven by theme store
- **Important AG Grid pattern**: all `columnDefs` must be wrapped in `useMemo` and inline cell renderer components in `useCallback` — without stable references AG Grid resets the grid on every render instead of updating rows reactively

### Security Model
- VyOS credentials are AES-encrypted inside the JWT — never stored on disk
- 60-second confirmation tokens required for destructive operations (reboot, poweroff)
- SSH command paths validated server-side with regex injection guards

## Key Environment Variables
```bash
SECRET_KEY=          # 32-byte hex, used for JWT + AES
GUI_USERNAME=admin
GUI_PASSWORD_HASH=   # PBKDF2 hash — generate with backend/generate_hash.py
VYOS_HOST=           # router IP
VYOS_SSH_USER=vyos
VYOS_SSH_PASSWORD=
VYOS_API_KEY=        # optional, enables REST API mode
VYOS_API_URL=        # e.g. https://10.10.10.1
VYOS_TLS_VERIFY=false
CORS_ORIGINS=["http://localhost:3000"]
```
