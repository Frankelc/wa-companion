# Utiliser l'image officielle de Playwright qui inclut toutes les dépendances Chrome/Linux
FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Installer Node.js 18 (déjà inclus dans l'image Playwright généralement)
# Mais on s'assure d'avoir la version correcte si besoin
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances avec --production pour éviter les outils de dev inutiles en prod
RUN npm install

# Copier tout le code source du backend
COPY . .

# Compiler le TypeScript en JavaScript
RUN npm run build

# Créer les dossiers nécessaires pour les médias et sessions si absents
RUN mkdir -p uploads/view-once uploads/deleted-messages snap_sessions

# Exposer le port de l'API
EXPOSE 3001

# Lancer l'application
CMD ["npm", "start"]
