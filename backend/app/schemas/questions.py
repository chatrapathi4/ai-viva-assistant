
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class GenerateRequest(BaseModel):
    course_id: UUID
    topic: str = Field(min_length=3, max_length=150)
    difficulty: Literal["easy", "medium", "hard"]
    question_count: int = Field(ge=1, le=10)
    marks_per_question: int = Field(ge=1, le=20)


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=10)
    reference_answer: str = Field(min_length=10)
    key_points: list[str] = Field(min_length=1)
    grading_rubric: str = Field(min_length=10)


class QuestionSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    set_name: Literal["A", "B", "C"]
    questions: list[Question]


class GeneratedQuestions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sets: list[QuestionSet]
