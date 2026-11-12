"""Server-side speech synthesis, so Telugu audio does not depend on the client.

The browser's `speechSynthesis` can only speak languages the operating system
has a voice for, and desktop Windows and Linux usually ship none for Telugu —
the agent would show Telugu text and then say nothing. Rendering audio here
gives every client real Telugu speech.

Engines are tried in order, best first:

  1. sarvam    — Sarvam AI `bulbul`. Built for Indian languages, so Telugu
                 sounds markedly better. Needs SARVAM_API_KEY. Returns WAV.
  2. edge-tts  — Microsoft Edge neural voices. Free, keyless. Returns MP3.
  3. gtts      — Google Translate TTS. Plainer, but an independent provider.

All three call a third party, so one failing must not silence the agent.
"""
import asyncio, base64, hashlib, logging
from collections import OrderedDict
import httpx
from ..config import settings

log = logging.getLogger(__name__)

# Edge voices, used when Sarvam is not configured.
VOICES = {"te": "te-IN-ShrutiNeural", "en": "en-IN-NeerjaNeural"}
FALLBACK_LANG = "en"

# Sarvam wants a full BCP-47 tag.
SARVAM_LANGS = {"te": "te-IN", "en": "en-IN"}
SARVAM_URL = "https://api.sarvam.ai/text-to-speech"

# Engines emit different containers, so the HTTP layer must be told which.
MIME = {"sarvam": "audio/wav", "edge-tts": "audio/mpeg", "gtts": "audio/mpeg"}

# Alert lines repeat constantly, so a small LRU keeps latency near zero and
# avoids re-synthesising identical audio.
_CACHE: "OrderedDict[str, tuple[bytes, str]]" = OrderedDict()
_CACHE_MAX = 64
_lock = asyncio.Lock()

def _has(module: str) -> bool:
    try:
        __import__(module)
        return True
    except ImportError:
        return False

def providers() -> list[str]:
    """Usable engines, best first."""
    found = []
    if settings.sarvam_api_key:
        found.append("sarvam")
    if _has("edge_tts"):
        found.append("edge-tts")
    if _has("gtts"):
        found.append("gtts")
    return found

def available() -> bool:
    return bool(providers())

def voice_for(lang: str) -> str:
    return VOICES.get(lang, VOICES[FALLBACK_LANG])

def _key(text: str, scope: str) -> str:
    return hashlib.sha256(f"{scope}|{text}".encode("utf-8")).hexdigest()

async def _sarvam(text: str, lang: str) -> bytes:
    """Sarvam AI bulbul. The API answers with base64-encoded WAV inside JSON."""
    payload = {
        "text": text,
        "target_language_code": SARVAM_LANGS.get(lang, SARVAM_LANGS[FALLBACK_LANG]),
        "speaker": settings.sarvam_speaker,
        "model": settings.sarvam_model,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(SARVAM_URL,
                              headers={"api-subscription-key": settings.sarvam_api_key},
                              json=payload)
    if r.status_code != 200:
        # Surface the upstream message: it names invalid speakers and dead models.
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    clips = r.json().get("audios") or []
    if not clips:
        raise RuntimeError("no audio in response")
    return base64.b64decode(clips[0])

async def _edge(text: str, lang: str) -> bytes:
    import edge_tts
    buffer = bytearray()
    async for chunk in edge_tts.Communicate(text, voice_for(lang)).stream():
        if chunk["type"] == "audio":
            buffer.extend(chunk["data"])
    return bytes(buffer)

async def _gtts(text: str, lang: str) -> bytes:
    from gtts import gTTS
    from io import BytesIO

    def render():
        buf = BytesIO()
        gTTS(text, lang=lang if lang in ("en", "te") else FALLBACK_LANG).write_to_fp(buf)
        return buf.getvalue()

    return await asyncio.to_thread(render)

_ENGINES = {"sarvam": _sarvam, "edge-tts": _edge, "gtts": _gtts}

async def synthesize(text: str, lang: str = "en") -> tuple[bytes, str]:
    """Return (audio, media_type), trying each engine in turn."""
    if not text or not text.strip():
        raise ValueError("Nothing to speak")
    engines = providers()
    if not engines:
        raise RuntimeError("No TTS engine available; set SARVAM_API_KEY or install edge-tts")

    # The speaker and engine order are part of the identity of the audio.
    key = _key(text, f"{lang}|{settings.sarvam_model}|{settings.sarvam_speaker}|{','.join(engines)}")
    async with _lock:
        cached = _CACHE.get(key)
        if cached is not None:
            _CACHE.move_to_end(key)
            return cached

    audio, used, errors = b"", None, []
    for name in engines:
        try:
            audio = await _ENGINES[name](text, lang)
            if audio:
                used = name
                break
            errors.append(f"{name}: returned no audio")
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            log.warning("TTS engine %s failed; trying the next one", name)
    if not audio:
        raise RuntimeError("; ".join(errors) or "all TTS engines failed")

    result = (audio, MIME.get(used, "audio/mpeg"))
    async with _lock:
        _CACHE[key] = result
        _CACHE.move_to_end(key)
        while len(_CACHE) > _CACHE_MAX:
            _CACHE.popitem(last=False)

    log.info("Synthesised %d bytes for %s via %s", len(audio), lang, used)
    return result

def state():
    found = providers()
    return {
        "available": bool(found),
        "providers": found,
        "primary": found[0] if found else None,
        "sarvam": {
            "configured": bool(settings.sarvam_api_key),
            "model": settings.sarvam_model,
            "speaker": settings.sarvam_speaker,
        },
        "edge_voices": VOICES,
        "cached_clips": len(_CACHE),
    }
