"""
snap_client.py - Coeur du bot Snapchat
========================================
Utilise Playwright pour piloter Snapchat Web en headless.
La stratégie clé : on intercepte les réponses réseau contenant les médias
(images CDN snap) AVANT d'émettre la requête de "lecture" vers les serveurs Snap.
=> L'expéditeur ne reçoit jamais la notification "vu".
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime
from typing import Optional

import httpx
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Route, Response

from uploader import upload_media_to_supabase


SNAP_CDN_PATTERNS = [
    r"https://cf-st\.sc-cdn\.net/.*",   # Snaps directs (images/vidéos)
    r"https://bolt-gcdn\.sc-cdn\.net/.*", # Stories
    r"https://snap-story-delivery.*",
    r"https://aws\.sc-cdn\.net/.*",
]

SESSION_FILE = "snap_session.json"


class SnapCapture:
    def __init__(self, sender: str, media_url: str, media_type: str, is_story: bool, user_id: str):
        self.sender = sender
        self.media_url = media_url
        self.media_type = media_type  # "image" | "video"
        self.is_story = is_story
        self.user_id = user_id
        self.captured_at = datetime.utcnow().isoformat()


class SnapClient:
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.is_connected = False
        self.is_capturing = False
        self._captured_urls: set[str] = set()  # Évite les doublons
        self._user_sessions: dict[str, str] = {}  # user_id -> snap_username
        self._active_user_id: Optional[str] = None

    async def start(self):
        """Initialise Playwright + charge la session si elle existe."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
            ]
        )
        print("[SnapClient] ✅ Playwright (Chromium) initialized.")

    async def stop(self):
        """Ferme tout proprement."""
        if self.page: await self.page.close()
        if self.context: await self.context.close()
        if self.browser: await self.browser.close()
        if self.playwright: await self.playwright.stop()
        print("[SnapClient] 🛑 Browser closed.")

    # ─── AUTH ─────────────────────────────────────────────────────────────────

    async def login(self, user_id: str, username: str, password: str) -> dict:
        """
        Connecte un compte Snapchat.
        Retourne {"success": True} ou {"success": False, "error": "..."}
        """
        print(f"[SnapClient] 🔑 Logging in as {username}...")
        self._active_user_id = user_id

        # Create a fresh context with a persistent storage state if available
        storage_state = self._load_session(user_id)
        ctx_args = {
            "viewport": {"width": 1280, "height": 800},
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "locale": "fr-FR",
        }
        if storage_state:
            ctx_args["storage_state"] = storage_state

        self.context = await self.browser.new_context(**ctx_args)
        self.page = await self.context.new_page()

        # Go to Snapchat Web
        await self.page.goto("https://web.snapchat.com", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)

        # Check if already logged in via saved session
        if await self._is_logged_in():
            print(f"[SnapClient] ✅ Session restored for {username}")
            self.is_connected = True
            self._user_sessions[user_id] = username
            return {"success": True, "method": "session_restored"}

        # Manual login flow
        try:
            # Fill username
            await self.page.fill('input[name="username"]', username, timeout=10000)
            await asyncio.sleep(0.5)
            await self.page.fill('input[name="password"]', password)
            await asyncio.sleep(0.3)
            await self.page.click('button[type="submit"]')

            # Wait for redirect after login
            await self.page.wait_for_url("**/web.snapchat.com/**", timeout=15000)
            await asyncio.sleep(3)

            if await self._is_logged_in():
                await self._save_session(user_id)
                self.is_connected = True
                self._user_sessions[user_id] = username
                print(f"[SnapClient] ✅ Login successful for {username}")
                return {"success": True, "method": "fresh_login"}
            else:
                return {"success": False, "error": "Login failed. Wrong credentials or 2FA required."}

        except Exception as e:
            print(f"[SnapClient] ❌ Login error: {e}")
            return {"success": False, "error": str(e)}

    async def _is_logged_in(self) -> bool:
        """Vérifie si on est bien authentifié en cherchant un élément spécifique au chat."""
        try:
            # Snap Web affiche la sidebar de chat une fois connecté
            await self.page.wait_for_selector('[data-testid="chat-list-item"], .chat-list, [class*="ConversationList"]', timeout=5000)
            return True
        except Exception:
            return False

    def _load_session(self, user_id: str) -> Optional[dict]:
        """Charge la session sauvegardée depuis le disque (si elle existe)."""
        path = f"snap_sessions/{user_id}_session.json"
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
        return None

    async def _save_session(self, user_id: str):
        """Sauvegarde les cookies/storage de la session pour éviter de re-login."""
        os.makedirs("snap_sessions", exist_ok=True)
        path = f"snap_sessions/{user_id}_session.json"
        state = await self.context.storage_state()
        with open(path, "w") as f:
            json.dump(state, f)
        print(f"[SnapClient] 💾 Session saved for user {user_id}")

    def logout(self, user_id: str):
        """Supprime la session sauvegardée pour un utilisateur."""
        path = f"snap_sessions/{user_id}_session.json"
        if os.path.exists(path):
            os.remove(path)
        self._user_sessions.pop(user_id, None)
        print(f"[SnapClient] 🚪 Session deleted for user {user_id}")

    # ─── CAPTURE ──────────────────────────────────────────────────────────────

    async def start_capture(self, user_id: str) -> dict:
        """
        Lance la boucle de capture en arrière-plan.
        Intercepte les réponses CDN de Snapchat et les télécharge silencieusement.
        """
        if not self.is_connected:
            return {"success": False, "error": "Not connected to Snapchat. Please login first."}

        if self.is_capturing:
            return {"success": True, "message": "Capture already running."}

        self.is_capturing = True
        self._active_user_id = user_id
        print(f"[SnapClient] 🎯 Starting silent capture for user {user_id}...")

        # Intercept network responses to grab media BEFORE marking as read
        await self.page.route("**/*", self._intercept_route)

        # Also listen to CDN responses
        self.page.on("response", self._handle_response)

        return {"success": True, "message": "Capture started. Snaps will be saved silently."}

    async def stop_capture(self, user_id: str):
        self.is_capturing = False
        print(f"[SnapClient] ⏹ Capture stopped for user {user_id}")
        return {"success": True, "message": "Capture stopped."}

    async def _intercept_route(self, route: Route):
        """
        Intercepteur de routes Playwright.
        On laisse passer toutes les requêtes, SAUF les requêtes de "lecture"
        qu'on retarde d'1 seconde le temps de sauvegarder le média.
        """
        request = route.request
        url = request.url

        # Détecter la requête qui marque un snap comme "vu"
        if "snapchat.com/loq/update_snaps" in url or "mark_chat_seen" in url:
            # Attendre assez longtemps pour que l'intercepteur de réponse ait pu sauvegarder le média
            await asyncio.sleep(1.5)

        await route.continue_()

    async def _handle_response(self, response: Response):
        """
        Analyse chaque réponse réseau.
        Si c'est un CDN Snap avec du contenu média, on le télécharge.
        """
        if not self.is_capturing or not self._active_user_id:
            return

        url = response.url

        # Vérifier si c'est un média CDN Snapchat
        is_snap_media = any(re.match(pattern, url) for pattern in SNAP_CDN_PATTERNS)
        if not is_snap_media:
            return

        # Éviter les doublons
        if url in self._captured_urls:
            return
        self._captured_urls.add(url)

        # Déterminer le type de média
        content_type = response.headers.get("content-type", "")
        if "video" in content_type:
            media_type = "video"
        elif "image" in content_type or "jpeg" in url or "jpg" in url or "webp" in url:
            media_type = "image"
        else:
            return  # Ignorer si ce n'est pas un média connu

        # Détecter si c'est une story ou un snap direct depuis l'URL
        is_story = "bolt-gcdn" in url or "story" in url.lower()

        print(f"[SnapClient] 📥 Intercepted {'Story' if is_story else 'Snap'} ({media_type}): {url[:80]}...")

        # Télécharger le corps de la réponse (Playwright l'a déjà reçu en mémoire)
        try:
            body = await response.body()
            if not body:
                return

            # Déterminer le sender actuel depuis le titre de la page ou l'URL
            sender = await self._get_current_sender()

            # Upload vers Supabase
            result = await upload_media_to_supabase(
                user_id=self._active_user_id,
                body=body,
                media_type=media_type,
                sender=sender,
                is_story=is_story,
                source_url=url,
            )

            if result.get("success"):
                print(f"[SnapClient] ✅ Saved {'Story' if is_story else 'Snap'} from {sender} → {result.get('media_url', '')[:60]}")
            else:
                print(f"[SnapClient] ⚠️ Upload failed: {result.get('error')}")

        except Exception as e:
            print(f"[SnapClient] ❌ Error processing media: {e}")

    async def _get_current_sender(self) -> str:
        """
        Essaie d'extraire le pseudo de l'expéditeur depuis la page active.
        Fallback sur "Unknown" si pas possible.
        """
        try:
            sender_el = await self.page.query_selector('[data-testid="header-title"], [class*="friendName"], [class*="SenderName"]')
            if sender_el:
                return (await sender_el.inner_text()).strip()
        except Exception:
            pass
        return "Unknown"

    # ─── STATUS ───────────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "is_connected": self.is_connected,
            "is_capturing": self.is_capturing,
            "active_sessions": list(self._user_sessions.keys()),
            "captured_count": len(self._captured_urls),
        }
