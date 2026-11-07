from fastapi import APIRouter, Request

from app.schemas.ai import NarrateRequest, NarrateResponse
from app.services import ai as svc

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/narrate", response_model=NarrateResponse, summary="Explain an already-computed result in plain language")
def narrate(body: NarrateRequest, request: Request) -> NarrateResponse:
    return NarrateResponse(answer=svc.narrate(request.app.state.settings, body))
