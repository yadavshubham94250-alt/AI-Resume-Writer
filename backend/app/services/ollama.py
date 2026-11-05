import httpx
from ..config import settings
from ..schemas import ProviderStatus


class OllamaProvider:
    """Local-only Ollama adapter. No hosted fallback is used."""
    async def status(self) -> ProviderStatus:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags")
                response.raise_for_status()
            models = response.json().get("models", [])
            if not isinstance(models, list):
                raise ValueError("Invalid Ollama model list")
            model_names = {str(model.get("name", "")) for model in models if isinstance(model, dict)}
            if settings.ollama_model not in model_names:
                return ProviderStatus(
                    provider="ollama",
                    available=False,
                    model=settings.ollama_model,
                    detail=f"Model {settings.ollama_model} is not installed. Run `ollama pull {settings.ollama_model}`.",
                )
            return ProviderStatus(
                provider="ollama",
                available=True,
                model=settings.ollama_model,
                detail="Local Ollama and the configured model are ready.",
            )
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            return ProviderStatus(provider="ollama", available=False, model=settings.ollama_model,
                                  detail="Ollama is unavailable. Start Ollama locally to enable AI features.")


ollama_provider = OllamaProvider()
