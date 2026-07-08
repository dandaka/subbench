FROM oven/bun:1.3.14
WORKDIR /workspace
COPY package.json bun.lock tsconfig.json tsconfig.base.json README.md ./
COPY packages ./packages
RUN bun install --frozen-lockfile
USER bun
ENTRYPOINT ["bun", "run", "packages/cli/src/index.ts"]
