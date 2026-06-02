# Explicit build for the Railway service — overrides Nixpacks auto-detection
# so the deploy can't accidentally pick "static site → nginx/Caddy" instead
# of our Node app. Keep this Dockerfile minimal; package.json is the source
# of truth for the start command.
FROM node:20-alpine

WORKDIR /app

# Install production deps only — package-lock.json pins the tree
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Then the rest of the app
COPY . .

# Railway injects PORT at runtime; the proxy already honors process.env.PORT
ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "server.js"]
