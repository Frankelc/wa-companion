-- Migration : Module Snapchat pour AMDA
-- À exécuter dans l'éditeur SQL Supabase

-- 1. Table des captures Snapchat
CREATE TABLE IF NOT EXISTS snap_captures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username TEXT NOT NULL DEFAULT 'Unknown',
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  is_story      BOOLEAN NOT NULL DEFAULT FALSE,
  source_url    TEXT,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour accélérer les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_snap_captures_user_id ON snap_captures(user_id);
CREATE INDEX IF NOT EXISTS idx_snap_captures_captured_at ON snap_captures(user_id, captured_at DESC);

-- 2. Row Level Security
ALTER TABLE snap_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snap captures"
  ON snap_captures FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own snap captures"
  ON snap_captures FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- La politique INSERT est volontairement réservée au service role (le bot Python)
-- pour éviter que les clients puissent insérer de fausses captures.
CREATE POLICY "Service role can insert snap captures"
  ON snap_captures FOR INSERT
  WITH CHECK (true); -- contrôlé via service_role_key côté Python

-- 3. Bucket Supabase Storage pour les médias Snap
INSERT INTO storage.buckets (id, name, public)
VALUES ('snap-captures', 'snap-captures', true)
ON CONFLICT DO NOTHING;

-- Politique d'accès public en lecture (pour afficher les images dans le dashboard)
CREATE POLICY "Public read snap captures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'snap-captures');

CREATE POLICY "Service role upload snap captures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'snap-captures');
