FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

COPY package.json pnpm-lock.yaml ./

COPY pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "start"]