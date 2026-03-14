"""Unit tests for SSH client path validation and pool management."""
import pytest
from unittest.mock import MagicMock, patch

from vyos.ssh_client import VyOSSSHClient, SSHClientError, clear_pool, _validate_path_component
from vyos.models import VyOSCredentials


@pytest.fixture
def creds():
    return VyOSCredentials(
        host="10.10.10.1",
        port=22,
        ssh_user="vyos",
        ssh_password="vyos",
    )


def test_validate_path_component_ok():
    assert _validate_path_component("eth0") == "eth0"
    assert _validate_path_component("192.168.1.0/24") == "192.168.1.0/24"
    assert _validate_path_component("my-description") == "my-description"


def test_validate_path_component_rejects_shell_meta():
    with pytest.raises(ValueError):
        _validate_path_component("eth0; rm -rf /")
    with pytest.raises(ValueError):
        _validate_path_component("$(evil)")
    with pytest.raises(ValueError):
        _validate_path_component("`evil`")


def test_validate_path_component_rejects_pipe():
    with pytest.raises(ValueError):
        _validate_path_component("eth0 | cat /etc/passwd")


def test_configure_rejects_unknown_op(creds):
    client = VyOSSSHClient(creds)
    with pytest.raises(ValueError, match="Unknown op"):
        client.configure([{"op": "exec", "path": ["system"], "value": ""}])


@patch("vyos.ssh_client.paramiko.SSHClient")
def test_connection_pool_reuses_connection(mock_ssh_class, creds):
    clear_pool()
    mock_instance = MagicMock()
    mock_instance.get_transport.return_value = MagicMock(is_active=lambda: True)
    mock_instance.exec_command.return_value = (
        MagicMock(),
        MagicMock(read=lambda: b"vyos"),
        MagicMock(read=lambda: b""),
    )
    mock_ssh_class.return_value = mock_instance

    client1 = VyOSSSHClient(creds)
    client2 = VyOSSSHClient(creds)

    # Simulate _get_connection storing in pool
    from vyos.ssh_client import _pool
    pool_key = (creds.host, creds.port, creds.ssh_user)
    _pool[pool_key] = mock_instance

    conn1 = client1._get_connection()
    conn2 = client2._get_connection()
    assert conn1 is conn2

    clear_pool()


def test_clear_pool_closes_connections(creds):
    from vyos.ssh_client import _pool
    mock_conn = MagicMock()
    pool_key = (creds.host, creds.port, creds.ssh_user)
    _pool[pool_key] = mock_conn

    clear_pool()

    mock_conn.close.assert_called_once()
    assert pool_key not in _pool
