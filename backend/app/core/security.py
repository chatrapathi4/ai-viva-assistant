
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

bearer = HTTPBearer()

BASE = settings.SUPABASE_URL.rstrip("/")
API_KEY = settings.SUPABASE_PUBLISHABLE_KEY


async def get_faculty(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
):
    token = credentials.credentials

    headers = {
        "apikey": API_KEY,
        "Authorization": f"Bearer {token}"
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            auth_response = await client.get(
                f"{BASE}/auth/v1/user",
                headers=headers
            )

            if auth_response.status_code != 200:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired session"
                )

            user_id = auth_response.json()["id"]

            profile_response = await client.get(
                f"{BASE}/rest/v1/profiles",
                headers=headers,
                params={
                    "id": f"eq.{user_id}",
                    "select": "id,role"
                }
            )

            profile_response.raise_for_status()
            profiles = profile_response.json()

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Authentication service unavailable"
        )
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=502,
            detail="Unable to verify faculty profile"
        )

    if not profiles or profiles[0]["role"] != "faculty":
        raise HTTPException(
            status_code=403,
            detail="Faculty access required"
        )

    return {"id": user_id, "token": token}


async def verify_course_owner(course_id: str, faculty: dict):
    headers = {
        "apikey": API_KEY,
        "Authorization": f"Bearer {faculty['token']}"
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{BASE}/rest/v1/courses",
                headers=headers,
                params={
                    "id": f"eq.{course_id}",
                    "faculty_id": f"eq.{faculty['id']}",
                    "select": "id,title,code"
                }
            )
            response.raise_for_status()
            courses = response.json()

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Unable to verify course access"
        )

    if not courses:
        raise HTTPException(
            status_code=403,
            detail="Course not found or access denied"
        )

    return courses[0]
