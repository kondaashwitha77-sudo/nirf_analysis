from fastapi import APIRouter, Request

from app.schemas.ai import NarrateRequest, NarrateResponse, PlanRequest, PlanResponse
from app.services import ai as svc

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/narrate", response_model=NarrateResponse, summary="Explain an already-computed result in plain language")
def narrate(body: NarrateRequest, request: Request) -> NarrateResponse:
    return NarrateResponse(answer=svc.narrate(request.app.state.settings, body))


@router.post("/plan", response_model=PlanResponse, summary="Turn a free-form question into a JSON analysis plan (the model never computes numbers)")
def plan(body: PlanRequest, request: Request) -> PlanResponse:
    return PlanResponse(plan=svc.plan(request.app.state.settings, body))
