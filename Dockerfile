FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
EXPOSE 3001
CMD ["node", "server/index.mjs"]
