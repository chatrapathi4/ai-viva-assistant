# backend/app/api/voice.py
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from uuid import UUID
from app.core.config import settings

router = APIRouter(prefix='/api/voice', tags=['Voice Viva'])
auth = HTTPBearer()


class StartRequest(BaseModel):
    assignment_id: UUID


class AnswerRequest(BaseModel):
    attempt_id: UUID
    question_number: int = Field(ge=1)
    answer: str = Field(max_length=4000)


class FinishRequest(BaseModel):
    attempt_id: UUID


async def rpc(name: str, payload: dict, token: str):
    headers = {
        'apikey': settings.SUPABASE_PUBLISHABLE_KEY,
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f'{settings.SUPABASE_URL.rstrip("/")}/rest/v1/rpc/{name}',
                json=payload,
                headers=headers,
            )
    except httpx.RequestError:
        raise HTTPException(503, 'Database service unavailable')
    if response.status_code >= 400:
        # Do not relay raw database exception text to a browser.
        if response.status_code in (401, 403):
            raise HTTPException(response.status_code, 'Not authorized')
        raise HTTPException(400, 'Action not allowed or attempt unavailable')
    return response.json() if response.content else {'ok': True}


@router.post('/start')
async def start(data: StartRequest, credentials: HTTPAuthorizationCredentials = Depends(auth)):
    return await rpc('start_voice_viva', {'p_assignment_id': str(data.assignment_id)}, credentials.credentials)


@router.post('/answer')
async def answer(data: AnswerRequest, credentials: HTTPAuthorizationCredentials = Depends(auth)):
    return await rpc('save_voice_answer', {
        'p_attempt_id': str(data.attempt_id),
        'p_question_number': data.question_number,
        'p_answer': data.answer,
    }, credentials.credentials)


@router.post('/finish')
async def finish(data: FinishRequest, credentials: HTTPAuthorizationCredentials = Depends(auth)):
    return await rpc('finish_voice_viva', {'p_attempt_id': str(data.attempt_id)}, credentials.credentials)
