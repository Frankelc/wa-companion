# ─── Build stage ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

# Install system dependencies required by Playwright/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libxss1 \
    libxtst6 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright + Chromium browser
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy source code
COPY . .

# Create sessions directory for saved Snapchat sessions
RUN mkdir -p snap_sessions

# Port exposé par FastAPI
EXPOSE 8001

# Variables d'environnement par défaut
ENV SNAP_BOT_PORT=8001
ENV PYTHONUNBUFFERED=1

# Démarrer le serveur FastAPI
CMD ["python", "main.py"]
