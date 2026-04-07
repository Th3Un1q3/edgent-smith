"""Shared request/response schemas for the REST API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TaskRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4096, description="The task prompt")
    async_execution: bool = Field(
        default=False, description="If true, submit async and return job_id"
    )


class TaskResponse(BaseModel):
    job_id: str
    run_id: str
    status: Literal["pending", "running", "completed", "failed"]
    result: Any | None = None
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    version: str
    model_provider: str
    model_name: str
    provider_healthy: bool


class MetricsResponse(BaseModel):
    total_jobs: int
    completed_jobs: int
    failed_jobs: int
    pending_jobs: int


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
