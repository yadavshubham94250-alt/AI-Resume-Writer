from fastapi.testclient import TestClient
import pytest
import fitz
from docx import Document
import io

from app import main
from app.repository import ResumeRepository


def test_resume_persistence_and_pdf_export_use_api(tmp_path, monkeypatch):
    repository = ResumeRepository()
    repository.path = tmp_path / "resumes.db"
    repository._initialize()
    monkeypatch.setattr(main, "repository", repository)
    client = TestClient(main.app)
    payload = {
        "title": "Engineer Resume",
        "target_role": "Engineer",
        "template": "modern",
        "content": {
            "contact": {"name": "Sam Lee", "email": "sam@example.com"},
            "summary": "Built reliable systems.",
            "experience": [{
                "id": "role-1",
                "role": "Engineer",
                "company": "A < B",
                "bullets": ["Improved service reliability."],
            }],
            "education": [],
            "projects": [],
            "skills": ["Python"],
            "certifications": [],
            "achievements": [],
        },
    }

    created = client.post("/api/resumes", json=payload)
    assert created.status_code == 201
    resume_id = created.json()["id"]

    listed = client.get("/api/resumes")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == resume_id
    assert client.get(f"/api/resumes/{resume_id}").json()["title"] == "Engineer Resume"

    payload["title"] = "Updated resume"
    updated = client.put(f"/api/resumes/{resume_id}", json=payload)
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated resume"

    pdf = client.get(f"/api/export/{resume_id}/pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")


def test_chat_rejects_blank_message_without_calling_ollama():
    client = TestClient(main.app)
    response = client.post("/api/chat", json={
        "content": {"contact": {"name": "Sam Lee"}},
        "message": "   ",
    })
    assert response.status_code == 422


def test_rewrite_rejects_generated_facts_missing_from_original(monkeypatch):
    async def invented_rewrite(prompt: str) -> str:
        return "Developed RESTful APIs in Python, improving system reliability."

    monkeypatch.setattr(main, "generate", invented_rewrite)
    response = TestClient(main.app).post("/api/ai/rewrite-bullet", json={
        "content": {"contact": {"name": "Sam Lee"}},
        "bullet": "Built API services in Python.",
    })

    assert response.status_code == 502
    assert "original text was kept" in response.json()["detail"]


def test_uploaded_pdf_gets_ats_score_without_persistence():
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text(
        (72, 72),
        "Sam Lee\nsam@example.com\nProfessional Summary\nPython developer\n"
        "Experience\n- Built Python APIs\nEducation\nBachelor degree\nSkills\nPython FastAPI",
    )
    file_bytes = pdf.tobytes()
    pdf.close()

    response = TestClient(main.app).post(
        "/api/ai/analyze-upload",
        files={"file": ("sam-resume.pdf", file_bytes, "application/pdf")},
        data={"job_description": "Python FastAPI Docker"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["filename"] == "sam-resume.pdf"
    assert 0 <= result["analysis"]["score"] <= 100
    assert result["sections_found"]["experience"] is True
    assert "python" in result["match"]["matched_keywords"]
    assert "docker" in result["match"]["missing_keywords"]
    assert result["extracted_text"]


def test_uploaded_non_pdf_docx_file_is_rejected():
    response = TestClient(main.app).post(
        "/api/ai/analyze-upload",
        files={"file": ("resume.txt", b"resume text", "text/plain")},
    )

    assert response.status_code == 415


def test_uploaded_scanned_pdf_returns_readable_error():
    pdf = fitz.open()
    pdf.new_page()
    file_bytes = pdf.tobytes()
    pdf.close()

    response = TestClient(main.app).post(
        "/api/ai/analyze-upload",
        files={"file": ("scanned.pdf", file_bytes, "application/pdf")},
    )

    assert response.status_code == 422
    assert "scanned PDF" in response.json()["detail"]


def test_uploaded_docx_extracts_resume_and_calculates_score():
    document = Document()
    document.add_paragraph("Sam Lee")
    document.add_paragraph("sam@example.com")
    table = document.add_table(rows=2, cols=1)
    table.cell(0, 0).text = "Skills"
    table.cell(1, 0).text = "Python and FastAPI"
    output = io.BytesIO()
    document.save(output)

    response = TestClient(main.app).post(
        "/api/ai/analyze-upload",
        files={"file": ("sam-resume.docx", output.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )

    assert response.status_code == 200
    assert response.json()["sections_found"]["skills"] is True
    assert "FastAPI" in response.json()["extracted_text"]
    assert 0 <= response.json()["analysis"]["score"] <= 100


def test_chat_returns_a_real_local_ollama_response_when_available():
    status = TestClient(main.app).get("/api/health").json()["ai"]
    if not status["available"]:
        pytest.skip(status["detail"])

    response = TestClient(main.app).post("/api/chat", json={
        "content": {"contact": {"name": "Sam Lee"}, "summary": "Backend developer."},
        "message": "What does my resume say about my background?",
    })
    assert response.status_code == 200
    assert response.json()["reply"].strip()
    assert response.json()["review_required"] is True
