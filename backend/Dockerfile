FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Stage 1: Install production dependencies
FROM base AS prod-deps
# Added: install typescript globally so pnpm can build 'sediment'
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && pnpm add -g typescript 

COPY package.json pnpm-lock.yaml ./

# Secure: Using --mount=type=secret prevents the token from leaking into logs
RUN --mount=type=secret,id=GITHUB_TOKEN \
    GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN) && \
    git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "git@github.com:" && \
    git config --global --add url."https://${GITHUB_TOKEN}@github.com/".insteadOf "ssh://git@github.com/" && \
    pnpm install --prod --frozen-lockfile

# Stage 2: Build the application
FROM base AS build
# Added: install typescript globally here too
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && pnpm add -g typescript

COPY package.json pnpm-lock.yaml ./

# Secure: Using --mount here as well
RUN --mount=type=secret,id=GITHUB_TOKEN \
    GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN) && \
    git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "git@github.com:" && \
    git config --global --add url."https://${GITHUB_TOKEN}@github.com/".insteadOf "ssh://git@github.com/" && \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 3: Final runtime image
FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json ./
CMD ["node", "dist/index.js"]