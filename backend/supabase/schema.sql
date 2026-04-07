-- ============================================
-- AMDA Database Schema - Supabase PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- ============================================
-- 2. SUBSCRIPTIONS TABLE (Stripe)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('free', 'premium')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- 3. WHATSAPP SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  qr_code TEXT,
  pairing_code VARCHAR(20),
  status VARCHAR(50) NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected')),
  connected_at TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE,
  session_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_id ON whatsapp_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(status);

-- ============================================
-- 4. STATUS LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS status_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  status_id VARCHAR(255) NOT NULL,
  emoji_used VARCHAR(10) NOT NULL DEFAULT '❤️',
  liked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_status_likes_user_id ON status_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_status_likes_contact_id ON status_likes(contact_id);
CREATE INDEX IF NOT EXISTS idx_status_likes_liked_at ON status_likes(liked_at);
CREATE INDEX IF NOT EXISTS idx_status_likes_user_contact ON status_likes(user_id, contact_id);

-- ============================================
-- 5. STATUS AUTO-LIKE CONFIG (Premium)
-- ============================================
CREATE TABLE IF NOT EXISTS status_auto_like_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  emoji VARCHAR(10) DEFAULT '❤️',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_status_auto_like_config_user_id ON status_auto_like_config(user_id);
CREATE INDEX IF NOT EXISTS idx_status_auto_like_config_contact_id ON status_auto_like_config(contact_id);
CREATE INDEX IF NOT EXISTS idx_status_auto_like_config_enabled ON status_auto_like_config(enabled);

-- ============================================
-- 6. VIEW ONCE CAPTURES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS view_once_captures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  file_size BIGINT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_view_once_captures_user_id ON view_once_captures(user_id);
CREATE INDEX IF NOT EXISTS idx_view_once_captures_sender_id ON view_once_captures(sender_id);
CREATE INDEX IF NOT EXISTS idx_view_once_captures_captured_at ON view_once_captures(captured_at);
CREATE INDEX IF NOT EXISTS idx_view_once_captures_user_captured ON view_once_captures(user_id, captured_at DESC);

-- ============================================
-- 7. DELETED MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deleted_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(50) CHECK (media_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  delay_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deleted_messages_user_id ON deleted_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_sender_id ON deleted_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_at ON deleted_messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_user_deleted ON deleted_messages(user_id, deleted_at DESC);

-- ============================================
-- 8. AUTORESPONDER CONFIG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS autoresponder_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL CHECK (mode IN ('offline', 'busy', 'meeting', 'vacation', 'custom', 'disabled')),
  message TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  auto_activate_offline BOOLEAN DEFAULT TRUE,
  schedule_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mode)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_autoresponder_config_user_id ON autoresponder_config(user_id);
CREATE INDEX IF NOT EXISTS idx_autoresponder_config_mode ON autoresponder_config(mode);
CREATE INDEX IF NOT EXISTS idx_autoresponder_config_enabled ON autoresponder_config(enabled);

-- ============================================
-- 9. VIEW ONCE COMMAND CONFIG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS view_once_command_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_text VARCHAR(50) DEFAULT '.vv',
  command_emoji VARCHAR(10),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_view_once_command_config_user_id ON view_once_command_config(user_id);

-- ============================================
-- 10. AUTORESPONDER CONTACTS TABLE (Premium)
-- ============================================
CREATE TABLE IF NOT EXISTS autoresponder_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  custom_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_autoresponder_contacts_user_id ON autoresponder_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_autoresponder_contacts_contact_id ON autoresponder_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_autoresponder_contacts_enabled ON autoresponder_contacts(enabled);

-- ============================================
-- 11. SCHEDULED STATUSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT,
  caption TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'canceled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_statuses_user_id ON scheduled_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_statuses_scheduled_at ON scheduled_statuses(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_statuses_status ON scheduled_statuses(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_statuses_user_status ON scheduled_statuses(user_id, status);

-- ============================================
-- 12. QUOTAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_once_count INTEGER DEFAULT 0,
  deleted_messages_count INTEGER DEFAULT 0,
  scheduled_statuses_count INTEGER DEFAULT 0,
  reset_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_quotas_reset_date ON quotas(reset_date);

