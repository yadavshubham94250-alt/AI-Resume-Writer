# AI Resume Writer

A local-first AI resume builder for creating, improving, targeting, reviewing, importing, and exporting resumes. It uses **Ollama only** for AI inference - no paid model API or cloud credential is needed.

## What it includes

- Editable resume workspace with a live, ATS-friendly preview and three presentation variants.
- Local Ollama-powered summary writing, bullet rewriting, and context-aware career chatbot.
- Transparent ATS heuristic scoring for structure, keyword coverage, readability, and impact.
- Job-description keyword matching that clearly distinguishes matched and missing terms.
- PDF/DOCX upload in ATS Insights with readable-text extraction, section checks, a transparent heuristic score, and optional job-keyword comparison. Uploaded documents are analyzed in memory and are not saved.
- PDF/DOCX text import with review-first extraction, plus controlled ATS-friendly PDF export.
- SQLite persistence, health checks, local-AI availability messaging, safe uploads, and no raw resume/chat logging.

## Architecture

```
frontend/                 React + TypeScript + Vite + Tailwind CSS
  src/components/         Editor-supporting UI components and live preview
backend/app/
  main.py                 HTTP API and endpoint wiring
  schemas.py              Typed resume domain models
  repository.py           SQLite persistence
  services/ollama.py      Local-only provider boundary
  services/ai.py          Grounded prompts and resilient AI calls
  services/analysis.py    Inspectable ATS/job-match heuristics
  services/documents.py   PDF/DOCX extraction and ReportLab PDF export
backend/tests/            API and heuristic tests
```

The frontend calls FastAPI. FastAPI stores resume data in local SQLite and asks Ollama at `localhost:11434` only when the user invokes an AI feature. The deterministic ATS and keyword analyzers remain available even if Ollama is not installed.

## Run locally

Prerequisites: Python 3.11+, Node 20+, and [Ollama](https://ollama.com/).

```bash
# from the repository root
if (!(Test-Path backend\.env)) { Copy-Item .env.example backend\.env }
ollama pull qwen2.5:3b
```

Start Ollama in its own terminal:

```bash
ollama serve
```

Start the backend in another terminal:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The backend API documentation is available at `http://localhost:8001/docs`. The frontend defaults to `http://localhost:8001/api`; override it with `VITE_API_URL` in `frontend/.env.local` if needed.

## Tests

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests -q

cd ..\frontend
npm test
npm run build
```

## API

- `POST /api/resumes`, `GET/PUT /api/resumes/{id}` - local resume persistence
- `POST /api/ai/summary`, `/rewrite-bullet`, `/tailor`, `/analyze` - local AI and transparent analysis
- `POST /api/chat` and `/api/chat/stream` - resume- and job-description-aware local chat (JSON or SSE)
- `POST /api/import` - PDF/DOCX extraction, returning a reviewable draft
- `GET /api/export/{id}/pdf` - ATS-friendly PDF download
- `GET /api/health` - backend and Ollama status

## Privacy and limitations

This project deliberately has no fallback to hosted AI. Keep Ollama on your machine and review all generated content before use. The ATS score is a visible heuristic, not a prediction or hiring guarantee. PDF extraction may lose layout or miss complex scanned documents; the import response always asks users to review and correct fields.

## GitHub hygiene

`.gitignore` excludes `.env`, local databases, uploads, exports, test artifacts, and private resume data. Never commit real resumes, API keys, or credentials.
