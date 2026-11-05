from app.schemas import Contact, Experience, ResumeContent
from app.services.ai import is_fact_preserving_rewrite
from app.services.analysis import analyze_job_match, analyze_resume_text, ats_analysis


def sample_content() -> ResumeContent:
    return ResumeContent(contact=Contact(name="Sam Lee", email="sam@example.com"), skills=["Python", "FastAPI"],
        summary="Backend developer.", experience=[Experience(id="1", company="Acme", role="Developer", bullets=["Built FastAPI services for customers."])])


def test_job_match_identifies_present_and_absent_keywords():
    result = analyze_job_match(sample_content(), "Seeking a Python FastAPI developer with Docker skills.")
    assert "python" in result["matched_keywords"]
    assert "docker" in result["missing_keywords"]


def test_ats_analysis_returns_transparent_breakdown():
    result = ats_analysis(sample_content())
    assert result["score"] > 0
    assert set(result["breakdown"]) == {"structure", "keyword_coverage", "readability", "impact"}


def test_bullet_rewrite_guard_rejects_unsupported_details():
    original = "Built API services in Python."
    assert is_fact_preserving_rewrite(original, "Developed API services in Python.")
    assert not is_fact_preserving_rewrite(
        original,
        "Developed RESTful APIs in Python, improving system reliability.",
    )


def test_uploaded_resume_analysis_scores_extracted_text_and_job_keywords():
    text = """Sam Lee
sam@example.com
+1 555 222 3344
Professional Summary
Backend developer with Python and FastAPI experience.
Experience
- Built APIs with Python.
Education
Bachelor of Science
Skills
Python, FastAPI
"""
    result = analyze_resume_text(text, "Python FastAPI Docker")

    assert 0 <= result["analysis"]["score"] <= 100
    assert result["sections_found"]["experience"] is True
    assert result["sections_found"]["education"] is True
    assert result["word_count"] > 0
    assert result["match"]["matched_keywords"] == ["python", "fastapi"]
    assert "docker" in result["match"]["missing_keywords"]


def test_uploaded_resume_analysis_reports_missing_headings_and_short_text():
    result = analyze_resume_text("Sam Lee\nsam@example.com")

    assert result["analysis"]["score"] < 100
    assert result["sections_found"]["skills"] is False
    assert any("unusually short" in issue["message"] for issue in result["analysis"]["issues"])
