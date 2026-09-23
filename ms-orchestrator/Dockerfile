FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package.json pnpm-workspace.yaml ./

RUN pnpm install --prod

COPY --chown=nodejs:nodejs src ./src

USER nodejs

EXPOSE 3000

CMD ["node", "--import", "./src/instrumentation.ts", "src/app.ts"]