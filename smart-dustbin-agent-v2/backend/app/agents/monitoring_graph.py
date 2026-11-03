from typing import TypedDict
from langgraph.graph import StateGraph, END

class AlertState(TypedDict, total=False):
    bin_id: str
    location: str
    fill: float
    severity: str
    message: str

def build_monitoring_graph():
    def compose(state: AlertState):
        state["message"] = (
            f"{state.get('bin_id')} at {state.get('location') or 'unknown location'} "
            f"is {state.get('fill')}% full. Severity: {state.get('severity')}. "
            "Please arrange collection."
        )
        return state
    graph = StateGraph(AlertState)
    graph.add_node("compose_notification", compose)
    graph.set_entry_point("compose_notification")
    graph.add_edge("compose_notification", END)
    return graph.compile()

monitoring_graph = build_monitoring_graph()
