import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import {
  loginSnap,
  logoutSnap,
  startCapture,
  stopCapture,
  getBotStatus,
  listCaptures,
  getCaptureById,
  deleteCapture,
  getStats,
} from '../controllers/snap.controller';

const router = Router();

router.use(protect);

// Auth
router.post('/login', apiLimiter, loginSnap);
router.post('/logout', apiLimiter, logoutSnap);

// Bot control
router.post('/start-capture', apiLimiter, startCapture);
router.post('/stop-capture', apiLimiter, stopCapture);
router.get('/status', apiLimiter, getBotStatus);

// Captures
router.get('/captures', apiLimiter, listCaptures);
router.get('/stats', apiLimiter, getStats);
router.get('/captures/:id', apiLimiter, getCaptureById);
router.delete('/captures/:id', apiLimiter, deleteCapture);

export default router;
