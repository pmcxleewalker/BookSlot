"""Minimal LLM client for the AI receptionist. Talks to OpenAI or Anthropic directly
over HTTPS (no vendor SDK or third-party proxy needed)."""
import json
import logging
import re
from typing import Any, Dict, List

import httpx

from . import config

logger = logging.getLogger("bookslot.ai")


class AIError(Exception):
    pass


async def chat_json(system_prompt: str, messages: List[Dict[str, str]], max_tokens: int = 700) -> Dict[str, Any]:
    """Send a conversation and return the model's reply parsed as a JSON object.

    messages: [{"role": "user"|"assistant", "content": "..."}]
    """
    if not config.AI_ENABLED:
        raise AIError("AI receptionist is not configured")

    async with httpx.AsyncClient(timeout=45) as client:
        if config.AI_PROVIDER == "openai":
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"},
                json={
                    "model": config.AI_MODEL,
                    "messages": [{"role": "system", "content": system_prompt}, *messages],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                    "max_tokens": max_tokens,
                },
            )
            if resp.status_code >= 400:
                raise AIError(f"OpenAI error {resp.status_code}: {resp.text[:300]}")
            text = resp.json()["choices"][0]["message"]["content"]
        elif config.AI_PROVIDER == "anthropic":
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": config.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": config.AI_MODEL,
                    "system": system_prompt + "\n\nReply with a single JSON object only, no other text.",
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
            )
            if resp.status_code >= 400:
                raise AIError(f"Anthropic error {resp.status_code}: {resp.text[:300]}")
            parts = resp.json().get("content", [])
            text = "".join(p.get("text", "") for p in parts if p.get("type") == "text")
        else:
            raise AIError(f"Unknown AI_PROVIDER '{config.AI_PROVIDER}'")

    return parse_json_reply(text)


def parse_json_reply(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        match = re.search(r"\{[\s\S]*\}", text or "")
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {"reply": (text or "").strip(), "action": "none"}
