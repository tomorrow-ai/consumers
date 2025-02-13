FROM oven/bun:1

WORKDIR /app

COPY package*.json bun.lock ./

RUN if [ -f package.json ]; then bun install; fi

COPY . .

EXPOSE 3000

CMD ["bun", "index.ts"]