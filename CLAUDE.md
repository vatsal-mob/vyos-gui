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
python -m venv .venv && source .venv/bin/activate   # Python 3.13 required (3.14 breaks pydantic-core)
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
- **`vyos/client.py`** — Unified async client: tries REST API first, falls back to SSH only on exceptions (not on success:false — that means "not configured", return None directly)
- **`vyos/rest_client.py`** — VyOS HTTP API wrapper (form-encoded: `key=` + `data=<json>`)
- **`vyos/ssh_client.py`** — Paramiko SSH with connection pooling and injection guards. `configure()` raises `SSHClientError` on output containing `"error"`, `"invalid"`, or `"not valid"`
- **`routers/`** — One file per feature: `auth`, `system`, `interfaces`, `routing`, `firewall`, `nat`, `dhcp`, `dns`, `vpn`, `diagnostics`, `services`, `configure`, `audit`, `ids`

### Backend: Key Patterns
- **`VyOSClient.retrieve()`**: returns `resp.data` for both `success:true` (dict) and `success:false` (None = not configured). SSH fallback only on HTTP exceptions. This prevents REST 400s from spamming the router via SSH retries.
- **`list_services()`**: uses `asyncio.gather` — 10 concurrent `retrieve()` calls, not sequential. Only paths confirmed to return HTTP 200 on this VyOS instance are in `SERVICES`.
- **IDS cache**: `routers/ids.py` caches parsed Suricata alerts for 60 seconds. One `show log` REST call per minute maximum regardless of page traffic.

### Frontend (`/frontend`)
- **`src/api/client.ts`** — Axios instance with 401 interceptor (redirects to login)
- **`src/store/`** — Zustand global state stores (auth, theme, metrics, pending)
- **`src/lib/version.ts`** — Single source of truth for `APP_VERSION`; displayed in System page
- **`src/pages/`** — One page component per feature area (14 pages including IDS)
- **`src/components/shared/DataGrid.tsx`** — AG Grid Community wrapper (`domLayout="autoHeight"`, dark/light theme via `useThemeStore`); requires `ModuleRegistry.registerModules([AllCommunityModule])` at module load
- **`src/components/dashboard/GaugeChart.tsx`** — D3 semi-circle arc gauge (0–100%, green→amber→red), used in SystemStats
- **`src/components/dashboard/ProtocolDonut.tsx`** — D3 pie/donut chart for protocol distribution, rendered on Dashboard
- **`src/components/dashboard/Sparkline.tsx`** — Pure SVG sparkline (no recharts dependency)
- **`src/components/`** — Reusable shadcn/ui + custom components
- **`vite.config.ts`** — Proxies `/api/*` to backend; `optimizeDeps.include: ["apexcharts", "react-apexcharts"]` required to pre-bundle these CJS packages

### Frontend Key Dependencies
- **ApexCharts** (`apexcharts`, `react-apexcharts`) — area charts and donut charts; use `type="area"` for timeline, `type="donut"` for distributions
- **D3.js** (`d3`, `@types/d3`) — gauge and donut charts rendered into SVG refs via `useEffect`
- **AG Grid Community** (`ag-grid-community@35`, `ag-grid-react`) — replaces HTML tables across all pages; CSS imported in `src/main.tsx`; theme class `ag-theme-quartz-dark` / `ag-theme-quartz` driven by theme store
- **Important AG Grid pattern**: all `columnDefs` must be wrapped in `useMemo` and inline cell renderer components in `useCallback` — without stable references AG Grid resets the grid on every render instead of updating rows reactively
- **No recharts** — was removed; replaced with pure SVG `Sparkline.tsx` component

### Frontend: Design System
- Fonts: `Oxanium` (display/headings), `DM Sans` (body), `JetBrains Mono` (code/mono)
- Dark theme: "Void Precision" — midnight slate (`--background: 222 28% 9%`) + electric cyan (`--primary: 199 95% 52%`)
- CSS tokens: `text-success`, `text-warning`, `text-destructive` — use these not hardcoded `text-green-*` etc.
- Custom CSS classes in `index.css`: `section-label`, `stat-card`, `card-hover`, `grid-bg`, `status-dot-live`, `nav-item-active`
- Tailwind opacity modifiers must be valid values (multiples of 5) — `bg-primary/10` not `bg-primary/8`
- Theme store: `useThemeStore()` returns `{ theme, toggleTheme }` — derive `isDark` as `theme === "dark"`

### VyOS Router (this instance)
- Host: `10.10.10.1`, SSH user: `vyos`, REST API key: `REPLIT-TEST`
- VyOS version: 2025.11.08-0018-rolling (Suricata 7.0.10)
- Suricata logs to **syslog** (`filetype: syslog`), not to `/var/log/suricata/eve.json`
- Services that return HTTP 400 from this router's REST API (excluded from `SERVICES` dict): `telnet`, `ids`, `dhcpv6-server`, `conntrack-sync`, `router-advert`, `tftp-server`, `ipoe-server`, `mdns-repeater`, `stunnel`
- Services confirmed valid (HTTP 200): `ssh`, `dhcp-server`, `dns-forwarding`, `http-api`, `ntp`, `snmp`, `lldp`, `webproxy`, `pppoe-server`, `suricata`

### Security Model
- VyOS credentials are AES-encrypted inside the JWT — never stored on disk
- 60-second confirmation tokens required for destructive operations (reboot, poweroff)
- SSH command paths validated server-side with regex injection guards

### CI/CD
- GitHub Actions: `.github/workflows/docker-publish.yml` — builds and pushes backend + frontend Docker images to `ghcr.io` on push to `main`
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` set in workflow env to opt into Node.js 24 runtime

## Testing
- **33 passing tests** across `test_routers.py`, `test_rest_client.py`, `test_ssh_client.py`
- Test setup: env vars must be set **before** any app imports (Settings() validates at import time)
- Settings singleton patched directly: `settings.gui_password_hash = hash_password("testpass")` after import
- Services tests use `asyncio.gather`-compatible mocks: `AsyncMock(side_effect=[...] * n)` where `n = len(SERVICES)`

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
