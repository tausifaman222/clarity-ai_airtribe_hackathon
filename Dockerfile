# Runs anywhere that runs containers: Render, Railway, Fly.io, Google Cloud Run, a VPS.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=5000
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
EXPOSE 5000
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "server.js"]
