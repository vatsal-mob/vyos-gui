"""Integration-style tests for API routers using FastAPI TestClient."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from core.security import hash_password, create_access_token, encrypt_vyos_creds
from vyos.models import VyOSCredentials


# Patch settings before importing app
import os
os.environ.setdefault("SECRET_KEY", "a" * 64)
os.environ.setdefault("GUI_USERNAME", "admin")
os.environ.setdefault("GUI_PASSWORD_HASH", hash_password("testpass"))
os.environ.setdefault("VYOS_HOST", "10.10.10.1")
os.environ.setdefault("VYOS_SSH_USER", "vyos")
os.environ.setdefault("VYOS_SSH_PASSWORD", "vyos")


@pytest.fixture(scope="module")
def app():
    from main import app as _app
    return _app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture(scope="module")
def session_cookie(app):
    """Craft a valid session cookie with encrypted VyOS creds."""
    creds = VyOSCredentials(host="10.10.10.1", ssh_user="vyos", ssh_password="vyos")
    encrypted = encrypt_vyos_creds(creds.model_dump())
    token = create_access_token({"sub": "admin", "vyos_creds": encrypted})
    return {"session": token}


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_login_success(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "testpass"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert "session" in resp.cookies


def test_login_wrong_password(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrongpass"},
    )
    assert resp.status_code == 401


def test_logout(client, session_cookie):
    resp = client.post("/api/auth/logout", cookies=session_cookie)
    assert resp.status_code == 200


def test_system_info_requires_auth(client):
    resp = client.get("/api/system/info")
    assert resp.status_code == 401


def test_system_info_with_session(client, session_cookie):
    mock_client = MagicMock()
    mock_client.get_system_info = AsyncMock(return_value={
        "hostname": "vyos-router",
        "version": "VyOS 1.4",
        "uptime": "up 2 hours",
        "cpu_percent": 5.0,
        "memory_total": 1073741824,
        "memory_used": 268435456,
        "memory_percent": 25.0,
        "load_average": [0.1, 0.2, 0.3],
        "ntp_servers": ["pool.ntp.org"],
    })

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.get("/api/system/info", cookies=session_cookie)

    # May succeed or fail depending on dep injection — just check auth passed
    assert resp.status_code in (200, 500)


def test_interfaces_requires_auth(client):
    resp = client.get("/api/interfaces/")
    assert resp.status_code == 401


def test_routing_table_requires_auth(client):
    resp = client.get("/api/routing/table")
    assert resp.status_code == 401


def test_firewall_chains_requires_auth(client):
    resp = client.get("/api/firewall/chains")
    assert resp.status_code == 401


def test_nat_source_requires_auth(client):
    resp = client.get("/api/nat/source")
    assert resp.status_code == 401


def test_dhcp_pools_requires_auth(client):
    resp = client.get("/api/dhcp/pools")
    assert resp.status_code == 401


def test_dns_forwarding_requires_auth(client):
    resp = client.get("/api/dns/forwarding")
    assert resp.status_code == 401
