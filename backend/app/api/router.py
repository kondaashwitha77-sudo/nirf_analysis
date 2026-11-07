"""Aggregates every route module. Add new routers here as phases are built."""

from fastapi import APIRouter

from app.api.routes import ai, health, rankings

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(rankings.router)
api_router.include_router(ai.router)
