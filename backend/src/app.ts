import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './config/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import statusRoutes from './routes/status.routes';
import viewOnceRoutes from './routes/viewOnce.routes';
import deletedMessagesRoutes from './routes/deletedMessages.routes';
import autoresponderRoutes from './routes/autoresponder.routes';
// Scheduled statuses feature is DISABLED
// import scheduledStatusRoutes from './routes/scheduledStatus.routes';
import subscriptionRoutes from './routes/subscription.routes';
import analyticsRoutes from './routes/analytics.routes';
import quotaRoutes from './routes/quota.routes';
import mediaRoutes from './routes/media.routes';
import notificationsRoutes from './routes/notifications.routes';
import adminRoutes from './routes/admin.routes';
import logsRoutes from './routes/logs.routes';
import snapRoutes from './routes/snap.routes';

const app: Application = express();

// When running behind a proxy (Render, Netlify, etc.), Express must trust it
// so that rate limiting & IP detection can use the X-Forwarded-For header
app.set('trust proxy', true);

// CORS MUST be before Helmet to avoid blocking CORS headers
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const additionalOrigins = env.ALLOWED_ORIGINS || [];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        logger.info('[CORS] Allowing request with no origin');
        return callback(null, true);
      }
      
      logger.info(`[CORS] Checking origin: ${origin}, NODE_ENV: ${env.NODE_ENV}`);
      
      // In development, allow localhost on any port
      if (env.NODE_ENV === 'development') {
        // Allow any localhost origin in development
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          logger.info(`[CORS] ✅ Allowing development origin: ${origin}`);
          return callback(null, true);
        }
        
        // Also check specific allowed origins
        const allowedOrigins = [
          'http://localhost:8080',
          'http://localhost:8081',
          'http://localhost:5173',
          env.FRONTEND_URL,
          ...additionalOrigins,
        ].filter(Boolean); // Remove undefined values
        
        if (allowedOrigins.includes(origin)) {
          logger.info(`[CORS] ✅ Allowing origin from allowed list: ${origin}`);
          return callback(null, true);
        }
      }
      
      // In production, only allow the configured frontend URL
      if (env.NODE_ENV === 'production') {
        const allowedOrigins = [env.FRONTEND_URL, ...additionalOrigins].filter(Boolean);
        if (allowedOrigins.includes(origin)) {
          logger.info(`[CORS] ✅ Allowing production origin: ${origin}`);
          return callback(null, true);
        }
      }
      
      logger.warn(`[CORS] ❌ Blocking origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Security middleware (after CORS)
// In development, disable some Helmet features that might interfere with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  // Disable crossOriginOpenerPolicy in development to avoid CORS issues
  crossOriginOpenerPolicy: env.NODE_ENV === 'production' ? { policy: 'same-origin' } : false,
  contentSecurityPolicy: env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:*", "https:"],
      mediaSrc: ["'self'", "blob:", "http://localhost:*", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  } : false, // Disable CSP in development
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static media files (deleted messages media)
// Must be before rate limiting to avoid CORS issues
app.use('/api/media/deleted-messages', (req, res, next): void => {
  // Set CORS headers first
  const origin = req.headers.origin;
  if (origin && (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === env.FRONTEND_URL
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'deleted-messages'), {
  setHeaders: (res, filePath) => {
    // Set appropriate content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
  },
}));

// Serve static media files (view once captures)
app.use('/api/media/view-once', (req, res, next): void => {
  const origin = req.headers.origin;
  if (origin && (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === env.FRONTEND_URL ||
    (env.ALLOWED_ORIGINS || []).includes(origin)
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'view-once'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
  },
}));

// Scheduled statuses feature is DISABLED
// Serve static media files (scheduled status media)
// app.use('/api/media/scheduled-status', (req, res, next): void => {
//   // Set CORS headers first
//   const origin = req.headers.origin;
//   if (origin && (
//     origin.startsWith('http://localhost:') ||
//     origin.startsWith('http://127.0.0.1:') ||
//     origin === env.FRONTEND_URL
//   )) {
//     res.setHeader('Access-Control-Allow-Origin', origin);
//   } else {
//     res.setHeader('Access-Control-Allow-Origin', '*');
//   }
//   res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//   res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
//   res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
//   
//   if (req.method === 'OPTIONS') {
//     res.sendStatus(200);
//     return;
//   }
//   next();
// }, express.static(path.join(process.cwd(), 'uploads', 'scheduled-status'), {
//   setHeaders: (res, filePath) => {
//     // Set appropriate content type based on file extension
//     const ext = path.extname(filePath).toLowerCase();
//     const mimeTypes: Record<string, string> = {
//       '.jpg': 'image/jpeg',
//       '.jpeg': 'image/jpeg',
//       '.png': 'image/png',
//       '.gif': 'image/gif',
//       '.webp': 'image/webp',
//       '.mp4': 'video/mp4',
//       '.mov': 'video/quicktime',
//       '.avi': 'video/x-msvideo',
//       '.mp3': 'audio/mpeg',
//       '.ogg': 'audio/ogg',
//       '.wav': 'audio/wav',
//       '.pdf': 'application/pdf',
//       '.doc': 'application/msword',
//       '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       '.xls': 'application/vnd.ms-excel',
//       '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//       '.zip': 'application/zip',
//       '.rar': 'application/x-rar-compressed',
//     };
//     
//     const contentType = mimeTypes[ext] || 'application/octet-stream';
//     res.setHeader('Content-Type', contentType);
//   },
// }));

// Rate limiting (after static files to avoid blocking media)
app.use('/api', apiLimiter);

// Root route
app.get('/', (_req, res) => {
  res.json({
    message: 'AMDA Backend API',
    version: '1.0.0',
    status: 'ok',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API Routes
app.use('/api', (req, _res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/view-once', viewOnceRoutes);
app.use('/api/deleted-messages', deletedMessagesRoutes);
app.use('/api/autoresponder', autoresponderRoutes);
// Scheduled statuses feature is DISABLED
// app.use('/api/scheduled-status', scheduledStatusRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/quota', quotaRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/snap', snapRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;

