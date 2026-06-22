FROM node:20-alpine
WORKDIR /app
COPY discord-bot/package.json ./
RUN npm install --omit=dev
COPY discord-bot/src ./src
COPY discord-bot/assets ./assets
RUN mkdir -p data
CMD ["node", "src/index.js"]
