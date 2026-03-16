"""
ai.py — Kostenlose AI Fallback-Kette
Groq (Llama 3.3) → Google Gemini Flash → Mistral Small
"""

import os
import logging
import requests
from character import TRALALERITO_SYSTEM_PROMPT

log = logging.getLogger(__name__)

GROQ_API_KEY    = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

MAX_TOKENS = 300
TEMPERATURE = 0.92  # Etwas höher = kreativer / chaotischer (passt zu Tralalerito)


def _groq(prompt: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": TRALALERITO_SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                "max_tokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
            },
            timeout=15,
        )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"].strip()
        log.info("✅ AI: Groq")
        return text
    except Exception as e:
        log.warning(f"Groq fehlgeschlagen: {e}")
        return None


def _gemini(prompt: str) -> str | None:
    if not GEMINI_API_KEY:
        return None
    try:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/"
            f"models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        )
        # Gemini hat kein System-Prompt Feld → in User-Prompt einbauen
        full_prompt = f"{TRALALERITO_SYSTEM_PROMPT}\n\n---\n\n{prompt}"
        r = requests.post(
            url,
            json={"contents": [{"parts": [{"text": full_prompt}]}],
                  "generationConfig": {"maxOutputTokens": MAX_TOKENS, "temperature": TEMPERATURE}},
            timeout=15,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        log.info("✅ AI: Gemini")
        return text
    except Exception as e:
        log.warning(f"Gemini fehlgeschlagen: {e}")
        return None


def _mistral(prompt: str) -> str | None:
    if not MISTRAL_API_KEY:
        return None
    try:
        r = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
            json={
                "model": "mistral-small-latest",
                "messages": [
                    {"role": "system", "content": TRALALERITO_SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                "max_tokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
            },
            timeout=15,
        )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"].strip()
        log.info("✅ AI: Mistral")
        return text
    except Exception as e:
        log.warning(f"Mistral fehlgeschlagen: {e}")
        return None


def generate(prompt: str) -> str | None:
    """Versucht Groq → Gemini → Mistral. Gibt None zurück wenn alle versagen."""
    for fn in [_groq, _gemini, _mistral]:
        result = fn(prompt)
        if result:
            # Sicherheitscheck: Strip Anführungszeichen die manche AIs hinzufügen
            result = result.strip('"').strip("'")
            return result
    log.error("❌ Alle AI APIs fehlgeschlagen")
    return None
