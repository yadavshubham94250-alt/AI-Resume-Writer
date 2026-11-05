import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from .config import settings
from .schemas import Resume, ResumeCreate


class ResumeRepository:
    def __init__(self) -> None:
        self.path: Path = settings.database_path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS resumes (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, target_role TEXT NOT NULL,
                template TEXT NOT NULL, content TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            )""")

    def create(self, payload: ResumeCreate) -> Resume:
        now = datetime.now(timezone.utc)
        resume = Resume(id=str(uuid4()), created_at=now, updated_at=now, **payload.model_dump())
        self._write(resume)
        return resume

    def get(self, resume_id: str) -> Resume | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM resumes WHERE id = ?", (resume_id,)).fetchone()
        return self._row_to_resume(row) if row else None

    def list(self) -> list[Resume]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT * FROM resumes ORDER BY updated_at DESC, created_at DESC"
            ).fetchall()
        return [self._row_to_resume(row) for row in rows]

    def update(self, resume_id: str, payload: ResumeCreate) -> Resume | None:
        existing = self.get(resume_id)
        if not existing:
            return None
        resume = Resume(id=resume_id, created_at=existing.created_at,
                        updated_at=datetime.now(timezone.utc), **payload.model_dump())
        self._write(resume)
        return resume

    def _write(self, resume: Resume) -> None:
        values = resume.model_dump(mode="json")
        with self._connect() as db:
            db.execute("""INSERT OR REPLACE INTO resumes
                (id,title,target_role,template,content,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)""", (values["id"], values["title"], values["target_role"],
                values["template"], json.dumps(values["content"]), values["created_at"], values["updated_at"]))

    @staticmethod
    def _row_to_resume(row: sqlite3.Row) -> Resume:
        return Resume(id=row["id"], title=row["title"], target_role=row["target_role"],
                      template=row["template"], content=json.loads(row["content"]),
                      created_at=row["created_at"], updated_at=row["updated_at"])


repository = ResumeRepository()
