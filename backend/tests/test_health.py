from fastapi.testclient import TestClient
from app.main import app


def test_health_reports_local_ai_status():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["ai"]["provider"] == "ollama"
