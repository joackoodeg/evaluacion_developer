# Etapa 1: compila la app con Vite
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite reemplaza VITE_API_URL al compilar: tiene que llegar como build arg,
# no alcanza con definirla al arrancar el contenedor.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Etapa 2: solo los archivos estáticos, servidos con nginx
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
