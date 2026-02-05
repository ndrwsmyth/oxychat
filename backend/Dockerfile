FROM node:20-slim
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Use HTTPS instead of SSH for GitHub (SSH keys not available in Docker)
ARG GITHUB_TOKEN
RUN git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "git@github.com:" \
 && git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "ssh://git@github.com/"

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
CMD ["node", "dist/index.js"]
