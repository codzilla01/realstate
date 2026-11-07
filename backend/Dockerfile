# ── Backend: Express + Prisma ─────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first (better layer caching). The Prisma CLI stays installed
# because the entrypoint syncs the schema on first boot.
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
