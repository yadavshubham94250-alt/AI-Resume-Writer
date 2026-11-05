import re
from collections import Counter
from ..schemas import ResumeContent

STOP_WORDS = {"a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "of", "on", "or", "the", "to", "with", "you", "your", "will", "our", "we", "this", "that", "have", "has", "years", "work", "role", "team", "experience"}
ACTION_VERBS = {"built", "created", "delivered", "designed", "developed", "drove", "improved", "increased", "launched", "led", "managed", "optimized", "reduced", "shipped", "supported", "implemented", "automated", "analyzed"}


def resume_text(content: ResumeContent) -> str:
    values = [content.summary, *content.skills, *content.certifications, *content.achievements]
    for item in content.experience:
        values.extend([item.company, item.role, *item.bullets, *item.technologies])
    for item in content.projects:
        values.extend([item.name, item.description, *item.bullets, *item.technologies])
    return " ".join(values).lower()


def keywords(text: str, limit: int = 25) -> list[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.\-]{1,}", text.lower())
    counts = Counter(token for token in tokens if token not in STOP_WORDS and len(token) > 1)
    return [word for word, _ in counts.most_common(limit)]


def analyze_job_match(content: ResumeContent, job_description: str) -> dict:
    wanted = keywords(job_description)
    corpus = resume_text(content)
    matched = [term for term in wanted if term in corpus]
    missing = [term for term in wanted if term not in corpus]
    coverage = round(100 * len(matched) / max(len(wanted), 1))
    return {"keywords": wanted, "matched_keywords": matched, "missing_keywords": missing,
            "coverage": coverage,
            "suggestions": ([f"Only add '{term}' if it reflects work you actually performed." for term in missing[:4]])}


def ats_analysis(content: ResumeContent, job_description: str = "") -> dict:
    issues: list[dict[str, str]] = []
    contact = content.contact
    if not contact.name or contact.name == "Your Name":
        issues.append({"category": "Completeness", "message": "Add your full name."})
    if not contact.email:
        issues.append({"category": "Completeness", "message": "Add a professional email address."})
    if not content.summary:
        issues.append({"category": "Structure", "message": "Add a concise, fact-based professional summary."})
    if not content.skills:
        issues.append({"category": "Keywords", "message": "List relevant technical and professional skills."})
    bullets = [bullet for item in content.experience for bullet in item.bullets]
    long_bullets = [bullet for bullet in bullets if len(bullet.split()) > 35]
    weak_bullets = [bullet for bullet in bullets if bullet and bullet.split()[0].lower().strip(".,") not in ACTION_VERBS]
    if long_bullets:
        issues.append({"category": "Readability", "message": "Shorten bullets over 35 words for faster scanning."})
    if weak_bullets:
        issues.append({"category": "Impact", "message": "Start experience bullets with a clear action verb where accurate."})
    structure = max(0, 100 - sum(issue["category"] in {"Structure", "Completeness"} for issue in issues) * 15)
    readability = max(0, 100 - len(long_bullets) * 12)
    impact = max(0, 100 - len(weak_bullets) * 7)
    keyword_score = analyze_job_match(content, job_description)["coverage"] if job_description else (80 if content.skills else 35)
    breakdown = {"structure": structure, "keyword_coverage": keyword_score, "readability": readability, "impact": impact}
    score = round(sum(breakdown.values()) / len(breakdown))
    return {"score": score, "breakdown": breakdown, "issues": issues,
            "disclaimer": "This is a transparent heuristic, not a guarantee of ATS acceptance or an interview."}


SECTION_PATTERNS = {
    "summary": re.compile(r"^(professional\s+)?(summary|profile|objective)$", re.I),
    "experience": re.compile(r"^(professional\s+)?(experience|employment|work\s+history)$", re.I),
    "education": re.compile(r"^(education|academic\s+background)$", re.I),
    "skills": re.compile(r"^(technical\s+)?skills|^(core\s+)?competencies$", re.I),
    "projects": re.compile(r"^(selected\s+)?projects$", re.I),
    "certifications": re.compile(r"^(certifications?|licenses?)$", re.I),
}


def analyze_resume_text(text: str, job_description: str = "") -> dict:
    """Assess text extracted from a user-provided PDF/DOCX without saving it."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    normalized = "\n".join(lines)
    lowered = normalized.lower()
    sections_found = {
        name: any(pattern.fullmatch(re.sub(r"[:\s]+$", "", line)) for line in lines)
        for name, pattern in SECTION_PATTERNS.items()
    }
    email_found = bool(re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", normalized))
    phone_found = bool(re.search(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)", normalized))
    first_line = lines[0] if lines else ""
    name_found = bool(first_line and len(first_line.split()) <= 6 and not any(
        pattern.fullmatch(re.sub(r"[:\s]+$", "", first_line)) for pattern in SECTION_PATTERNS.values()
    ))
    issues: list[dict[str, str]] = []
    if not name_found:
        issues.append({"category": "Contact", "message": "Add your name near the top of the resume."})
    if not email_found:
        issues.append({"category": "Contact", "message": "Add a clearly formatted email address."})
    if not phone_found:
        issues.append({"category": "Contact", "message": "Consider adding a phone number for recruiter contact."})
    for section, label in (
        ("summary", "a summary or profile"),
        ("experience", "an experience section"),
        ("education", "an education section"),
        ("skills", "a clearly labeled skills section"),
    ):
        if not sections_found[section]:
            issues.append({"category": "Structure", "message": f"Add {label} with a clear heading so ATS tools can identify it."})

    words = re.findall(r"\b[\w+#.-]+\b", lowered)
    word_count = len(words)
    if word_count < 80:
        issues.append({"category": "Completeness", "message": "The extracted resume is unusually short. Check that all PDF text was readable and include relevant detail."})
    long_lines = [line for line in lines if len(line.split()) > 40]
    if long_lines:
        issues.append({"category": "Readability", "message": "Break up long text blocks into concise, scannable bullets."})
    bullet_lines = [
        line for line in lines
        if re.match(r"^(?:[-*•▪◦]\s+|\d+[.)]\s+)", line)
    ]
    action_bullets = [
        line for line in bullet_lines
        if re.sub(r"^(?:[-*•▪◦]\s+|\d+[.)]\s+)", "", line).split()
        and re.sub(r"^(?:[-*•▪◦]\s+|\d+[.)]\s+)", "", line).split()[0].lower().strip(".,:;")
        in ACTION_VERBS
    ]
    if sections_found["experience"] and bullet_lines and len(action_bullets) < len(bullet_lines) / 2:
        issues.append({"category": "Impact", "message": "Lead more experience bullets with clear action verbs when they accurately describe your work."})
    if sections_found["experience"] and not bullet_lines:
        issues.append({"category": "Impact", "message": "Use concise bullet points to make experience and achievements easier to scan."})

    structure = max(
        0,
        100
        - (15 if not name_found else 0)
        - (15 if not email_found else 0)
        - sum(not sections_found[section] for section in ("experience", "education", "skills")) * 12
        - (8 if not sections_found["summary"] else 0),
    )
    readability = max(
        0,
        100 - min(len(long_lines) * 12, 48) - (20 if word_count < 80 else 0),
    )
    impact = (
        round(100 * len(action_bullets) / len(bullet_lines))
        if bullet_lines
        else (45 if sections_found["experience"] else 55)
    )
    if not sections_found["skills"]:
        keyword_score = 40
    elif job_description.strip():
        resume_terms = set(keywords(normalized, limit=200))
        wanted = keywords(job_description)
        keyword_score = round(100 * sum(term in resume_terms for term in wanted) / max(len(wanted), 1))
    else:
        keyword_score = 75

    breakdown = {
        "structure": structure,
        "keyword_coverage": keyword_score,
        "readability": readability,
        "impact": impact,
    }
    match = analyze_job_match(ResumeContent(summary=normalized), job_description) if job_description.strip() else None
    return {
        "analysis": {
            "score": round(sum(breakdown.values()) / len(breakdown)),
            "breakdown": breakdown,
            "issues": issues,
            "disclaimer": (
                "This transparent heuristic reviews extracted text and formatting signals; ATS vendors differ, "
                "and this is not a guarantee of ATS acceptance or an interview."
            ),
        },
        "match": match,
        "sections_found": sections_found,
        "word_count": word_count,
        "extracted_text": normalized,
    }
