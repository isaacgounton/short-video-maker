FROM node:22-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app
RUN apt update
RUN apt install -y \
      # ffmpeg for audio processing
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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
RUN pnpm install --prefer-offline --no-cache --prod

FROM prod-deps AS build
COPY tsconfig.json /app
COPY tsconfig.build.json /app
COPY vite.config.ts /app
COPY src /app/src
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build

FROM base
COPY static /app/static
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json /app/

# app configuration via environment variables
ENV DATA_DIR_PATH=/app/data
ENV DOCKER=true
ENV TTS_API_URL=https://tts.dahopevi.com/api
ENV TRANSCRIPTION_API_URL=https://api.dahopevi.com
# number of chrome tabs to use for rendering
ENV CONCURRENCY=1
# video cache - 2000MB
ENV VIDEO_CACHE_SIZE_IN_BYTES=2097152000

# install kokoro, headless chrome and ensure music files are present
RUN node dist/scripts/install.js

CMD ["pnpm", "start"]
