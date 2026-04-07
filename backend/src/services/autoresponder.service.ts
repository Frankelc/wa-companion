import { WASocket, proto } from '@whiskeysockets/baileys';
import { logger } from '../config/logger';
import { getSupabaseClient } from '../config/database';
import { captureViewOnceFromQuoted } from './viewOnce.service';
import { getSocket, getActiveSockets } from './whatsapp.service';
import { matchesViewOnceCommand, updateViewOnceCommandConfig, getViewOnceCommandConfig } from './viewOnceCommand.service';
import { findUserIdBySocketJID } from './userIdentification.service';

const supabase = getSupabaseClient();

const extractQuotedMessage = (message: any): proto.IMessage | null => {
  if (!message?.message) {
    return null;
  }

  const contexts = [
    message.message?.extendedTextMessage?.contextInfo,
    message.message?.imageMessage?.contextInfo,
    message.message?.videoMessage?.contextInfo,
    message.message?.buttonsResponseMessage?.contextInfo,
    message.message?.listResponseMessage?.contextInfo,
    message.message?.interactiveResponseMessage?.contextInfo,
    message.message?.documentMessage?.contextInfo,
    message.message?.audioMessage?.contextInfo,
    message.message?.stickerMessage?.contextInfo,
  ].filter(Boolean);

  for (const context of contexts) {
    if (context?.quotedMessage) {
      const quoted = context.quotedMessage as proto.IMessage;
      if (quoted?.ephemeralMessage?.message) {
        return quoted.ephemeralMessage.message as proto.IMessage;
      }
      return quoted;
    }
  }

  if (message.message?.contextInfo?.quotedMessage) {
    const quoted = message.message.contextInfo.quotedMessage as proto.IMessage;
    if (quoted?.ephemeralMessage?.message) {
      return quoted.ephemeralMessage.message as proto.IMessage;
    }
    return quoted;
  }

  return null;
};

/**
 * Handle incoming messages for View Once commands ONLY
 * ⚠️ Autoresponder functionality is DISABLED for deployment.
 */
