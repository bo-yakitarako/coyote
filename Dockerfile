FROM node:23-alpine

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

CMD ["node", "dist/index.js"]
