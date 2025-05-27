# Dockerfile that shares Whisper installation with dahopevi
FROM node:22-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app
RUN apt update
RUN apt install -y \
      # Basic dependencies (no whisper build tools needed)
      git \
      wget \
      ffmpeg \
      curl \
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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --no-frozen-lockfile

FROM prod-deps AS build
COPY tsconfig.json tsconfig.build.json vite.config.ts /app/
COPY src /app/src
COPY static /app/static
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --no-frozen-lockfile
RUN pnpm build

FROM base AS prod
# Create app user
RUN useradd -r -s /bin/false -d /app appuser

# Copy application files
COPY static /app/static
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json /app/

# Set required directories and permissions - create all needed directories upfront
RUN mkdir -p /app/data/videos /app/data/temp /app/data/voices /app/static/music && \
    chmod -R 777 /app/data

# Run as root to avoid permission issues in cloud environments like Coolify
# USER appuser

# Production environment configuration
ENV NODE_ENV=production \
    DATA_DIR_PATH=/app/data \
    DOCKER=true \
    WHISPER_MODEL=base.en \
    CONCURRENCY=2 \
    VIDEO_CACHE_SIZE_IN_BYTES=2097152000 \
    SHARED_WHISPER_PATH=/shared/whisper

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3123/health || exit 1

# Expose port
EXPOSE 3123

CMD ["pnpm", "start"]
