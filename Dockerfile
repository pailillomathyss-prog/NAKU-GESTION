FROM node:20-alpine
WORKDIR /app
COPY discord-bot/package.json ./
RUN npm install --omit=dev
COPY discord-bot/src ./src
COPY discord-bot/assets ./assets
# /app/data est monté comme Volume Railway pour persister la config
RUN mkdir -p data
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
