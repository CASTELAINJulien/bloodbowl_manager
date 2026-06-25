FROM node:20-alpine

# Dépendances pour better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Volume pour la persistance de la base SQLite
VOLUME ["/app/data"]
ENV DB_DIR=/app/data
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
