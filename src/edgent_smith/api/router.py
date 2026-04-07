"""Top-level API router."""

from __future__ import annotations

from fastapi import APIRouter

from edgent_smith.api.v1 import health, tasks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(tasks.router)
