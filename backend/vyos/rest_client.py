"""httpx-based async wrapper for VyOS HTTP API."""
import logging
from typing import Any

import httpx

from vyos.models import VyOSCredentials, VyOSResponse

logger = logging.getLogger(__name__)


class RESTClientError(Exception):
    pass


class VyOSRESTClient:
    def __init__(self, creds: VyOSCredentials):
        self.creds = creds
        self._base_url = creds.api_url.rstrip("/")
        self._key = creds.api_key
        self._verify = creds.tls_verify

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(verify=self._verify, timeout=30.0)

    async def _post(self, endpoint: str, data: dict[str, Any]) -> VyOSResponse:
        url = f"{self._base_url}/{endpoint.lstrip('/')}"
        import json as _json
        form = {
            "key": self._key,
            "data": _json.dumps(data),
        }
        try:
            async with self._client() as client:
                resp = await client.post(url, data=form)
            resp.raise_for_status()
            payload = resp.json()
            return VyOSResponse(
                success=payload.get("success", False),
                data=payload.get("data"),
                error=payload.get("error"),
            )
        except httpx.ConnectError as e:
            raise RESTClientError(f"Cannot connect to VyOS API: {e}") from e
        except httpx.HTTPStatusError as e:
            raise RESTClientError(f"HTTP error {e.response.status_code}: {e}") from e
        except Exception as e:
            raise RESTClientError(f"REST request failed: {e}") from e

    async def retrieve(self, path: list[str]) -> VyOSResponse:
        """GET config node value."""
        return await self._post(
            "retrieve",
            {"op": "returnValue", "path": path},
        )

    async def retrieve_values(self, path: list[str]) -> VyOSResponse:
        """GET config node values (list)."""
        return await self._post(
            "retrieve",
            {"op": "returnValues", "path": path},
        )

    async def show_config(self, path: list[str]) -> VyOSResponse:
        """Show configuration at path as dict."""
        return await self._post(
            "retrieve",
            {"op": "showConfig", "path": path},
        )

    async def configure(self, commands: list[dict[str, Any]]) -> VyOSResponse:
        """Send set/delete operations. Each: {"op": "set"|"delete", "path": [...]}."""
        return await self._post("configure", commands)

    async def show(self, path: list[str]) -> VyOSResponse:
        """Operational show command."""
        return await self._post(
            "show",
            {"op": "show", "path": path},
        )

    async def save(self) -> VyOSResponse:
        return await self._post("config-file", {"op": "save"})

    async def generate(self, path: list[str]) -> VyOSResponse:
        return await self._post("generate", {"op": "generate", "path": path})

    async def reboot(self) -> VyOSResponse:
        return await self._post("reboot", {"op": "reboot", "path": ["now"]})

    async def health_check(self) -> bool:
        """Return True if REST API is reachable and key is valid."""
        try:
            resp = await self.show_config(["system", "host-name"])
            return resp.success
        except RESTClientError:
            return False
