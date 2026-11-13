
from fastapi import APIRouter, Depends

from app.core.security import get_faculty, verify_course_owner
from app.schemas.questions import GenerateRequest
from app.services.groq_service import generate_questions

router = APIRouter(prefix="/api/questions", tags=["AI Questions"])


@router.post("/generate")
async def generate(
    request: GenerateRequest,
    faculty: dict = Depends(get_faculty)
):
    course = await verify_course_owner(
        str(request.course_id),
        faculty
    )

    result = await generate_questions(request, course)

    return result
