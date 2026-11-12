import logging, re
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from ..config import settings

log = logging.getLogger(__name__)

class ConversationState(TypedDict, total=False):
    question: str
    answer: str
    bins: list[dict]
    tool_result: Any
    context: str
    lang: str

def speakable(text: str) -> str:
    """Strip markdown and exotic Unicode that text-to-speech and consoles handle badly."""
    text = re.sub(r"[*_`#]+", "", text)
    for dash in ("‑", "–", "—"):
        text = text.replace(dash, "-")
    # Narrow/non-breaking spaces appear in model output and break cp1252 terminals.
    text = re.sub(r"[     ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def verified_answer(question: str, bins: list[dict]) -> str:
    """Compute the answer from database rows. This is the source of truth."""
    q = (question or "").lower()
    if "offline" in q or "sensor" in q:
        offline = [b for b in bins if not b.get("online", True) or not b.get("sensor_ok", True)]
        return "No offline sensors found." if not offline else "Offline or unhealthy sensors: " + ", ".join(
            f"{b['bin_id']} ({b.get('location','')})" for b in offline
        )
    if any(k in q for k in ["collected", "emptied", "done", "cleared"]):
        return ("Thank you. Please confirm the collection on the dashboard so the bin "
                "is reset and the alert is closed.")
    if any(k in q for k in ["more than", "above", "over", "full", "collect", "80"]):
        full = [b for b in bins if float(b.get("fill", 0)) >= 80]
        return "No bins are currently at or above 80%." if not full else (
            f"{len(full)} bin(s) are at or above 80%: " + "; ".join(
                f"{b['bin_id']} at {b.get('location','')} is {b['fill']}% full" for b in full
            )
        )
    return ("I can check bin fill levels, bins needing collection, fleet status, "
            "and sensor health. What would you like to know?")

# Languages the assistant can reply in. The verified answer is always computed
# in English; `lang` only changes the wording the model produces from it.
LANGUAGES = {
    "en": "English",
    "te": "Telugu (తెలుగు script, not transliteration)",
}

def answer_question(question: str, bins: list[dict], context: str = "", lang: str = "en") -> str:
    """Answer one turn. `context` names the bin a call is about, if any."""
    answer = verified_answer(question, bins)
    if settings.groq_api_key:
        answer = phrase_with_llm(question, answer, context, lang)
    return answer

def phrase_with_llm(question: str, verified: str, context: str = "", lang: str = "en") -> str:
    """Reword the verified answer. Returns `verified` unchanged on any failure.

    The deterministic answer is the source of truth: the model only rephrases it,
    and is never allowed to replace it with empty or unusable output.
    """
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage, HumanMessage
        llm = ChatGroq(
            model=settings.groq_chat_model,
            temperature=0,
            api_key=settings.groq_api_key,
            max_tokens=settings.groq_max_tokens,
            reasoning_effort=settings.groq_reasoning_effort,
        )
        language = LANGUAGES.get(lang, LANGUAGES["en"])
        prompt = (
            "Answer the user's smart dustbin question using ONLY the supplied verified data. "
            "Do not invent bin readings. Keep it to one or two short sentences of plain "
            f"spoken {language}, with no markdown, lists or symbols. "
            # Bin ids and zone names are painted on the bins in Latin script, so
            # transliterating them would stop the crew recognising which bin it is.
            "Keep bin identifiers and place names exactly as given, in their original script.\n"
            + (f"Call context: {context}\n" if context else "")
            + f"Question: {question}\nVerified result: {verified}"
        )
        persona = ("You are a smart dustbin voice assistant speaking on a phone call to "
                   "cleaning staff. Be brief, polite and natural."
                   if context else "You are a smart dustbin voice assistant.")
        persona += f" Always reply in {language}."
        reply = llm.invoke([
            SystemMessage(content=persona),
            HumanMessage(content=prompt),
        ])
        # A reasoning model can exhaust its token budget before emitting content.
        spoken = speakable(reply.content or "")
        if not spoken:
            log.warning("Groq returned no content; using the verified answer verbatim.")
            return verified
        return spoken
    except Exception:
        log.warning("Groq phrasing failed; using the verified answer verbatim.", exc_info=True)
        return verified

def build_conversation_graph():
    def retrieve(state: ConversationState):
        # The API layer supplies actual database results before invoking the graph.
        return {"tool_result": state.get("bins", [])}

    def respond(state: ConversationState):
        answer = verified_answer(state.get("question", ""), state.get("tool_result", []))
        if settings.groq_api_key:
            answer = phrase_with_llm(state.get("question", ""), answer,
                                     state.get("context", ""), state.get("lang", "en"))
        return {"answer": answer}

    graph = StateGraph(ConversationState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("respond", respond)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "respond")
    graph.add_edge("respond", END)
    return graph.compile()

conversation_graph = build_conversation_graph()