export const handleIncomingMessage = async (
  userId: string,
  socket: WASocket,
  message: any
): Promise<void> => {
  try {
    // Skip if no message content
    if (!message.message) {
      return;
    }

    const fromMe = !!message.key?.fromMe;
    logger.info(`[Autoresponder] Incoming message`, {
      userId,
      messageId: message.key?.id,
      chat: message.key?.remoteJid,
      fromMe,
      hasMessage: !!message.message,
      messageKeys: message.message ? Object.keys(message.message) : [],
    });

    // Extract message text
    const messageText = 
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      message.message.imageMessage?.caption ||
      message.message.videoMessage?.caption ||
      '';

    if (!messageText) {
      logger.info('[Autoresponder] Message has no textual content', {
        messageId: message.key?.id,
        chat: message.key?.remoteJid,
      });
      return;
    }

    const normalizedText = messageText.trim().toLowerCase();
    const quotedMessage = extractQuotedMessage(message);

    logger.info(`[ViewOnce] 🔍 Incoming message text: "${messageText}"`, {
      fromMe,
      hasQuoted: !!quotedMessage,
      messageType: Object.keys(message.message || {}),
    });

    const senderId = message.key?.remoteJid;
    const senderName = message.pushName || senderId?.split('@')[0] || 'Unknown';
    const chatJid = senderId || '';

    if (!chatJid) {
      return;
    }

    // IMPORTANT: Identifier le bon utilisateur qui a envoyé la commande
    // Si le message vient de quelqu'un qui a aussi le bot, on doit utiliser son userId
    // et non celui du socket qui a reçu le message
    let commandUserId = userId; // Par défaut, utiliser le userId du socket
    
    // Si le message n'est pas fromMe, vérifier si l'expéditeur a aussi le bot
    if (!fromMe && senderId) {
      try {
        const activeSockets = getActiveSockets();
        const senderUserId = findUserIdBySocketJID(senderId, activeSockets);
        
        if (senderUserId) {
          // L'expéditeur a aussi le bot, utiliser son userId
          commandUserId = senderUserId;
          logger.info(`[ViewOnce] Command sent by user ${commandUserId} (JID: ${senderId}), not ${userId}`);
        }
      } catch (error) {
        logger.warn('[ViewOnce] Error identifying command sender, using socket userId:', error);
      }
    }

    // Détecter la commande View Once configurée par l'utilisateur qui a envoyé la commande
    const isViewOnceCommand = await matchesViewOnceCommand(commandUserId, messageText);

    // Récupérer la config pour le label (utiliser le userId de celui qui a envoyé la commande)
    const { getViewOnceCommandConfig: fetchConfig } = await import('./viewOnceCommand.service');
    const config = await fetchConfig(commandUserId);
    const commandLabel = config.command_emoji || config.command_text;

    // --- CONFIGURATION COMMANDS ---
    if (normalizedText.startsWith('.setvv')) {
      const parts = normalizedText.split(' ');
      
      // .setvv emoji <emoji>
      if (parts[1] === 'emoji' && parts[2]) {
        try {
          const emoji = parts[2];
          await updateViewOnceCommandConfig(commandUserId, { command_emoji: emoji });
          await socket.sendMessage(chatJid, { 
            text: `✅ Déclencheur emoji mis à jour : ${emoji}\nVous pouvez maintenant capturer un View Once en répondant avec cet emoji.` 
          }, { quoted: message });
          return;
        } catch (error) {
          logger.error('[Config] Error updating emoji:', error);
          await socket.sendMessage(chatJid, { text: '❌ Erreur lors de la mise à jour de l\'emoji.' }, { quoted: message });
          return;
        }
      } 
      
      // .setvv <command>
      else if (parts[1] && parts[1] !== 'emoji') {
        try {
          let newCommand = parts[1];
          // S'assurer que ça commence par un préfixe commun pour éviter les déclenchements accidentels
          if (!newCommand.startsWith('.') && !newCommand.startsWith('!') && !newCommand.startsWith('#')) {
            newCommand = '.' + newCommand;
          }
          
          await updateViewOnceCommandConfig(commandUserId, { command_text: newCommand });
          await socket.sendMessage(chatJid, { 
            text: `✅ Commande View Once mise à jour : *${newCommand}*\nVous pouvez maintenant capturer un View Once en répondant avec cette commande.` 
          }, { quoted: message });
          return;
        } catch (error) {
          logger.error('[Config] Error updating command:', error);
          await socket.sendMessage(chatJid, { text: '❌ Erreur lors de la mise à jour de la commande.' }, { quoted: message });
          return;
        }
      }
      
      // .setvv help
      else {
        const helpText = `*Configuration View Once*\n\n` +
          `• \`.setvv <commande>\` : Change la commande (ex: \`.setvv !vv\`)\n` +
          `• \`.setvv emoji <emoji>\` : Utilise un emoji (ex: \`.setvv emoji 👀\`)\n\n` +
          `Commande actuelle : *${commandLabel}*`;
        await socket.sendMessage(chatJid, { text: helpText }, { quoted: message });
        return;
      }
    }

    if (!isViewOnceCommand) {
      // Aucune autre commande gérée pour l'instant
      return;
    }

    logger.info(`[ViewOnce] 📨 View Once command detected (${commandLabel}) from ${senderId} by user ${commandUserId}`, {
      fromMe,
      hasQuotedMessage: !!quotedMessage,
      socketUserId: userId,
      commandUserId,
    });
    
    if (!quotedMessage) {
      logger.warn(`[ViewOnce] ⚠️ No quoted message found for View Once command from ${senderId}`, {
        messageId: message.key?.id,
        contextInfoKeys: Object.keys(message.message?.extendedTextMessage?.contextInfo || {}),
      });
      return;
    }

    // Récupérer le socket actif pour l'utilisateur qui a envoyé la commande
    let activeSocket = getSocket(commandUserId);
    
    // Si pas de socket via getSocket, utiliser le socket passé en paramètre (si c'est le bon utilisateur)
    if (!activeSocket && socket && commandUserId === userId) {
      logger.info(`[ViewOnce] Using socket from message parameter for user ${commandUserId}`);
      activeSocket = socket;
    }
    
    // Si toujours pas de socket, essayer de reconnecter
    if (!activeSocket) {
      logger.warn(`[ViewOnce] No active socket for user ${commandUserId}, attempting to reconnect...`);
      try {
        // Importer la fonction de reconnexion
        const { reconnectWhatsAppIfCredentialsExist } = await import('./whatsapp.service');
        const reconnected = await reconnectWhatsAppIfCredentialsExist(commandUserId);
        if (reconnected) {
          activeSocket = getSocket(commandUserId);
          logger.info(`[ViewOnce] ✅ Socket reconnected for user ${commandUserId}`);
        }
      } catch (error) {
        logger.error(`[ViewOnce] Error attempting to reconnect socket:`, error);
      }
    }
    
    if (!activeSocket) {
      logger.error(`[ViewOnce] ❌ No active socket available for user ${commandUserId} after reconnection attempt`);
      // Pas de message d'erreur - silencieux
      return;
    }

    // Mode silencieux : sauvegarder pour le dashboard sans envoyer de message
    const captureMode: 'vv' | 'dashboard' = 'dashboard';

    // Add processing reaction
    try {
      await activeSocket.sendMessage(chatJid, {
        react: { text: '📸', key: message.key }
      });
    } catch (reactError) {
      logger.warn('[ViewOnce] Failed to send processing reaction:', reactError);
    }

    // Capturer le View Once depuis le quoted message
    // Utiliser commandUserId (celui qui a tapé la commande) au lieu de userId (propriétaire du socket)
    logger.info(`[ViewOnce] 📸 Capturing View Once from quoted message for user ${commandUserId}`, {
      commandType: captureMode,
      senderId,
      chatJid,
      socketUserId: userId,
      commandUserId,
    });
    
    const result = await captureViewOnceFromQuoted(
      commandUserId, // Utiliser commandUserId au lieu de userId
      activeSocket,
      quotedMessage,
      chatJid,
      senderId || '',
      senderName,
      captureMode
    );

    if (result.success) {
      logger.info(`[ViewOnce] ✅ View Once captured successfully: ${result.captureId}`, {
        fromMe,
        commandType: captureMode,
      });
      // Add success reaction
      try {
        await activeSocket.sendMessage(chatJid, {
          react: { text: '✅', key: message.key }
        });
      } catch (reactError) {
        logger.warn('[ViewOnce] Failed to send success reaction:', reactError);
      }
    } else {
      logger.warn(`[ViewOnce] ⚠️ View Once capture failed: ${result.error} - ${result.message}`, {
        fromMe,
        commandType: captureMode,
      });
      
      // Add error reaction and send message if it's a quota issue
      try {
        await activeSocket.sendMessage(chatJid, {
          react: { text: '❌', key: message.key }
        });
        
        if (result.message) {
          await activeSocket.sendMessage(chatJid, {
            text: result.message
          }, { quoted: message });
        }
      } catch (error) {
        logger.warn('[ViewOnce] Failed to send error feedback:', error);
      }
    }

    // TODO: Ajouter la logique pour l'autoresponder (mode offline/busy)
    // Cette partie sera implémentée plus tard si nécessaire

  } catch (error: any) {
    logger.error(`[Autoresponder] Error handling incoming message for user ${userId}:`, error);
    // Ne pas propager l'erreur pour éviter de bloquer le traitement des autres messages
  }
};

