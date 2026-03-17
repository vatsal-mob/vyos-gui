"""Integration-style tests for API routers using FastAPI TestClient."""
import os

# Must set env vars BEFORE any app imports trigger Settings() validation
os.environ["SECRET_KEY"] = "a" * 64
os.environ["GUI_USERNAME"] = "admin"
os.environ["GUI_PASSWORD_HASH"] = "$pbkdf2-sha256$260000$dummysaltfortesting00000000000000$dummyhashfortestingpurposesonly000000000000="
os.environ["VYOS_HOST"] = "10.10.10.1"
os.environ["VYOS_SSH_USER"] = "vyos"
os.environ["VYOS_SSH_PASSWORD"] = "vyos"

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from core.security import hash_password, create_access_token, encrypt_vyos_creds
from core.config import settings
from vyos.models import VyOSCredentials

# settings is a singleton already loaded — patch it directly with a real hash
settings.gui_password_hash = hash_password("testpass")


@pytest.fixture(scope="module")
def app():
    from main import app as _app
    return _app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture(scope="module")
def session_cookie():
    """Craft a valid session cookie with encrypted VyOS creds."""
    creds = VyOSCredentials(host="10.10.10.1", ssh_user="vyos", ssh_password="vyos")
    encrypted = encrypt_vyos_creds(creds.model_dump())
    token = create_access_token({"sub": "admin", "vyos_creds": encrypted})
    return {"session": token}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Auth guards
# ---------------------------------------------------------------------------

def test_system_info_requires_auth(client):
    resp = client.get("/api/system/info")
    assert resp.status_code == 401


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


def test_services_requires_auth(client):
    resp = client.get("/api/services/")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Services — bool(raw) fix
# ---------------------------------------------------------------------------

def _make_mock_client(retrieve_returns):
    """Build a mock VyOSClient whose retrieve() returns the given values in order."""
    mock = MagicMock()
    mock.retrieve = AsyncMock(side_effect=retrieve_returns)
    return mock


def test_services_list_ssh_empty_string_means_disabled(client, session_cookie):
    """SSH retrieve() returns '' for missing paths — must be treated as disabled."""
    # All services return empty string (SSH path not found)
    from routers.services import SERVICES
    n = len(SERVICES)
    mock_client = _make_mock_client([""] * n)

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.get("/api/services/", cookies=session_cookie)

    assert resp.status_code == 200
    services = resp.json()
    assert all(s["enabled"] is False for s in services), \
        "Empty string from SSH must mean disabled, not enabled"


def test_services_list_ssh_nonempty_string_means_enabled(client, session_cookie):
    """SSH retrieve() returns config text for existing paths — must be treated as enabled."""
    from routers.services import SERVICES
    n = len(SERVICES)
    mock_client = _make_mock_client(["set service ssh"] * n)

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.get("/api/services/", cookies=session_cookie)

    assert resp.status_code == 200
    services = resp.json()
    assert all(s["enabled"] is True for s in services)


def test_services_list_rest_none_means_disabled(client, session_cookie):
    """REST retrieve() returns None for non-existent config path — must be disabled."""
    from routers.services import SERVICES
    n = len(SERVICES)
    mock_client = _make_mock_client([None] * n)

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.get("/api/services/", cookies=session_cookie)

    assert resp.status_code == 200
    services = resp.json()
    assert all(s["enabled"] is False for s in services)


def test_services_list_rest_dict_means_enabled(client, session_cookie):
    """REST retrieve() returns a dict when path exists — must be enabled."""
    from routers.services import SERVICES
    n = len(SERVICES)
    mock_client = _make_mock_client([{"port": 22}] * n)

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.get("/api/services/", cookies=session_cookie)

    assert resp.status_code == 200
    services = resp.json()
    assert all(s["enabled"] is True for s in services)


def test_enable_service_calls_configure(client, session_cookie):
    """POST /services/ssh/enable must call configure with a set op."""
    mock_client = MagicMock()
    mock_client.configure = AsyncMock(return_value=True)

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.post("/api/services/ssh/enable", cookies=session_cookie)

    assert resp.status_code == 200
    assert resp.json()["enabled"] is True
    mock_client.configure.assert_called_once()
    cmd = mock_client.configure.call_args[0][0][0]
    assert cmd["op"] == "set"
    assert cmd["path"] == ["service", "ssh"]


def test_disable_service_calls_configure(client, session_cookie):
    """POST /services/ssh/disable must call configure with a delete op."""
    mock_client = MagicMock()
    mock_client.configure = AsyncMock(return_value=True)

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.post("/api/services/ssh/disable", cookies=session_cookie)

    assert resp.status_code == 200
    assert resp.json()["enabled"] is False
    cmd = mock_client.configure.call_args[0][0][0]
    assert cmd["op"] == "delete"
    assert cmd["path"] == ["service", "ssh"]


def test_enable_unknown_service_returns_404(client, session_cookie):
    resp = client.post("/api/services/nonexistent-svc/enable", cookies=session_cookie)
    assert resp.status_code == 404


def test_disable_unknown_service_returns_404(client, session_cookie):
    resp = client.post("/api/services/nonexistent-svc/disable", cookies=session_cookie)
    assert resp.status_code == 404


def test_enable_service_configure_failure_returns_500(client, session_cookie):
    """If configure raises, endpoint must return 500."""
    mock_client = MagicMock()
    mock_client.configure = AsyncMock(side_effect=Exception("SSH timeout"))

    with patch("core.dependencies.VyOSClient", return_value=mock_client):
        resp = client.post("/api/services/ssh/enable", cookies=session_cookie)

    assert resp.status_code == 500
