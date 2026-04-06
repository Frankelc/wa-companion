"""
uploader.py - Upload médias vers Supabase Storage + insert en BDD
=================================================================
Gère le stockage des Snaps/Stories capturés.
"""

import os
import time
import random
import string
from datetime import datetime
from typing import Optional

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase: Optional[Client] = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase


def _random_suffix(n: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


async def upload_media_to_supabase(
    user_id: str,
    body: bytes,
    media_type: str,       # "image" | "video"
    sender: str,
    is_story: bool,
    source_url: str,
) -> dict:
    """
    Upload le binaire du média dans Supabase Storage (bucket 'snap-captures')
    puis insère une ligne dans la table 'snap_captures'.

    Retourne {"success": True, "media_url": "..."} ou {"success": False, "error": "..."}
    """
    try:
        sb = get_supabase()

        # ─── 1. Déterminer l'extension ────────────────────────────────────────
        ext = "mp4" if media_type == "video" else "jpg"
        mime = "video/mp4" if media_type == "video" else "image/jpeg"

        # Générer un nom de fichier unique
        ts = int(time.time() * 1000)
        suffix = _random_suffix()
        filename = f"{user_id}/{ts}_{suffix}.{ext}"

        # ─── 2. Upload dans Supabase Storage ─────────────────────────────────
        storage = sb.storage.from_("snap-captures")
        upload_resp = storage.upload(
            path=filename,
            file=body,
            file_options={"content-type": mime, "upsert": "false"},
        )

        # Construire l'URL publique
        public_url = sb.storage.from_("snap-captures").get_public_url(filename)

        # ─── 3. Insérer en base de données ───────────────────────────────────
        insert_resp = sb.table("snap_captures").insert({
            "user_id": user_id,
            "sender_username": sender,
            "media_url": public_url,
            "media_type": media_type,
            "is_story": is_story,
            "source_url": source_url,
            "captured_at": datetime.utcnow().isoformat(),
        }).execute()

        if insert_resp.data:
            return {"success": True, "media_url": public_url, "id": insert_resp.data[0]["id"]}
        else:
            return {"success": False, "error": "DB insert returned no data"}

    except Exception as e:
        print(f"[Uploader] ❌ Error: {e}")
        return {"success": False, "error": str(e)}
