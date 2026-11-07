from typing import Literal

from pydantic import BaseModel


class RootResponse(BaseModel):
    application: str
    version: str
    status: Literal["running"] = "running"
    docs_url: str
    health_url: str


class HealthResponse(BaseModel):
    status: Literal["healthy"]
    application: str
    database: Literal["connected"]


class ReadinessResponse(BaseModel):
    status: Literal["ready"]
    application: str
    database: Literal["connected"]
