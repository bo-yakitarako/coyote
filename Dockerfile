FROM node:23-alpine

WORKDIR /app

COPY . .
RUN npm i -g pnpm
RUN pnpm install --frozen-lockfile && pnpm build

CMD ["node", "dist/index.js"]
