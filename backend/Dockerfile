# Etapa 1: compila con todas las dependencias
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: imagen final, solo con dependencias de producción
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]