FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Prisma schema is needed to generate the client.
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# SQLite file lives on a mounted volume (see docker-compose.yml).
ENV DATABASE_URL=file:../data/waitlist.db
EXPOSE 4000

# Apply migrations at boot, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
