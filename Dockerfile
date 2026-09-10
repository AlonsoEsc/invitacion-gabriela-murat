FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:pages

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/src ./server/src
COPY --from=build /app/dist/client ./dist/client
EXPOSE 4001
CMD ["node", "server/src/index.js"]
