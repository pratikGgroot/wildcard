"""Integration tests for Jobs API — Story 01.1"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_job_draft(client: AsyncClient, test_user):
    response = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Senior Backend Engineer",
            "description": "We are looking for a senior backend engineer with 5+ years of experience in Python and distributed systems.",
            "department": "Engineering",
            "location": "Remote",
            "type": "full-time",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["title"] == "Senior Backend Engineer"
    assert data["type"] == "full-time"
    return data["id"]


@pytest.mark.asyncio
async def test_create_job_title_too_short(client: AsyncClient, test_user):
    response = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Dev",  # < 5 chars
            "description": "We are looking for a senior backend engineer with 5+ years of experience.",
            "type": "full-time",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_job_description_too_short(client: AsyncClient, test_user):
    response = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Senior Engineer",
            "description": "Too short",  # < 50 chars
            "type": "full-time",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_activate_without_recruiter_fails(client: AsyncClient, test_user):
    # Create job
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Product Manager Role",
            "description": "We are looking for an experienced product manager to lead our platform team.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]

    # Try to activate without assigning a recruiter
    response = await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "active"},
    )
    assert response.status_code == 422
    assert "recruiter" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_activate_with_recruiter_succeeds(client: AsyncClient, test_user):
    # Create job
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Data Scientist Position",
            "description": "We are looking for a data scientist with strong ML background and Python skills.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]

    # Assign recruiter
    assign_resp = await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    assert assign_resp.status_code == 201

    # Activate
    response = await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "active"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "active"


@pytest.mark.asyncio
async def test_invalid_transition_draft_to_paused(client: AsyncClient, test_user):
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Frontend Engineer Role",
            "description": "We are looking for a frontend engineer with React and TypeScript experience.",
            "type": "contract",
        },
    )
    job_id = create_resp.json()["id"]

    response = await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "paused"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_close_requires_reason(client: AsyncClient, test_user):
    # Create + assign + activate
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "DevOps Engineer Opening",
            "description": "We are looking for a DevOps engineer with Kubernetes and AWS experience.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]
    await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    await client.patch(f"/api/v1/jobs/{job_id}/status", json={"status": "active"})

    # Close without reason
    response = await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "closed"},
    )
    assert response.status_code == 422
    assert "reason" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_close_with_reason_succeeds(client: AsyncClient, test_user):
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "ML Engineer Position",
            "description": "We are looking for an ML engineer with deep learning and Python expertise.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]
    await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    await client.patch(f"/api/v1/jobs/{job_id}/status", json={"status": "active"})

    response = await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "closed", "reason": "Position filled internally"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "closed"
    assert data["close_reason"] == "Position filled internally"


@pytest.mark.asyncio
async def test_closed_is_terminal(client: AsyncClient, test_user):
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "QA Engineer Role",
            "description": "We are looking for a QA engineer with automation testing experience.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]
    await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    await client.patch(f"/api/v1/jobs/{job_id}/status", json={"status": "active"})
    await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "closed", "reason": "Role cancelled"},
    )

    # Try to reactivate — should fail
    response = await client.patch(
        f"/api/v1/jobs/{job_id}/status",
        json={"status": "active"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_status_history_tracked(client: AsyncClient, test_user):
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Security Engineer Role",
            "description": "We are looking for a security engineer with cloud security and penetration testing skills.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]
    await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    await client.patch(f"/api/v1/jobs/{job_id}/status", json={"status": "active"})
    await client.patch(f"/api/v1/jobs/{job_id}/status", json={"status": "paused"})

    history_resp = await client.get(f"/api/v1/jobs/{job_id}/status-history")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) == 3  # draft, active, paused
    assert history[0]["to_status"] == "draft"
    assert history[1]["to_status"] == "active"
    assert history[2]["to_status"] == "paused"


@pytest.mark.asyncio
async def test_duplicate_assignment_rejected(client: AsyncClient, test_user):
    create_resp = await client.post(
        "/api/v1/jobs",
        json={
            "title": "Platform Engineer Role",
            "description": "We are looking for a platform engineer with infrastructure and SRE experience.",
            "type": "full-time",
        },
    )
    job_id = create_resp.json()["id"]

    await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    response = await client.post(
        f"/api/v1/jobs/{job_id}/assignments",
        json={"user_id": str(test_user.id), "role": "recruiter"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_jobs_with_status_filter(client: AsyncClient, test_user):
    response = await client.get("/api/v1/jobs?status=draft")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert all(j["status"] == "draft" for j in data["items"])
