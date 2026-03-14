"""FastAPI application entrypoint."""
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core import audit
from routers import auth, system, interfaces, routing, firewall, nat, dhcp, dns, configure, diagnostics, vpn
from routers import services
from routers import audit as audit_router
from routers import ids, flow, adguard

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": %(message)s}',
)

audit.install()

app = FastAPI(title="VyOS GUI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(system.router)
app.include_router(interfaces.router)
app.include_router(routing.router)
app.include_router(firewall.router)
app.include_router(nat.router)
app.include_router(dhcp.router)
app.include_router(dns.router)
app.include_router(configure.router)
app.include_router(diagnostics.router)
app.include_router(vpn.router)
app.include_router(services.router)
app.include_router(audit_router.router)
app.include_router(ids.router)
app.include_router(flow.router)
app.include_router(adguard.router)


@app.get("/healthz")
async def health():
    return {"status": "ok"}