-- ============================================
-- 13. ANALYTICS TABLE (Premium - Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status_likes_count INTEGER DEFAULT 0,
  view_once_captures_count INTEGER DEFAULT 0,
  deleted_messages_count INTEGER DEFAULT 0,
  autoresponder_responses_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics(user_id, date DESC);

-- ============================================
-- 14. SNAP CAPTURES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS snap_captures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username VARCHAR(255) NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
  is_story BOOLEAN DEFAULT FALSE,
  source_url TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snap_captures_user_id ON snap_captures(user_id);
CREATE INDEX IF NOT EXISTS idx_snap_captures_captured_at ON snap_captures(captured_at);
CREATE INDEX IF NOT EXISTS idx_snap_captures_user_captured ON snap_captures(user_id, captured_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_sessions_updated_at ON whatsapp_sessions;
CREATE TRIGGER update_whatsapp_sessions_updated_at BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_status_auto_like_config_updated_at ON status_auto_like_config;
CREATE TRIGGER update_status_auto_like_config_updated_at BEFORE UPDATE ON status_auto_like_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_autoresponder_config_updated_at ON autoresponder_config;
CREATE TRIGGER update_autoresponder_config_updated_at BEFORE UPDATE ON autoresponder_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_autoresponder_contacts_updated_at ON autoresponder_contacts;
CREATE TRIGGER update_autoresponder_contacts_updated_at BEFORE UPDATE ON autoresponder_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_view_once_command_config_updated_at ON view_once_command_config;
CREATE TRIGGER update_view_once_command_config_updated_at BEFORE UPDATE ON view_once_command_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_statuses_updated_at ON scheduled_statuses;
CREATE TRIGGER update_scheduled_statuses_updated_at BEFORE UPDATE ON scheduled_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotas_updated_at ON quotas;
CREATE TRIGGER update_quotas_updated_at BEFORE UPDATE ON quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize quota for new user
CREATE OR REPLACE FUNCTION initialize_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO quotas (user_id, reset_date)
  VALUES (NEW.id, DATE_TRUNC('month', NOW())::DATE + INTERVAL '1 month')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create quota when user is created
DROP TRIGGER IF EXISTS create_user_quota ON users;
CREATE TRIGGER create_user_quota AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_quota();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_auto_like_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_once_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoresponder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoresponder_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_once_command_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_captures ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- WhatsApp sessions policies
DROP POLICY IF EXISTS "Users can manage own sessions" ON whatsapp_sessions;
CREATE POLICY "Users can manage own sessions"
  ON whatsapp_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Status likes policies
DROP POLICY IF EXISTS "Users can view own status likes" ON status_likes;
CREATE POLICY "Users can view own status likes"
  ON status_likes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own status likes" ON status_likes;
CREATE POLICY "Users can create own status likes"
  ON status_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Status auto-like config policies
DROP POLICY IF EXISTS "Users can manage own status config" ON status_auto_like_config;
CREATE POLICY "Users can manage own status config"
  ON status_auto_like_config FOR ALL
  USING (auth.uid() = user_id);

-- View once captures policies
DROP POLICY IF EXISTS "Users can view own captures" ON view_once_captures;
CREATE POLICY "Users can view own captures"
  ON view_once_captures FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own captures" ON view_once_captures;
CREATE POLICY "Users can create own captures"
  ON view_once_captures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Deleted messages policies
DROP POLICY IF EXISTS "Users can view own deleted messages" ON deleted_messages;
CREATE POLICY "Users can view own deleted messages"
  ON deleted_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own deleted messages" ON deleted_messages;
CREATE POLICY "Users can create own deleted messages"
  ON deleted_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own deleted messages" ON deleted_messages;
CREATE POLICY "Users can delete own deleted messages"
  ON deleted_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Autoresponder config policies
DROP POLICY IF EXISTS "Users can manage own autoresponder" ON autoresponder_config;
CREATE POLICY "Users can manage own autoresponder"
  ON autoresponder_config FOR ALL
  USING (auth.uid() = user_id);

-- Autoresponder contacts policies
DROP POLICY IF EXISTS "Users can manage own contacts" ON autoresponder_contacts;
CREATE POLICY "Users can manage own contacts"
  ON autoresponder_contacts FOR ALL
  USING (auth.uid() = user_id);

-- View Once command config policies
DROP POLICY IF EXISTS "Users can manage own view once command" ON view_once_command_config;
CREATE POLICY "Users can manage own view once command"
  ON view_once_command_config FOR ALL
  USING (auth.uid() = user_id);

-- Scheduled statuses policies
DROP POLICY IF EXISTS "Users can manage own scheduled statuses" ON scheduled_statuses;
CREATE POLICY "Users can manage own scheduled statuses"
  ON scheduled_statuses FOR ALL
  USING (auth.uid() = user_id);

-- Quotas policies
DROP POLICY IF EXISTS "Users can view own quotas" ON quotas;
CREATE POLICY "Users can view own quotas"
  ON quotas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quotas" ON quotas;
CREATE POLICY "Users can update own quotas"
  ON quotas FOR UPDATE
  USING (auth.uid() = user_id);

-- Analytics policies
DROP POLICY IF EXISTS "Users can view own analytics" ON analytics;
CREATE POLICY "Users can view own analytics"
  ON analytics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own analytics" ON analytics;
CREATE POLICY "Users can create own analytics"
  ON analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Snap captures policies
DROP POLICY IF EXISTS "Users can view own snap captures" ON snap_captures;
CREATE POLICY "Users can view own snap captures"
  ON snap_captures FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own snap captures" ON snap_captures;
CREATE POLICY "Users can delete own snap captures"
  ON snap_captures FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 15. FCM TOKENS TABLE (Push Notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token);

-- RLS Policies for fcm_tokens
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own FCM tokens" ON fcm_tokens;
CREATE POLICY "Users can manage own FCM tokens"
  ON fcm_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER update_fcm_tokens_updated_at BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 16. NOTIFICATION SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  view_once BOOLEAN DEFAULT TRUE,
  status_liked BOOLEAN DEFAULT TRUE,
  deleted_message BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- RLS Policies for notification_settings
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notification settings" ON notification_settings;
CREATE POLICY "Users can manage own notification settings"
  ON notification_settings FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

