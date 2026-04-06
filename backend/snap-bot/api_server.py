"""
api_server.py - Routes FastAPI exposées au backend Node.js
============================================================
Le backend Node.js appelle ces endpoints pour piloter le bot Snap.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/snap-bot", tags=["Snap Bot"])


# ─── Schémas ─────────────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    user_id: str
    username: str
    password: str

class CaptureBody(BaseModel):
    user_id: str


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status(request: Request):
    """Retourne l'état courant du bot."""
    client = request.app.state.snap_client
    return client.get_status()


@router.post("/login")
async def login(body: LoginBody, request: Request):
    """
    Connecte un compte Snapchat.
    Sauvegarde automatiquement la session pour les prochains lancements.
    """
    client = request.app.state.snap_client
    result = await client.login(body.user_id, body.username, body.password)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Login failed"))
    return result


@router.post("/logout")
async def logout(body: CaptureBody, request: Request):
    """Déconnecte et supprime la session d'un utilisateur."""
    client = request.app.state.snap_client
    client.logout(body.user_id)
    return {"success": True, "message": "Logged out successfully"}


@router.post("/start-capture")
async def start_capture(body: CaptureBody, request: Request):
    """
    Démarre la capture silencieuse des Snaps et Stories.
    Le bot va intercepter les médias avant de les marquer comme lus.
    """
    client = request.app.state.snap_client
    result = await client.start_capture(body.user_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.post("/stop-capture")
async def stop_capture(body: CaptureBody, request: Request):
    """Arrête la capture pour un utilisateur."""
    client = request.app.state.snap_client
    return await client.stop_capture(body.user_id)


@router.get("/health")
async def health():
    return {"status": "ok", "service": "snap-bot"}
