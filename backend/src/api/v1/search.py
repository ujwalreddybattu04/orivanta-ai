"""
Search endpoints — POST /search (streaming SSE)
"""

from pydantic import BaseModel
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.services.search_orchestrator import search_orchestrator

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    focus_mode: str = "all"

@router.post("/stream")
async def search_stream(request: SearchRequest):
    """Submit a search query and receive a streaming AI-generated answer with citations."""
    return StreamingResponse(
        search_orchestrator.stream_search(request.query, request.focus_mode),
        media_type="text/event-stream"
    )

@router.post("/suggestions")
async def search_suggestions(query: str = ""):
    """Get auto-complete search suggestions."""
    # TODO: Implement suggestion engine
    return []
