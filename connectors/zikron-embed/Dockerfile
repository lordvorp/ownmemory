# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY connectors/zikron-embed ./connectors/zikron-embed
ENV OWNMEMORY_DATA_DIR=/data
ENV TRANSFORMERS_CACHE=/data/models
ENV EMBED_LISTEN=0.0.0.0:8791
ENV OWNMEMORY_EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-s
EXPOSE 8791
CMD ["npx", "tsx", "connectors/zikron-embed/src/run.ts"]
