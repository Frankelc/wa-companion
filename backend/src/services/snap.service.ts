/**
 * snap.service.ts
 * ===============
 * Remplace le proxy HTTP vers Python par des appels directs au SnapClientService (Playwright).
 * Les signatures des fonctions exportées sont IDENTIQUES — le controller ne change pas.
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../config/logger';
import { snapClient } from './snapClient.service';

const supabase = getSupabaseClient();

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

// ─── Snap Bot Control (calls directly to local Playwright service) ────────────

export const loginSnapAccount = async (
  userId: string,
  username: string,
  password: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  const result = await snapClient.login(userId, username, password);
  if (!result.success) return { success: false, error: result.error };
  return {
    success: true,
    message:
      result.method === 'session_restored'
        ? 'Session restaurée — connexion instantanée !'
        : 'Connexion Snapchat réussie !',
  };
};

export const logoutSnapAccount = async (userId: string): Promise<void> => {
  snapClient.logout(userId);
};

export const startSnapCapture = async (
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  return snapClient.startCapture(userId);
};

export const stopSnapCapture = async (userId: string): Promise<{ success: boolean }> => {
  return snapClient.stopCapture(userId);
};

export const getSnapBotStatus = async (): Promise<object> => {
  return snapClient.getStatus();
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

  if (isStory !== undefined) query = query.eq('is_story', isStory);

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

  if (error || !data) throw new Error('Snap capture not found');
  return data;
};

export const deleteSnapCapture = async (userId: string, captureId: string): Promise<void> => {
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
    capturedToday: todayCount ?? 0,
    capturedThisMonth: monthCount ?? 0,
    totalCaptured: totalCount ?? 0,
    storiesCount: storyCount ?? 0,
  };
};
