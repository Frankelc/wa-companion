import { getSupabaseClient } from '../config/database';
import { logger } from '../config/logger';

const supabase = getSupabaseClient();

const SNAP_BOT_URL = process.env.SNAP_BOT_URL || 'http://localhost:8001';

/** Helper: POST JSON to the Python snap-bot */
async function snapBotPost(path: string, body: object, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SNAP_BOT_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((err as any).detail || res.statusText);
    }
    return res.json();
  } catch (e: any) {
    clearTimeout(id);
    throw e;
  }
}

/** Helper: GET from the Python snap-bot */
async function snapBotGet(path: string): Promise<any> {
  const res = await fetch(`${SNAP_BOT_URL}${path}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnapCapture {
  id: string;
  user_id: string;
  sender_username: string;
  media_url: string;
  media_type: 'image' | 'video';
  is_story: boolean;
  source_url?: string;
  captured_at: string;
}

// ─── Snap Bot Control (Proxy to Python micro-service) ────────────────────────

export const loginSnapAccount = async (
  userId: string,
  username: string,
  password: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const resp = await snapBotPost('/api/snap-bot/login', { user_id: userId, username, password });
    return {
      success: true,
      message: resp?.method === 'session_restored'
        ? 'Session restaurée — connexion instantanée !'
        : 'Connexion Snapchat réussie !',
    };
  } catch (err: any) {
    logger.error('[SnapService] Login error:', err.message);
    return { success: false, error: err.message || 'Connexion échouée' };
  }
};

export const logoutSnapAccount = async (userId: string): Promise<void> => {
  try {
    await snapBotPost('/api/snap-bot/logout', { user_id: userId });
  } catch (err) {
    logger.warn('[SnapService] Logout error (bot may be stopped):', err);
  }
};

export const startSnapCapture = async (
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const resp = await snapBotPost('/api/snap-bot/start-capture', { user_id: userId });
    return { success: true, message: resp?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const stopSnapCapture = async (userId: string): Promise<{ success: boolean }> => {
  try {
    await snapBotPost('/api/snap-bot/stop-capture', { user_id: userId });
    return { success: true };
  } catch {
    return { success: false };
  }
};

export const getSnapBotStatus = async (): Promise<object> => {
  try {
    return await snapBotGet('/api/snap-bot/status');
  } catch {
    return { is_connected: false, is_capturing: false, error: 'Snap bot offline' };
  }
};

// ─── Database Operations ──────────────────────────────────────────────────────

export const getSnapCaptures = async (
  userId: string,
  limit = 50,
  isStory?: boolean
): Promise<SnapCapture[]> => {
  let query = supabase
    .from('snap_captures')
    .select('*')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (isStory !== undefined) {
    query = query.eq('is_story', isStory);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('[SnapService] Error getting captures:', error);
    throw new Error('Failed to get snap captures');
  }
  return data || [];
};

export const getSnapCaptureById = async (userId: string, captureId: string): Promise<SnapCapture> => {
  const { data, error } = await supabase
    .from('snap_captures')
    .select('*')
    .eq('id', captureId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Snap capture not found');
  }
  return data;
};

export const deleteSnapCapture = async (userId: string, captureId: string): Promise<void> => {
  // Verify ownership
  await getSnapCaptureById(userId, captureId);

  const { error } = await supabase
    .from('snap_captures')
    .delete()
    .eq('id', captureId)
    .eq('user_id', userId);

  if (error) {
    logger.error('[SnapService] Error deleting capture:', error);
    throw new Error('Failed to delete snap capture');
  }
};

export const getSnapStats = async (userId: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const [{ count: todayCount }, { count: monthCount }, { count: totalCount }, { count: storyCount }] =
    await Promise.all([
      supabase.from('snap_captures').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('captured_at', today.toISOString()),
      supabase.from('snap_captures').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('captured_at', thisMonth.toISOString()),
      supabase.from('snap_captures').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('snap_captures').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_story', true),
    ]);

  return {
    capturedToday: todayCount || 0,
    capturedThisMonth: monthCount || 0,
    totalCaptured: totalCount || 0,
    storiesCount: storyCount || 0,
  };
};
