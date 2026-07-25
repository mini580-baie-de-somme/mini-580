# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg curl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG BUILD_VERSION=
ENV BUILD_VERSION=$BUILD_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data/media \
  && chown nextjs:nodejs /data/media

# Local STT — same stack as OpenClaw (openai-whisper CLI + ffmpeg from base image)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && pip3 install --break-system-packages --no-cache-dir \
       torch --index-url https://download.pytorch.org/whl/cpu \
  && pip3 install --break-system-packages --no-cache-dir openai-whisper --no-deps \
  && pip3 install --break-system-packages --no-cache-dir tiktoken tqdm more-itertools numba numpy \
  && mkdir -p /opt/whisper-cache \
  && XDG_CACHE_HOME=/opt/whisper-cache python3 -c "import whisper; whisper.load_model('tiny')" \
  && chown -R nextjs:nodejs /opt/whisper-cache \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# sharp native bindings — required for image variant rebake in standalone output
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
COPY --from=builder /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=builder /app/node_modules/semver ./node_modules/semver
# Edge TTS — not always traced into standalone (dynamic import in sendTelegramReply)
COPY --from=builder /app/node_modules/node-edge-tts ./node_modules/node-edge-tts
COPY --from=builder /app/node_modules/ws ./node_modules/ws
COPY --from=builder /app/node_modules/https-proxy-agent ./node_modules/https-proxy-agent
COPY --from=builder /app/node_modules/agent-base ./node_modules/agent-base
COPY --from=builder /app/node_modules/yargs ./node_modules/yargs
COPY --from=builder /app/node_modules/yargs-parser ./node_modules/yargs-parser
COPY --from=builder /app/node_modules/cliui ./node_modules/cliui
COPY --from=builder /app/node_modules/escalade ./node_modules/escalade
COPY --from=builder /app/node_modules/get-caller-file ./node_modules/get-caller-file
COPY --from=builder /app/node_modules/require-directory ./node_modules/require-directory
COPY --from=builder /app/node_modules/string-width ./node_modules/string-width
COPY --from=builder /app/node_modules/strip-ansi ./node_modules/strip-ansi
COPY --from=builder /app/node_modules/wrap-ansi ./node_modules/wrap-ansi
COPY --from=builder /app/node_modules/emoji-regex ./node_modules/emoji-regex
COPY --from=builder /app/node_modules/is-fullwidth-code-point ./node_modules/is-fullwidth-code-point
COPY --from=builder /app/node_modules/ansi-regex ./node_modules/ansi-regex
COPY --from=builder /app/node_modules/ansi-styles ./node_modules/ansi-styles
COPY --from=builder /app/node_modules/color-convert ./node_modules/color-convert
COPY --from=builder /app/node_modules/color-name ./node_modules/color-name

# Prisma schema + CLI (isolated from Next standalone node_modules)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /opt/prisma-cli \
  && cd /opt/prisma-cli \
  && npm init -y \
  && npm install prisma@7.8.0 dotenv@17.4.2 \
  && chown -R nextjs:nodejs /opt/prisma-cli /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY scripts/transcribe-audio.sh /opt/transcribe-audio.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /opt/transcribe-audio.sh

ENV TRANSCRIBE_AUDIO_SCRIPT=/opt/transcribe-audio.sh
ENV WHISPER_BIN=/usr/local/bin/whisper
ENV WHISPER_MODEL=tiny
ENV XDG_CACHE_HOME=/opt/whisper-cache

USER nextjs
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
