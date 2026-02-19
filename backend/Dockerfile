FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
ARG SEDIMENT_GIT_TOKEN
RUN git config --global url."https://x-access-token:${SEDIMENT_GIT_TOKEN}@github.com/".insteadOf "https://github.com/" \
  && pnpm install --prod --no-frozen-lockfile

FROM base AS build
COPY package.json pnpm-lock.yaml ./
ARG SEDIMENT_GIT_TOKEN
RUN git config --global url."https://x-access-token:${SEDIMENT_GIT_TOKEN}@github.com/".insteadOf "https://github.com/" \
  && pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm run build

FROM base AS runtime
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/migrations /app/migrations
COPY --from=build /app/seeds /app/seeds
COPY package.json ./
CMD ["node", "dist/index.js"]
