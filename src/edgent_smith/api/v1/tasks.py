"""Task submission and polling endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from edgent_smith.api.schemas import ErrorResponse, TaskRequest, TaskResponse
from edgent_smith.orchestration.job_executor import Job, get_executor

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _job_to_response(job: Job) -> TaskResponse:
    return TaskResponse(
        job_id=job.job_id,
        run_id=job.run_id,
        status=job.status.value,
        result=job.result,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={422: {"model": ErrorResponse}},
    summary="Submit a task",
)
async def submit_task(body: TaskRequest) -> TaskResponse:
    """Submit a prompt for execution.

    - `async_execution=false` (default): blocks until the agent completes.
    - `async_execution=true`: returns immediately with a `job_id` for polling.
    """
    executor = get_executor()
    if body.async_execution:
        job = await executor.submit_async(body.prompt)
    else:
        job = await executor.execute_sync(body.prompt)
    return _job_to_response(job)


@router.get(
    "/{job_id}",
    response_model=TaskResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Poll a job",
)
async def get_task(job_id: str) -> TaskResponse:
    """Poll the status and result of an async job."""
    executor = get_executor()
    job = executor.get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found",
        )
    return _job_to_response(job)
