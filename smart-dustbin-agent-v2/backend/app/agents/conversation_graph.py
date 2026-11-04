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

def speakable(text: str) -> str:
    """Strip markdown and exotic Unicode that text-to-speech and consoles handle badly."""
    text = re.sub(r"[*_`#]+", "", text)
    for dash in ("‑", "–", "—"):
        text = text.replace(dash, "-")
    # Narrow/non-breaking spaces appear in model output and break cp1252 terminals.
    text = re.sub(r"[     ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def phrase_with_llm(question: str, verified: str) -> str:
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
        prompt = (
            "Answer the user's smart dustbin question using ONLY the supplied verified data. "
            "Do not invent bin readings. Keep it to one or two short sentences of plain "
            "spoken English, with no markdown, lists or symbols.\n"
            f"Question: {question}\nVerified result: {verified}"
        )
        reply = llm.invoke([
            SystemMessage(content="You are a smart dustbin voice assistant."),
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
        question = state.get("question", "").lower()
        bins = state.get("tool_result", [])
        if "offline" in question or "sensor" in question:
            offline = [b for b in bins if not b.get("online", True) or not b.get("sensor_ok", True)]
            answer = "No offline sensors found." if not offline else "Offline or unhealthy sensors: " + ", ".join(
                f"{b['bin_id']} ({b.get('location','')})" for b in offline
            )
        elif any(k in question for k in ["more than", "above", "over", "full", "collect", "80"]):
            full = [b for b in bins if float(b.get("fill", 0)) >= 80]
            answer = "No bins are currently at or above 80%." if not full else (
                f"{len(full)} bin(s) are at or above 80%: " + "; ".join(
                    f"{b['bin_id']} at {b.get('location','')} is {b['fill']}% full" for b in full
                )
            )
        else:
            answer = "I can check bin fill levels, bins needing collection, fleet status, and sensor health. What would you like to know?"
        if settings.groq_api_key:
            answer = phrase_with_llm(state.get("question", ""), answer)
        return {"answer": answer}

    graph = StateGraph(ConversationState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("respond", respond)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "respond")
    graph.add_edge("respond", END)
    return graph.compile()

conversation_graph = build_conversation_graph()
