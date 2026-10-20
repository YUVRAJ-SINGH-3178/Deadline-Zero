FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY apps ./apps
COPY assets ./assets
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/mcp-app/build ./apps/mcp-app/build
COPY --from=build /app/assets ./assets
COPY db ./db
USER node
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
