FROM node:24-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json /workspace/
COPY apps/web /workspace/apps/web

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate
RUN pnpm install --filter web...

EXPOSE 3000

WORKDIR /workspace/apps/web
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]

