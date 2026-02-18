FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Stage 1: Install production dependencies
FROM base AS prod-deps
# 1. FIXED SYNTAX: Removed trailing backslash and combined lines correctly
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
ARG SEDIMENT_GIT_TOKEN
# 2. FIXED LOCKFILE: Changed to --no-frozen-lockfile to allow your pnpm patches to work
RUN git config --global url."https://${SEDIMENT_GIT_TOKEN}@github.com/".insteadOf "git@github.com:" \
 && git config --global --add url."https://${SEDIMENT_GIT_TOKEN}@github.com/".insteadOf "ssh://git@github.com/" \
 && pnpm install --prod --no-frozen-lockfile

# Stage 2: Build the application
FROM base AS build
# 3. ADDED TYPES: Added @types/node so the framework can actually compile
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && pnpm add -g typescript @types/node

COPY package.json pnpm-lock.yaml ./
ARG SEDIMENT_GIT_TOKEN
RUN git config --global url."https://${SEDIMENT_GIT_TOKEN}@github.com/".insteadOf "git@github.com:" \
 && git config --global --add url."https://${SEDIMENT_GIT_TOKEN}@github.com/".insteadOf "ssh://git@github.com/" \
 && pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 3: Final runtime image
FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json ./
CMD ["node", "dist/index.js"]
