# --- Étape 1 : Build du Frontend ---
FROM node:18-alpine AS build
WORKDIR /app

# Copier les dépendances de la racine (nécessaires pour le build Vite)
COPY package*.json ./
RUN npm install

# Copier tout le code source
COPY . .

# Définir l'URL de l'API pour le build (passée via build-args ou env)
# Note: Vite utilise VITE_API_URL pendant le build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Builder le frontend (produit le dossier /dist)
RUN npm run build

# --- Étape 2 : Production avec Nginx ---
FROM nginx:stable-alpine

# Copier les fichiers buildés vers Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copier une configuration Nginx personnalisée si nécessaire (ex: redirection SPA)
# On peut utiliser une config simple ou se baser sur celle par défaut
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
