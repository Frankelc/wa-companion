"""
AMDA - Snapchat Capture Bot
============================
Micro-service Python qui pilote Snapchat Web via Playwright.
Il intercepte les requêtes réseau pour télécharger les médias (Snaps & Stories)
AVANT de les marquer comme lus, rendant la capture totalement invisible.

Architecture :
- Playwright (Chromium headless) pour piloter web.snapchat.com
- FastAPI pour exposer une API REST au backend Node.js principal
- Supabase pour stocker les métadonnées et les médias
"""

import asyncio
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from snap_client import SnapClient
from api_server import router

load_dotenv()

# ─── Singleton client ────────────────────────────────────────────────────────
snap_client = SnapClient()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Démarre Playwright au boot, l'arrête à l'extinction."""
    print("[SNAP-BOT] 🚀 Starting Snapchat capture service...")
    await snap_client.start()
    app.state.snap_client = snap_client
    yield
    print("[SNAP-BOT] 🛑 Stopping Snapchat capture service...")
    await snap_client.stop()

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AMDA Snap Bot",
    description="Micro-service de capture silencieuse de Snaps et Stories",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", os.getenv("FRONTEND_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("SNAP_BOT_PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
