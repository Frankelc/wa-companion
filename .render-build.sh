#!/bin/bash
# Script de build pour Render - Racine du projet
# Ce script change vers le dossier backend avant d'exécuter npm

set -e  # Arrêter en cas d'erreur

echo "🔨 Building AMDA Backend from root..."

# Aller dans le dossier backend
cd backend || {
  echo "❌ Error: backend directory not found"
  exit 1
}

# Installer les dépendances
echo "📦 Installing dependencies in backend..."
npm install

# Builder le projet TypeScript
echo "🔧 Building TypeScript..."
npm run build

# Vérifier que le build a réussi
if [ ! -d "dist" ]; then
  echo "❌ Build failed: dist directory not found"
  exit 1
fi

echo "✅ Build completed successfully!"

# Install Playwright browser (Chromium) for Snap Bot
echo "🌐 Installing Playwright Chromium for Snap Bot..."
export PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install chromium || true
npx playwright install-deps chromium || true # ignore if system deps unavailable
echo "✅ Playwright Chromium step completed (errors ignored)!"
echo "✅ Playwright Chromium ready!"
