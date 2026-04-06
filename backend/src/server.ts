import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { getRedisClient } from './config/redis';
import { getSupabaseClient } from './config/database';
import { logEnvironmentStatus, checkEnvironmentVariables } from './config/check-env';
import { reconnectWhatsAppIfCredentialsExist } from './services/whatsapp.service';
import { initializeFirebaseAdmin } from './services/notifications.service';
import { initializePairingQueue } from './services/pairingQueue.service';
import { existsSync } from 'fs';
import { join } from 'path';
import { startRenderKeepAlive } from './utils/renderKeepAlive';
import { snapClient } from './services/snapClient.service';
// Scheduled statuses feature is DISABLED
// import cron from 'node-cron';
// import { processScheduledStatusesJob } from './jobs/scheduledStatus.job';

const PORT = env.PORT;

async function startServer(): Promise<void> {
  try {
    logger.info('🚀 Starting AMDA Backend Server...');
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Port: ${env.PORT}`);
    logger.info(`API URL: ${env.API_URL}`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    
    // Check environment variables first
    logEnvironmentStatus();
    const envCheck = checkEnvironmentVariables();
    
    if (!envCheck.allSet) {
      logger.error('❌ Server cannot start: Missing or invalid environment variables');
      logger.error('Please check your .env file and ensure all required variables are set');
      if (envCheck.missing.length > 0) {
        logger.error(`Missing: ${envCheck.missing.join(', ')}`);
      }
      if (envCheck.placeholders.length > 0) {
        logger.error(`Placeholders: ${envCheck.placeholders.join(', ')}`);
        if (envCheck.placeholders.some(p => p.includes('JWT'))) {
          logger.info('');
          logger.info('💡 Quick fix: Run "npm run generate-secrets" to generate JWT secrets');
          logger.info('   Then update your .env file with the generated values');
          logger.info('   See backend/QUICK_FIX_JWT.md for detailed instructions');
          logger.info('');
        }
      }
      process.exit(1);
    }

    // Initialize Firebase Admin for push notifications
    if (env.NODE_ENV !== 'test') {
      try {
        initializeFirebaseAdmin();
      } catch (error) {
        logger.warn('Firebase Admin initialization failed, push notifications will be disabled:', error);
      }
    }

    // Initialize pairing code queue
    if (env.NODE_ENV !== 'test') {
      try {
        await initializePairingQueue();
        logger.info('✅ Pairing code queue initialized');
      } catch (error) {
        logger.warn('Pairing code queue initialization failed, pairing code may not work properly:', error);
      }
    }

    // Initialize Redis connection (optional for basic tests)
    if (env.NODE_ENV !== 'test') {
      const redisClient = await getRedisClient();
      if (redisClient) {
        logger.info('Redis connected');
      } else {
        logger.warn('Redis not available, continuing without Redis');
      }
    }

    // Auto-reconnect WhatsApp sessions if credentials exist
    // Only reconnect if not already connected to avoid interrupting active connections
    if (env.NODE_ENV !== 'test') {
      try {
        logger.info('🔄 Checking for existing WhatsApp sessions to reconnect...');
        const supabase = getSupabaseClient();
        
        // Get all users with WhatsApp sessions (regardless of status)
        // This ensures we reconnect even if status was reset to disconnected after server restart
        const { data: sessions, error } = await supabase
          .from('whatsapp_sessions')
          .select('user_id, status');
        
        if (error) {
          logger.warn('Error fetching WhatsApp sessions for auto-reconnect:', error);
        } else if (sessions && sessions.length > 0) {
          logger.info(`Found ${sessions.length} WhatsApp session(s) to check for auto-reconnect`);
          
          // Reconnect each user if credentials exist
          // Add a small delay between reconnections to avoid overwhelming WhatsApp servers
          for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            const userId = session.user_id;
            const sessionPath = join(process.cwd(), env.WHATSAPP_SESSION_PATH, userId);
            
            // On Render, files are ephemeral and will NOT exist on startup
            // We must call reconnectWhatsAppIfCredentialsExist which internally
            // restores session files from Supabase if needed.
            logger.info(`[Startup] Checking if user ${userId} (status: ${session.status}) needs reconnection...`);
            
            // Add delay between reconnections (2 seconds per user) to avoid rate limiting
            const delay = i * 2000;
            
            setTimeout(() => {
              // Reconnect in background (don't wait) - function will skip if already connected
              reconnectWhatsAppIfCredentialsExist(userId).then((reconnected) => {
                if (reconnected) {
                  logger.info(`✅ [Startup] Successfully reconnected user ${userId} on server startup`);
                } else {
                  logger.debug(`[Startup] User ${userId} could not be reconnected or is already connecting`);
                }
              }).catch((error) => {
                logger.error(`[Startup] Error auto-reconnecting user ${userId}:`, error);
              });
            }, delay);
          }
          
          logger.info(`[Startup] Initiated auto-reconnect for ${sessions.length} user(s) with credentials`);
        } else {
          logger.info('No existing WhatsApp sessions found for auto-reconnect');
        }
      } catch (error) {
        logger.warn('Error during WhatsApp auto-reconnect check:', error);
        // Don't fail server startup if auto-reconnect fails
      }
    }

    // Scheduled statuses feature is DISABLED
    // This feature has been disabled because Baileys API does not support publishing statuses correctly
    // The statuses were being sent as regular messages instead of actual WhatsApp statuses
    // if (env.NODE_ENV !== 'test') {
    //   // Run every minute at second 0 (e.g., 21:13:00, 21:14:00, etc.)
    //   cron.schedule('* * * * *', async () => {
    //     try {
    //       const startTime = new Date();
    //       logger.info(`[Cron] Scheduled statuses job triggered at ${startTime.toISOString()} (${startTime.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })})`);
    //       await processScheduledStatusesJob();
    //       const endTime = new Date();
    //       const duration = endTime.getTime() - startTime.getTime();
    //       logger.info(`[Cron] Scheduled statuses job completed in ${duration}ms`);
    //     } catch (error) {
    //       logger.error('Error in scheduled statuses cron job:', error);
    //       // Don't throw, let the cron continue
    //     }
    //   });
    //   logger.info('✅ Scheduled statuses cron job started (runs every minute at second 0)');
    //   
    //   // Also run immediately on startup to catch any missed statuses
    //   setTimeout(async () => {
    //     try {
    //       logger.info('[Cron] Running initial scheduled statuses check on startup...');
    //       await processScheduledStatusesJob();
    //     } catch (error) {
    //       logger.error('Error in initial scheduled statuses check:', error);
    //     }
    //   }, 5000); // Wait 5 seconds after server start
    // }

    // Initialize Snap Bot (Playwright) in the background — non-blocking
    // It will be ready by the time the user first tries to connect
    if (env.NODE_ENV !== 'test') {
      snapClient.start().catch((err) => {
        logger.warn('[SnapClient] Playwright init failed (snap features will be unavailable):', err.message);
      });
    }

    // Start Express server
    // Listen on all interfaces (0.0.0.0) to allow connections from frontend
    app.listen(PORT, '0.0.0.0', () => {
      logger.info({
        message: `🚀 Server running on port ${PORT}`,
        environment: env.NODE_ENV,
        apiUrl: env.API_URL,
        host: '0.0.0.0',
        accessibleAt: `http://localhost:${PORT}`,
      });

      if (env.NODE_ENV !== 'test') {
        startRenderKeepAlive();
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
// Track rejected promises to avoid logging duplicates
const rejectedPromises = new Set<string>();
const REJECTION_LOG_COOLDOWN = 5000; // 5 seconds

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const reasonStr = reason instanceof Error ? reason.message : String(reason);
  const rejectionKey = `${reasonStr.substring(0, 100)}-${Date.now() - (Date.now() % REJECTION_LOG_COOLDOWN)}`;
  
  // Only log if we haven't seen this rejection recently
  if (!rejectedPromises.has(rejectionKey)) {
    rejectedPromises.add(rejectionKey);
    
    // Clean up old entries periodically
    if (rejectedPromises.size > 100) {
      rejectedPromises.clear();
    }
    
    logger.error('Unhandled Rejection:', {
      reason: reasonStr,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString().substring(0, 200),
    });
    
    // Don't crash immediately - log and continue
    // This allows the application to recover from non-critical errors
    // Only exit if it's a critical error
    if (reason instanceof Error && (
      reason.message.includes('FATAL') || 
      reason.message.includes('CRITICAL') ||
      reason.message.includes('Cannot find module')
    )) {
      logger.fatal('Critical unhandled rejection, exiting...');
      process.exit(1);
    } else {
      // Only log warning once per cooldown period to avoid spam
      logger.debug('Non-critical unhandled rejection, continuing...');
    }
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await snapClient.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await snapClient.stop();
  process.exit(0);
});

startServer();
