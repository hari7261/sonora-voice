FROM node:22-bookworm-slim
WORKDIR /srv/worker
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
ENV PORT=8080
EXPOSE 8080
# Mount license-cleared model weights in /models, configure SHERPA_* via deployment secrets.
CMD ["npm","start"]
