"""Health, readiness, and metrics endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from edgent_smith.api.schemas import HealthResponse, MetricsResponse
from edgent_smith.config.settings import get_settings
from edgent_smith.orchestration.job_executor import JobStatus, get_executor
from edgent_smith.providers import get_provider

router = APIRouter(tags=["ops"])


@router.get("/healthz", response_model=HealthResponse, summary="Health check")
async def healthz() -> HealthResponse:
    """Return service health including provider connectivity."""
    settings = get_settings()
    provider = get_provider(settings)
    provider_ok = await provider.health_check()
    return HealthResponse(
        status="ok" if provider_ok else "degraded",
        version=settings.app_version,
        model_provider=settings.model_provider.value,
        model_name=settings.model_name,
        provider_healthy=provider_ok,
    )


@router.get("/readyz", response_model=HealthResponse, summary="Readiness check")
async def readyz() -> HealthResponse:
    """Kubernetes-style readiness probe – same as health for now."""
    return await healthz()


@router.get("/metrics", response_model=MetricsResponse, summary="Job metrics")
async def metrics() -> MetricsResponse:
    """Return aggregate job execution counters."""
    executor = get_executor()
    jobs = executor.get_all_jobs()
    return MetricsResponse(
        total_jobs=len(jobs),
        completed_jobs=sum(1 for j in jobs if j.status == JobStatus.COMPLETED),
        failed_jobs=sum(1 for j in jobs if j.status == JobStatus.FAILED),
        pending_jobs=sum(1 for j in jobs if j.status == JobStatus.PENDING),
    )
