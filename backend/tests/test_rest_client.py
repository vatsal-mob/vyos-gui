"""Unit tests for REST client."""
import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from vyos.rest_client import VyOSRESTClient, RESTClientError
from vyos.models import VyOSCredentials


@pytest.fixture
def creds():
    return VyOSCredentials(
        host="10.10.10.1",
        api_key="test-key",
        api_url="https://10.10.10.1",
        tls_verify=False,
    )


@pytest.fixture
def client(creds):
    return VyOSRESTClient(creds)


@pytest.mark.asyncio
async def test_health_check_success(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": "vyos-router", "error": None}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        result = await client.health_check()
    assert result is True


@pytest.mark.asyncio
async def test_health_check_connection_error(client):
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.ConnectError("refused")):
        result = await client.health_check()
    assert result is False


@pytest.mark.asyncio
async def test_retrieve_success(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": {"host-name": "vyos"}, "error": None}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        resp = await client.show_config(["system"])
    assert resp.success is True
    assert resp.data == {"host-name": "vyos"}


@pytest.mark.asyncio
async def test_configure_sends_correct_payload(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": None, "error": None}
    mock_resp.raise_for_status = MagicMock()

    commands = [{"op": "set", "path": ["system", "host-name"], "value": "my-router"}]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp) as mock_post:
        resp = await client.configure(commands)

    assert resp.success is True
    call_kwargs = mock_post.call_args
    form_data = call_kwargs[1]["data"]
    assert form_data["key"] == "test-key"
    sent_data = json.loads(form_data["data"])
    assert sent_data == commands


@pytest.mark.asyncio
async def test_http_error_raises_rest_client_error(client):
    with patch(
        "httpx.AsyncClient.post",
        new_callable=AsyncMock,
        side_effect=httpx.HTTPStatusError("500", request=MagicMock(), response=MagicMock(status_code=500)),
    ):
        with pytest.raises(RESTClientError):
            await client.show_config(["system"])
