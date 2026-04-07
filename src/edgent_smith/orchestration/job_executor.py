"""In-process async job executor for agentic tasks.

Manages a bounded job queue, dispatches tasks to the edge agent,
and stores results for polling by the REST API.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import structlog
from pydantic import BaseModel, Field
from ulid import ULID

from edgent_smith.config.settings import get_settings

logger = structlog.get_logger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Job(BaseModel):
    job_id: str
    run_id: str
    status: JobStatus = JobStatus.PENDING
    prompt: str
    result: Any | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))
    completed_at: datetime | None = None


class JobExecutor:
    """Manages the lifecycle of agentic jobs."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._settings = get_settings()
        self._background_tasks: set[asyncio.Task[None]] = set()

    def create_job(self, prompt: str) -> Job:
        job_id = str(ULID())
        run_id = str(ULID())
        job = Job(job_id=job_id, run_id=run_id, prompt=prompt)
        self._jobs[job_id] = job
        logger.info("job.created", job_id=job_id, run_id=run_id)
        return job

    def get_job(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def get_all_jobs(self) -> list[Job]:
        """Return all jobs (used by metrics and reporting)."""
        return list(self._jobs.values())

    async def execute_sync(self, prompt: str) -> Job:
        """Execute a task synchronously and return the completed job."""
        job = self.create_job(prompt)
        await self._run_job(job)
        return job

    async def submit_async(self, prompt: str) -> Job:
        """Submit a task for async execution and return the pending job."""
        job = self.create_job(prompt)
        task = asyncio.create_task(self._run_job(job))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
        return job

    async def _run_job(self, job: Job) -> None:
        from edgent_smith.agents import build_edge_agent
        from edgent_smith.agents.edge_agent import AgentDeps

        job.status = JobStatus.RUNNING
        logger.info("job.running", job_id=job.job_id)
        try:
            agent = build_edge_agent()
            deps = AgentDeps(
                run_id=job.run_id,
                max_tokens=self._settings.max_tokens,
                max_tool_calls=self._settings.max_tool_calls,
            )
            result = await agent.run(job.prompt, deps)
            job.result = result.model_dump()
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now(tz=timezone.utc)
            logger.info("job.completed", job_id=job.job_id)
        except Exception as exc:
            job.status = JobStatus.FAILED
            job.error = str(exc)
            job.completed_at = datetime.now(tz=timezone.utc)
            logger.error("job.failed", job_id=job.job_id, error=str(exc))


# Module-level singleton (initialized at app startup)
_executor: JobExecutor | None = None


def get_executor() -> JobExecutor:
    global _executor
    if _executor is None:
        _executor = JobExecutor()
    return _executor
