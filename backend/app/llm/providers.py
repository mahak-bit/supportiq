"""Model-provider abstraction. Application code only depends on `LLMProvider`; swapping
Gemini for Ollama (or adding another vendor) does not touch generation or agent logic."""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import get_settings

log = logging.getLogger("supportiq.llm")
T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Raised when the model fails after retries. Message is safe to show to users."""


class LLMProvider(ABC):
    name: str
    model: str
    is_llm: bool = True

    @abstractmethod
    def _generate(self, system: str, prompt: str, schema: type[T]) -> T: ...

    def generate_structured(self, system: str, prompt: str, schema: type[T]) -> T:
        """Bounded retries on transient failures and on schema-invalid output."""
        settings = get_settings()
        last: Exception | None = None
        for attempt in range(settings.llm_max_retries + 1):
            try:
                return self._generate(system, prompt, schema)
            except (ValidationError, ValueError) as exc:
                last = exc
                log.warning("%s returned invalid structured output (attempt %s)", self.name, attempt + 1)
            except Exception as exc:  # noqa: BLE001 - provider SDKs raise many types
                last = exc
                log.warning("%s call failed (attempt %s): %s", self.name, attempt + 1, type(exc).__name__)
            time.sleep(min(0.5 * 2**attempt, 4))
        raise LLMError(f"{self.name} did not return a valid response after {settings.llm_max_retries + 1} attempts") from last


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model: str, timeout_s: float):
        from google import genai
        from google.genai import types

        self.name, self.model = "gemini", model
        self._types = types
        self._client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000)))

    def _generate(self, system: str, prompt: str, schema: type[T]) -> T:
        resp = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self._types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.2,
            ),
        )
        if isinstance(resp.parsed, schema):
            return resp.parsed
        if not resp.text:
            raise ValueError("empty response")
        return schema.model_validate_json(resp.text)


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str, model: str, timeout_s: float):
        self.name, self.model = "ollama", model
        self._url = base_url.rstrip("/")
        self._timeout = timeout_s

    def _generate(self, system: str, prompt: str, schema: type[T]) -> T:
        r = httpx.post(
            f"{self._url}/api/chat",
            json={
                "model": self.model,
                "stream": False,
                "format": schema.model_json_schema(),
                "options": {"temperature": 0.2},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            },
            timeout=self._timeout,
        )
        r.raise_for_status()
        return schema.model_validate_json(r.json()["message"]["content"])


class ExtractiveProvider(LLMProvider):
    """Not a language model. Selected when no LLM is configured: callers detect `is_llm=False`
    and use deterministic, evidence-quoting code paths. Labelled as such in the UI."""

    name, model, is_llm = "extractive", "no-llm (evidence quoting + rules)", False

    def _generate(self, system: str, prompt: str, schema: type[T]) -> T:  # pragma: no cover
        raise LLMError("Extractive mode cannot generate free text")


_ollama_probe: tuple[float, bool] = (0.0, False)


def ollama_reachable() -> bool:
    global _ollama_probe
    checked, ok = _ollama_probe
    if time.monotonic() - checked < 60:
        return ok
    try:
        ok = httpx.get(f"{get_settings().ollama_base_url.rstrip('/')}/api/tags", timeout=1.0).status_code == 200
    except httpx.HTTPError:
        ok = False
    _ollama_probe = (time.monotonic(), ok)
    return ok


_override: LLMProvider | None = None


def set_provider_override(provider: LLMProvider | None) -> None:
    """Test hook: inject a provider (e.g. a scripted fake) without touching configuration."""
    global _override
    _override = provider


def get_llm() -> LLMProvider:
    if _override is not None:
        return _override
    s = get_settings()
    choice = s.llm_provider
    if choice == "auto":
        if s.gemini_api_key:
            choice = "gemini"
        elif ollama_reachable():
            choice = "ollama"
        else:
            choice = "extractive"
    if choice == "gemini":
        if not s.gemini_api_key:
            raise LLMError("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set")
        return GeminiProvider(s.gemini_api_key, s.gemini_model, s.llm_timeout_seconds)
    if choice == "ollama":
        return OllamaProvider(s.ollama_base_url, s.ollama_model, s.llm_timeout_seconds)
    return ExtractiveProvider()
