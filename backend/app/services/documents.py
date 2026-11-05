import io
import re
from xml.sax.saxutils import escape
from fastapi import HTTPException, UploadFile
from docx import Document
import fitz
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from ..schemas import Resume


async def extract_text(upload: UploadFile, max_bytes: int) -> str:
    name = (upload.filename or "").lower()
    allowed = name.endswith(".pdf") or name.endswith(".docx")
    if not allowed:
        raise HTTPException(status_code=415, detail="Upload a PDF or DOCX resume.")
    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="The uploaded file is too large.")
    try:
        if name.endswith(".pdf"):
            with fitz.open(stream=data, filetype="pdf") as pdf:
                return "\n".join(page.get_text() for page in pdf)
        document = Document(io.BytesIO(data))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        table_rows = [
            " | ".join(cell.text for cell in row.cells)
            for table in document.tables
            for row in table.rows
        ]
        return "\n".join([*paragraphs, *table_rows])
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The document could not be parsed. Please paste or correct the extracted text.") from exc


def draft_from_text(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email = next((line for line in lines if re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", line)), "")
    phone = next((line for line in lines if re.search(r"\+?[\d()\-\s]{8,}", line)), "")
    return {"extracted_text": text, "draft": {"contact": {"name": lines[0] if lines else "Your Name", "email": email, "phone": phone},
            "summary": "", "experience": [], "education": [], "projects": [], "skills": [], "certifications": [], "achievements": []},
            "warning": "Extraction is a starting point. Review every field before saving; no facts are inferred."}


def resume_pdf(resume: Resume) -> bytes:
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=letter, rightMargin=.7*inch, leftMargin=.7*inch, topMargin=.55*inch, bottomMargin=.55*inch)
    styles = getSampleStyleSheet(); normal = styles["BodyText"]; normal.leading = 14
    safe = lambda value: escape(str(value or ""))
    story = [Paragraph(safe(resume.content.contact.name or "Your Name"), styles["Title"])]
    contact = " | ".join(x for x in [resume.content.contact.email, resume.content.contact.phone, resume.content.contact.location] if x)
    if contact: story += [Paragraph(safe(contact), normal), Spacer(1, 8)]
    def heading(label: str): story.extend([Spacer(1, 7), Paragraph(label.upper(), styles["Heading2"])])
    if resume.content.summary: heading("Profile"); story.append(Paragraph(safe(resume.content.summary), normal))
    if resume.content.experience:
        heading("Experience")
        for item in resume.content.experience:
            story.append(Paragraph(f"<b>{safe(item.role)}</b> - {safe(item.company)}", normal))
            story.append(Paragraph(safe(" | ".join(x for x in [item.location, f"{item.start_date} - {item.end_date}"] if x)), normal))
            if item.bullets:
                story.append(ListFlowable([ListItem(Paragraph(safe(bullet), normal)) for bullet in item.bullets], bulletType="bullet"))
    if resume.content.projects:
        heading("Projects")
        for project in resume.content.projects:
            story.append(Paragraph(f"<b>{safe(project.name)}</b> - {safe(project.description)}", normal))
            if project.bullets:
                story.append(ListFlowable([ListItem(Paragraph(safe(bullet), normal)) for bullet in project.bullets], bulletType="bullet"))
    if resume.content.education:
        heading("Education")
        for item in resume.content.education: story.append(Paragraph(f"<b>{safe(item.degree)}</b>, {safe(item.institution)} ({safe(item.start_date)} - {safe(item.end_date)})", normal))
    if resume.content.skills: heading("Skills"); story.append(Paragraph(safe(", ".join(resume.content.skills)), normal))
    if resume.content.certifications: heading("Certifications"); story.append(Paragraph(safe(", ".join(resume.content.certifications)), normal))
    doc.build(story); return output.getvalue()
