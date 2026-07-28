from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import activities, analytics, deals, documents, milestones, stages, tasks, team, users

app = FastAPI(
    title="Pipeline Manager API",
    description="Real estate deal pipeline: deals, stages, tasks, milestones and reporting.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
for module in (users, stages, deals, tasks, milestones, documents, activities, team, analytics):
    api.include_router(module.router)
app.include_router(api)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
