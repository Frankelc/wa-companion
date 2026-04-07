/**
 * snapClient.service.ts
 * =====================
 * Singleton Playwright qui pilote Snapchat Web (web.snapchat.com).
 * Traduit directement depuis snap_client.py vers TypeScript.
 *
 * Stratégie de capture silencieuse :
 *   1. On intercepte les réponses réseau des CDN Snapchat (images/vidéos)
 *   2. On récupère le binaire AVANT que la requête "lecture" parte
 *   3. On upload vers Supabase Storage
 *   => L'expéditeur ne reçoit jamais de notification "vu"
 */

import { Browser, BrowserContext, Page, Response, Route } from 'playwright';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseClient } from '../config/database';
import { logger } from '../config/logger';

// ─── CDN Patterns Snapchat ────────────────────────────────────────────────────
const SNAP_CDN_PATTERNS = [
  /https:\/\/cf-st\.sc-cdn\.net\/.*/,
  /https:\/\/bolt-gcdn\.sc-cdn\.net\/.*/,
  /https:\/\/snap-story-delivery.*/,
  /https:\/\/aws\.sc-cdn\.net\/.*/,
];

const SESSIONS_DIR = path.join(process.cwd(), 'snap_sessions');

// ─── SnapClientService (Singleton) ────────────────────────────────────────────
class SnapClientService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  public isConnected = false;
  public isCapturing = false;
  private activeUserId: string | null = null;
  private capturedUrls = new Set<string>();
  private userSessions: Map<string, string> = new Map(); // userId -> snapUsername

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start() {
    logger.info('[SnapClient] 🚀 Initializing Playwright (Chromium)...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
    });
    logger.info('[SnapClient] ✅ Playwright ready.');
  }

  async stop() {
    if (this.page) await this.page.close().catch(() => {});
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    logger.info('[SnapClient] 🛑 Browser closed.');
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async login(userId: string, username: string, password: string): Promise<{ success: boolean; method?: string; error?: string }> {
    if (!this.browser) await this.start();
    logger.info(`[SnapClient] 🔑 Logging in as ${username}...`);
    this.activeUserId = userId;

    const storageState = this.loadSession(userId);
    const ctxOptions: any = {
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'fr-FR',
    };
    if (storageState) ctxOptions.storageState = storageState;

    this.context = await this.browser!.newContext(ctxOptions);
    this.page = await this.context.newPage();

    await this.page.goto('https://web.snapchat.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(2000);

    // Check if session is still valid
    if (await this.isLoggedIn()) {
      logger.info(`[SnapClient] ✅ Session restored for ${username}`);
      this.isConnected = true;
      this.userSessions.set(userId, username);
      return { success: true, method: 'session_restored' };
    }

    try {
      // Step 1: Input Username
      logger.info(`[SnapClient] 👤 Entering username: ${username}...`);
      await this.page.fill('#username', username, { timeout: 10000 });
      await this.page.waitForTimeout(500);

      // Step 2: Click 'Next' (Suivant)
      const submitBtn = '.Login_next__2nEN0';
      logger.info('[SnapClient] ➡️ Clicking Next...');
      await this.page.click(submitBtn);

      // Step 3: Wait for Password field to appear (after potential security check)
      logger.info('[SnapClient] ⏳ Waiting for password field...');
      await this.page.waitForSelector('#password', { timeout: 15000 });
      
      // Step 4: Input Password
      logger.info('[SnapClient] 🔑 Entering password...');
      await this.page.fill('#password', password);
      await this.page.waitForTimeout(500);
      
      // Step 5: Final Submit
      logger.info('[SnapClient] 🚀 Finalizing login...');
      await this.page.click(submitBtn);
      
      // Step 6: Wait for redirection to the main app
      await this.page.waitForURL('**/web.snapchat.com/**', { timeout: 15000 });
      await this.page.waitForTimeout(3000);

      if (await this.isLoggedIn()) {
        await this.saveSession(userId);
        this.isConnected = true;
        this.userSessions.set(userId, username);
        logger.info(`[SnapClient] ✅ Login successful for ${username}`);
        return { success: true, method: 'fresh_login' };
      }
      return { success: false, error: 'Login failed. Security check or 2FA required manually.' };
    } catch (err: any) {
      logger.error('[SnapClient] ❌ Login error:', err.message);
      // Take a screenshot on failure to help debug
      if (this.page) {
        const debugPath = path.join(process.cwd(), 'snap_login_error.png');
        await this.page.screenshot({ path: debugPath });
        logger.info(`[SnapClient] 📸 Debug screenshot saved to ${debugPath}`);
      }
      return { success: false, error: `Login failed: ${err.message}` };
    }
  }

  private async isLoggedIn(): Promise<boolean> {
    try {
      await this.page!.waitForSelector(
        '[data-testid="chat-list-item"], .chat-list, [class*="ConversationList"]',
        { timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  logout(userId: string) {
    const sessionPath = path.join(SESSIONS_DIR, `${userId}_session.json`);
    if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    this.userSessions.delete(userId);
    logger.info(`[SnapClient] 🚪 Session deleted for user ${userId}`);
  }

  private loadSession(userId: string): object | null {
    const sessionPath = path.join(SESSIONS_DIR, `${userId}_session.json`);
    if (fs.existsSync(sessionPath)) {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    }
    return null;
  }

  private async saveSession(userId: string) {
    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const state = await this.context!.storageState();
    fs.writeFileSync(path.join(SESSIONS_DIR, `${userId}_session.json`), JSON.stringify(state));
    logger.info(`[SnapClient] 💾 Session saved for user ${userId}`);
  }

  // ─── Capture ─────────────────────────────────────────────────────────────────

  async startCapture(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected. Please login first.' };
    }
    if (this.isCapturing) {
      return { success: true, message: 'Capture already running.' };
    }

    this.isCapturing = true;
    this.activeUserId = userId;
    logger.info(`[SnapClient] 🎯 Starting silent capture for user ${userId}...`);

    // Intercept "mark as read" requests — delay them slightly so we save the media first
    await this.page!.route('**/*', this.interceptRoute.bind(this));

    // Listen to all network responses and grab media from CDN
    this.page!.on('response', this.handleResponse.bind(this));

    return { success: true, message: 'Capture started. Snaps will be saved silently.' };
  }

  async stopCapture(userId: string) {
    this.isCapturing = false;
    logger.info(`[SnapClient] ⏹ Capture stopped for user ${userId}`);
    return { success: true, message: 'Capture stopped.' };
  }

  private async interceptRoute(route: Route) {
    const url = route.request().url();
    // Delay "mark as viewed" requests to give us time to capture
    if (url.includes('loq/update_snaps') || url.includes('mark_chat_seen')) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    await route.continue();
  }

  private async handleResponse(response: Response) {
    if (!this.isCapturing || !this.activeUserId) return;

    const url = response.url();
    const isSnapMedia = SNAP_CDN_PATTERNS.some((p) => p.test(url));
    if (!isSnapMedia) return;
    if (this.capturedUrls.has(url)) return;
    this.capturedUrls.add(url);

    const contentType = response.headers()['content-type'] ?? '';
    let mediaType: 'image' | 'video' | null = null;
    if (contentType.includes('video')) mediaType = 'video';
    else if (contentType.includes('image') || /\.(jpg|jpeg|webp|png)/.test(url)) mediaType = 'image';
    if (!mediaType) return;

    const isStory = url.includes('bolt-gcdn') || url.toLowerCase().includes('story');
    const sender = await this.getCurrentSender();

    logger.info(`[SnapClient] 📥 Intercepted ${isStory ? 'Story' : 'Snap'} (${mediaType}) from ${sender}`);

    try {
      const body = await response.body();
      if (!body?.length) return;
      await this.uploadToSupabase(this.activeUserId!, body, mediaType, sender, isStory, url);
    } catch (err: any) {
      logger.error('[SnapClient] ❌ Error processing media:', err.message);
    }
  }

  private async getCurrentSender(): Promise<string> {
    try {
      const el = await this.page!.$('[data-testid="header-title"], [class*="friendName"], [class*="SenderName"]');
      if (el) return (await el.innerText()).trim();
    } catch {}
    return 'Unknown';
  }

  // ─── Upload ──────────────────────────────────────────────────────────────────

  private async uploadToSupabase(
    userId: string,
    body: Buffer,
    mediaType: 'image' | 'video',
    sender: string,
    isStory: boolean,
    sourceUrl: string,
  ) {
    const supabase = getSupabaseClient();
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
    const filename = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('snap-captures')
      .upload(filename, body, { contentType: mime, upsert: false });

    if (uploadError) {
      logger.error('[SnapClient] ❌ Storage upload error:', uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('snap-captures').getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;

    const { error: dbError } = await supabase.from('snap_captures').insert({
      user_id: userId,
      sender_username: sender,
      media_url: publicUrl,
      media_type: mediaType,
      is_story: isStory,
      source_url: sourceUrl,
      captured_at: new Date().toISOString(),
    });

    if (dbError) {
      logger.error('[SnapClient] ❌ DB insert error:', dbError.message);
      return;
    }

    logger.info(`[SnapClient] ✅ Saved ${isStory ? 'Story' : 'Snap'} → ${publicUrl.slice(0, 60)}...`);
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      is_connected: this.isConnected,
      is_capturing: this.isCapturing,
      active_sessions: Array.from(this.userSessions.keys()),
      captured_count: this.capturedUrls.size,
    };
  }
}

// Export the singleton instance
export const snapClient = new SnapClientService();
