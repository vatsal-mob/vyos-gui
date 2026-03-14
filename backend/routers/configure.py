"""Batch configure endpoint — used by the frontend CommitBanner."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import ConfigureBatch

router = APIRouter(prefix="/api/vyos", tags=["configure"])
logger = logging.getLogger(__name__)


@router.post("/configure")
async def batch_configure(
    batch: ConfigureBatch,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    """Apply a batch of set/delete commands, commit, and save."""
    if not batch.commands:
        raise HTTPException(status_code=400, detail="No commands provided")
    commands = [c.model_dump(exclude_none=True) for c in batch.commands]
    try:
        await client.configure(commands)
        logger.info('{"event": "batch_configure", "count": %d}', len(commands))
        return {"status": "ok", "applied": len(commands)}
    except Exception as e:
        logger.error("batch_configure failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save")
async def save_config(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Save the running configuration."""
    try:
        await client.save()
        logger.info('{"event": "config_save"}')
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_config(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return the full running configuration as text."""
    try:
        text = await client.load_config()
        return {"config": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/restore")
async def restore_config(
    file: UploadFile = File(...),
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Restore configuration from an uploaded file."""
    content = await file.read()
    try:
        await client.restore_config(content.decode())
        logger.info('{"event": "config_restore", "filename": "%s"}', file.filename)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
