"""
nxdomain GUI — FastAPI backend

Run from repo root:
    uvicorn backend.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import state
from backend.routes import infrastructure, records, cache, benchmark, stress
from backend.sockets import lookup, connections


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if state.launcher_process and state.launcher_process.returncode is None:
        state.launcher_process.terminate()
        await state.launcher_process.wait()


app = FastAPI(title="nxdomain GUI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://nxdomain.pages.dev",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# routes
app.include_router(infrastructure.router)
app.include_router(records.router)
app.include_router(cache.router)
app.include_router(benchmark.router)
app.include_router(stress.router)

# websockets
app.include_router(lookup.router)
app.include_router(connections.router)
