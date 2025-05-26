FROM ubuntu:22.04 AS install-whisper
ENV DEBIAN_FRONTEND=noninteractive
RUN apt update
# whisper install dependencies
RUN apt install -y \
    git \
    build-essential \
    wget \
    cmake \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /whisper
RUN git clone https://github.com/ggml-org/whisper.cpp.git .
RUN git checkout v1.7.1
RUN make
WORKDIR /whisper/models
RUN sh ./download-ggml-model.sh base.en

FROM node:22-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# Install system dependencies
RUN apt update && apt install -y \
    # whisper dependencies
    git \
    wget \
    cmake \
    ffmpeg \
    curl \
    make \
    libsdl2-dev \
    # remotion dependencies
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Setup pnpm with cache optimization
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Install production dependencies
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml* /app/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
RUN pnpm install --prefer-offline --no-cache --prod

# Build application
FROM prod-deps AS build
COPY tsconfig.json tsconfig.build.json vite.config.ts /app/
COPY src /app/src
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build

# Production image
FROM base

# Copy application files
COPY static /app/static
COPY --from=install-whisper /whisper /app/data/libs/whisper
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json /app/

# Set up application user
RUN useradd -r -s /bin/false -d /app appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

# Production environment configuration
ENV DATA_DIR_PATH=/app/data \
    DOCKER=true \
    WHISPER_MODEL=base.en \
    CONCURRENCY=1 \
    VIDEO_CACHE_SIZE_IN_BYTES=2097152000 \
    NODE_ENV=production

# Switch to non-root user
USER appuser

# Create required directories
RUN mkdir -p /app/data/videos /app/data/temp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3123/health || exit 1

# Expose port
EXPOSE 3123

CMD ["pnpm", "start"]
