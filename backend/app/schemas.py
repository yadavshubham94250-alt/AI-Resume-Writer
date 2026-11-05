from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated


class Link(BaseModel):
    label: str = ""
    url: str = ""


class Contact(BaseModel):
    name: str = "Your Name"
    email: str = ""
    phone: str = ""
    location: str = ""
    links: list[Link] = Field(default_factory=list)


class Experience(BaseModel):
    id: str
    company: str = ""
    role: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = "Present"
    bullets: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class Education(BaseModel):
    id: str
    institution: str = ""
    degree: str = ""
    field: str = ""
    start_date: str = ""
    end_date: str = ""
    grade: str = ""


class Project(BaseModel):
    id: str
    name: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    links: list[Link] = Field(default_factory=list)


class ResumeContent(BaseModel):
    contact: Contact = Field(default_factory=Contact)
    summary: str = ""
    experience: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)


class ResumeCreate(BaseModel):
    title: str = "Untitled resume"
    target_role: str = ""
    template: Literal["classic", "modern", "minimal"] = "modern"
    content: ResumeContent = Field(default_factory=ResumeContent)


class Resume(ResumeCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class ProviderStatus(BaseModel):
    provider: str
    available: bool
    model: str
    detail: str = ""


class HealthResponse(BaseModel):
    status: str
    ai: ProviderStatus


class AIContentRequest(BaseModel):
    content: ResumeContent


class RewriteBulletRequest(AIContentRequest):
    bullet: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class JobMatchRequest(AIContentRequest):
    job_description: Annotated[str, StringConstraints(max_length=20000)] = ""


class ChatRequest(JobMatchRequest):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
