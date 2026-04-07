"""Unit tests for API schemas and endpoints using TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from edgent_smith.main import create_app


@pytest.fixture()
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_openapi_schema_available(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    data = resp.json()
    assert "paths" in data


def test_docs_available(client):
    resp = client.get("/docs")
    assert resp.status_code == 200


def test_health_endpoint(client):
    resp = client.get("/api/v1/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == "0.1.0"
    assert "provider_healthy" in body


def test_metrics_endpoint_initial(client):
    resp = client.get("/api/v1/metrics")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_jobs"] == 0


def test_task_not_found(client):
    resp = client.get("/api/v1/tasks/nonexistent-id")
    assert resp.status_code == 404
