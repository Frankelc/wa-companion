import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as snapService from '../services/snap.service';
import { logger } from '../config/logger';

/** POST /api/snap/login */
export const loginSnap = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: { message: 'username and password are required' } });
      return;
    }

    const result = await snapService.loginSnapAccount(userId, username, password);
    if (!result.success) {
      res.status(400).json({ success: false, error: { message: result.error } });
      return;
    }
    res.json({ success: true, message: result.message });
  } catch (err) {
    logger.error('[SnapCtrl] login error:', err);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

/** POST /api/snap/logout */
export const logoutSnap = async (req: AuthRequest, res: Response): Promise<void> => {
  await snapService.logoutSnapAccount(req.userId!);
  res.json({ success: true, message: 'Logged out from Snapchat' });
};

/** POST /api/snap/start-capture */
export const startCapture = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await snapService.startSnapCapture(req.userId!);
  if (!result.success) {
    res.status(400).json({ success: false, error: { message: result.error } });
    return;
  }
  res.json({ success: true, message: result.message });
};

/** POST /api/snap/stop-capture */
export const stopCapture = async (req: AuthRequest, res: Response): Promise<void> => {
  await snapService.stopSnapCapture(req.userId!);
  res.json({ success: true, message: 'Capture stopped' });
};

/** GET /api/snap/status */
export const getBotStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const status = await snapService.getSnapBotStatus();
  res.json({ success: true, data: status });
};

/** GET /api/snap/captures */
export const listCaptures = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const isStory = req.query.is_story !== undefined
      ? req.query.is_story === 'true'
      : undefined;

    const captures = await snapService.getSnapCaptures(userId, limit, isStory);
    res.json({ success: true, data: captures });
  } catch (err) {
    logger.error('[SnapCtrl] listCaptures error:', err);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

/** GET /api/snap/captures/:id */
export const getCaptureById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const capture = await snapService.getSnapCaptureById(req.userId!, req.params.id);
    res.json({ success: true, data: capture });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
};

/** DELETE /api/snap/captures/:id */
export const deleteCapture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await snapService.deleteSnapCapture(req.userId!, req.params.id);
    res.json({ success: true, message: 'Capture deleted' });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
};

/** GET /api/snap/stats */
export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await snapService.getSnapStats(req.userId!);
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('[SnapCtrl] getStats error:', err);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
