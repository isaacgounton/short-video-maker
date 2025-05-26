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
RUN apt update
RUN apt install -y \
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

# setup pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml* /app/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM prod-deps AS build
COPY tsconfig.json tsconfig.build.json vite.config.ts /app/
COPY src /app/src
COPY static /app/static
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS prod
# Create app user
RUN useradd -r -s /bin/false -d /app appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

# Copy application files
COPY static /app/static
COPY --from=install-whisper /whisper /app/data/libs/whisper
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json /app/

# Set required directories and permissions
RUN mkdir -p /app/data/videos /app/data/temp && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Production environment configuration
ENV NODE_ENV=production \
    DATA_DIR_PATH=/app/data \
    DOCKER=true \
    WHISPER_MODEL=base.en \
    CONCURRENCY=2 \
    VIDEO_CACHE_SIZE_IN_BYTES=2097152000

# Create music files directory
RUN mkdir -p /app/static/music

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3123/health || exit 1

# Expose port
EXPOSE 3123

CMD ["pnpm", "start"]