/**
 * Get autoresponder configuration for a user
 */
export const getAutoresponderConfig = async (userId: string) => {
  try {
    // Get user plan
    const { data: user } = await supabase
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single();

    const isPremium = user?.plan === 'premium';

    // Get autoresponder configs
    const { data: configs } = await supabase
      .from('autoresponder_config')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // Get autoresponder contacts (premium only)
    let contacts: any[] = [];
    if (isPremium) {
      const { data: contactConfigs } = await supabase
        .from('autoresponder_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('contact_name', { ascending: true });
      
      contacts = contactConfigs || [];
    }

    return {
      configs: configs || [],
      contacts,
      isPremium,
    };
  } catch (error: any) {
    logger.error('[Autoresponder] Error getting config:', error);
    throw error;
  }
};

/**
 * Activate autoresponder mode
 * ⚠️ DÉSACTIVÉ POUR LE DÉPLOIEMENT
 */
export const activateMode = async (_userId: string, _mode: string, _message?: string) => {
  logger.info(`[Autoresponder] activateMode called but feature is disabled for deployment`);
  return;
};

/**
 * Deactivate autoresponder mode
 * ⚠️ DÉSACTIVÉ POUR LE DÉPLOIEMENT
 */
export const deactivateMode = async (_userId: string, _mode: string) => {
  logger.info(`[Autoresponder] deactivateMode called but feature is disabled for deployment`);
  return;
};

/**
 * Update contact filter for autoresponder
 * ⚠️ DÉSACTIVÉ POUR LE DÉPLOIEMENT
 */
export const updateContactFilter = async (
  _userId: string,
  _contactId: string,
  _contactName: string,
  _enabled: boolean,
  _customMessage?: string
) => {
  logger.info(`[Autoresponder] updateContactFilter called but feature is disabled for deployment`);
  return;
};

